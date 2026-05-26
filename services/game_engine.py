from __future__ import annotations
import logging
import uuid
import time
import random
from typing import Literal, Optional, Dict, List
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
from services.schemas import (
    Note, GameState, Track, SpeedMultiplier, Instrument,
    VariantTrackSet, SwitchWindow,
)
from services.scales import expand
from services.tabulator import Tabulator
from services.instruments import get as get_instrument

# Variant feature: offer after every N completed half-cycles (ascending OR descending).
# Pattern: Up, Down, Up → RIGHT; Down, Up, Down → LEFT.
SCALES_PER_VARIANT = 2
# Default switch window duration.
DEFAULT_WINDOW_MS = 120_000  # 2-minute safety net; frontend proximity logic drives dismiss timing
# Variant root offset: 2 frets above highest scale note (RIGHT) or below root (LEFT).
VARIANT_SHIFT_DOWN = 2

class GameSession(BaseModel):
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: Literal["running", "paused", "failed", "abandoned"] = "running"
    scale_id: str
    difficulty: str = "easy"
    current_score: int = 0
    current_track: int = 2
    speed_multiplier: float = 1.0
    notes: List[Note] = []
    current_note_index: int = 0
    started_at_ms: int = Field(default_factory=lambda: int(time.time() * 1000))
    ended_at_ms: Optional[int] = None
    base_fret: int = 0
    num_lanes: int = 6
    total_notes_played: int = 0
    paused_at_ms: Optional[int] = None
    # --- Variant switching (008-track-variants) ---
    root_midi: int = 60
    instrument_id: str = "guitar-standard"
    scale_id_for_variant: str = "major"
    ascending_note_count: int = 0       # index where descending begins in notes
    scale_passes_completed: int = 0     # half-cycles since last variant offer
    last_pass_direction: Optional[str] = None  # "UP" or "DOWN"
    active_variant: Optional[VariantTrackSet] = None
    active_window: Optional[SwitchWindow] = None
    variant_history: List[dict] = []

class GameEngine:
    def __init__(self):
        self.sessions: Dict[str, GameSession] = {}
        self.tabulator = Tabulator()

    def create_session(self, scale_id: str, difficulty: str = "easy", root_midi: int = 60, octaves: int = 1, descending: bool = False, instrument_id: str = "guitar-standard") -> GameSession:
        self.cleanup_sessions()

        instrument = get_instrument(instrument_id)
        if not instrument:
            instrument = Instrument(id="default", name="Default", kind="guitar", stringCount=6, tuning=[40, 45, 50, 55, 59, 64], maxFret=24)

        notes, asc_count = self._build_full_scale_notes(scale_id, root_midi, instrument)

        scale_frets = [n.fret for n in notes if n.fret is not None]
        base_fret = min(scale_frets) if scale_frets else 0
        max_fret = max(scale_frets) if scale_frets else base_fret
        num_lanes = max(3, min(instrument.maxFret, (max_fret - base_fret) + 1))

        first_safe_track = (notes[0].fret - base_fret) if notes and notes[0].fret is not None else 0
        first_safe_track = max(0, min(num_lanes - 1, first_safe_track))

        possible_tracks = [t for t in range(num_lanes) if t != first_safe_track]
        start_track = random.choice(possible_tracks) if possible_tracks else first_safe_track

        session = GameSession(
            scale_id=scale_id,
            difficulty=difficulty,
            notes=notes,
            ascending_note_count=asc_count,
            current_track=start_track,
            base_fret=base_fret,
            num_lanes=num_lanes,
            root_midi=root_midi,
            instrument_id=instrument_id,
            scale_id_for_variant=scale_id,
        )
        self.sessions[session.session_id] = session
        return session

    def _build_full_scale_notes(self, scale_id: str, root_midi: int, instrument: Instrument):
        """Generate ascending + descending notes spanning the full instrument.

        Uses position playing: max 3 frets span and 3 notes per string,
        walking from the lowest string to the highest. Returns (notes, ascending_count)
        where ascending_count is the index where the descending half begins.
        """
        import math
        from services.scales import get_scale as get_scale_def, make_note

        # Compute octaves needed to reach the top of the instrument from root
        highest_open = instrument.tuning[-1]
        max_midi = highest_open + instrument.maxFret
        span = max_midi - root_midi
        octaves = max(1, math.ceil(span / 12)) if span > 0 else 1
        octaves = min(4, octaves)                   # expand() accepts up to 4

        # Generate ascending MIDI values
        asc_raw = expand(scale_id, root_midi, octaves=octaves, descending=False)
        asc_midis = [n.midi for n in asc_raw if n.midi <= max_midi]

        # Find root's starting string (lowest string where root fits in frets 1-12)
        root_string_idx = 0
        for i, open_midi in enumerate(instrument.tuning):
            f = root_midi - open_midi
            if 1 <= f <= 12:
                root_string_idx = i
                break
            if f == 0:
                root_string_idx = i
                break

        # Assign string/fret using position playing (max 3 fret span, max 3 notes per string)
        ascending = []
        str_idx = root_string_idx
        notes_on_str = 0
        str_base_fret = None

        for midi in asc_midis:
            placed = False
            while str_idx < len(instrument.tuning):
                open_midi = instrument.tuning[str_idx]
                fret = midi - open_midi

                if fret < 0:
                    # Below this string's open tuning; skip note (unplayable on any string)
                    break
                if fret > instrument.maxFret:
                    str_idx += 1
                    notes_on_str = 0
                    str_base_fret = None
                    continue

                if str_base_fret is None:
                    str_base_fret = fret

                if fret - str_base_fret > 3 or notes_on_str >= 3:
                    str_idx += 1
                    notes_on_str = 0
                    str_base_fret = None
                    continue

                n = make_note(midi)
                n.string = len(instrument.tuning) - str_idx  # 1-based from HIGH
                n.fret = fret
                ascending.append(n)
                notes_on_str += 1
                placed = True
                break

            if not placed:
                if str_idx >= len(instrument.tuning):
                    break  # All strings exhausted; no more notes can be placed
                # else: note was below strings or out of position span; skip it

        asc_count = len(ascending)

        # Descending: mirror of ascending minus apex, same string/fret
        descending = []
        for n in reversed(ascending[:-1]):
            dn = make_note(n.midi)
            dn.string = n.string
            dn.fret = n.fret
            descending.append(dn)

        # Drop final root note to avoid duplicate at loop wrap-around
        all_notes = ascending + descending
        if len(all_notes) > 1:
            all_notes = all_notes[:-1]

        return all_notes, asc_count

    def play_note(self, session_id: str, midi: int, timing_ms: int) -> dict:
        session = self.get_session(session_id)
        if not session:
            return {"success": False, "error": "session_not_found"}
        
        if session.status != "running":
            return {"success": False, "error": "game_not_running"}
            
        expected_note = session.notes[session.current_note_index]
        if midi == expected_note.midi:
            session.current_score += 100
            prev_idx = session.current_note_index
            session.total_notes_played += 1
            session.current_note_index = (session.current_note_index + 1) % len(session.notes)
            new_idx = session.current_note_index
            # Detect ascending pass (apex reached — last ascending note → first descending).
            if (session.ascending_note_count > 0
                    and prev_idx == session.ascending_note_count - 1
                    and new_idx == session.ascending_note_count):
                session.scale_passes_completed += 1
                session.last_pass_direction = "UP"
            # Detect descending pass (root reached — last note wraps to index 0).
            elif new_idx == 0 and prev_idx == len(session.notes) - 1:
                session.scale_passes_completed += 1
                session.last_pass_direction = "DOWN"

            # Difficulty scaling.
            session.speed_multiplier *= 1.05  # 5% increase per correct note

            # Move character to the lane matching the note just played.
            if expected_note.fret is not None:
                target = max(0, min(session.num_lanes - 1, expected_note.fret - session.base_fret))
                session.current_track = target

            return {
                "success": True,
                "game_state": {
                    "status": session.status,
                    "score": session.current_score,
                    "current_track": session.current_track,
                },
                "scale_passes_completed": session.scale_passes_completed,
                "last_pass_direction": session.last_pass_direction,
            }
        else:
            return {
                "success": False, 
                "error": "wrong_note",
                "game_state": {
                    "status": session.status,
                    "score": session.current_score
                }
            }

    def pause_session(self, session: GameSession):
        if session.status != "running":
            return
        session.status = "paused"
        session.paused_at_ms = int(time.time() * 1000)

    def resume_session(self, session: GameSession):
        if session.status != "paused" or session.paused_at_ms is None:
            return
        pause_duration = int(time.time() * 1000) - session.paused_at_ms
        # Shift started_at_ms forward so game_now = now - started_at_ms
        # remains equal to what it was at the moment of pause.
        session.started_at_ms += pause_duration
        session.paused_at_ms = None
        session.status = "running"

    def fail_session(self, session: GameSession, reason: str):
        session.status = "failed"
        session.ended_at_ms = int(time.time() * 1000)

    def get_session(self, session_id: str) -> Optional[GameSession]:
        return self.sessions.get(session_id)

    def remove_session(self, session_id: str):
        if session_id in self.sessions:
            del self.sessions[session_id]

    def cleanup_sessions(self, ttl_seconds: int = 3600):
        now_ms = int(time.time() * 1000)
        to_remove = []
        for sid, sess in self.sessions.items():
            if now_ms - sess.started_at_ms > ttl_seconds * 1000:
                to_remove.append(sid)
        for sid in to_remove:
            self.remove_session(sid)

    # -------------------------------------------------------------------------
    # Variant switching (feature 008-track-variants)
    # -------------------------------------------------------------------------

    def _is_playable_root(self, root_midi: int, instrument: Instrument) -> bool:
        # Lowest playable note = open string of lowest string; highest = top tuning + maxFret.
        if not instrument.tuning:
            return False
        lo = instrument.tuning[0] + 1
        hi = instrument.tuning[-1] + instrument.maxFret
        return lo <= root_midi <= hi

    def _candidate_root_for_side(self, session: GameSession, side: str) -> int:
        # RIGHT: 2 frets above the highest scale note the player just played.
        # LEFT: 2 frets below the current root.
        if side == "RIGHT":
            if not session.notes:
                return session.root_midi + 2
            return max(note.midi for note in session.notes) + 2
        else:
            return session.root_midi - VARIANT_SHIFT_DOWN

    def _variant_geometry(self, root_midi: int, instrument: Instrument, target_num_lanes: int, preferred_string: Optional[int] = None):
        """Compute variant base_fret + num_lanes anchored at the root.

        Independent of tabulator (which wraps pitch-class mod 12 and can yield
        wildly wide spans). Anchor the variant at the lowest string where the
        root sits in fret 1-18 and reserve a tight window matching target_num_lanes.
        The variant base note is therefore always at lane 0 of the variant set,
        which makes the "play the new root to switch" prompt visually obvious.
        Returns (base_fret, num_lanes, base_lane_index, base_string_1based_from_high)
        or None when unplayable.
        """
        def try_idx(idx):
            open_midi = instrument.tuning[idx]
            fret = root_midi - open_midi
            if 1 <= fret <= 18:
                base_fret = fret
                # Match target_num_lanes, clamped to the fretboard.
                num_lanes = target_num_lanes
                if base_fret + num_lanes - 1 > instrument.maxFret:
                    num_lanes = max(3, instrument.maxFret - base_fret + 1)
                base_string = instrument.stringCount - idx  # 1-based from HIGH
                return base_fret, num_lanes, 0, base_string
            return None

        # 1. Try preferred string first (keep it on the same string if possible)
        if preferred_string is not None:
            low_idx = instrument.stringCount - preferred_string
            if 0 <= low_idx < len(instrument.tuning):
                res = try_idx(low_idx)
                if res:
                    return res

        # 2. scan from lowest string upward.
        for low_idx in range(len(instrument.tuning)):
            res = try_idx(low_idx)
            if res:
                return res

        # Fall back to open string if no fretted placement fits.
        for low_idx, open_midi in enumerate(instrument.tuning):
            if root_midi == open_midi:
                base_string = instrument.stringCount - low_idx
                return 0, target_num_lanes, 0, base_string
        return None

    def _find_root_for_highest(self, scale_id: str, target_highest: int, instrument: Instrument):
        """Search for a root such that _build_full_scale_notes yields apex == target_highest.

        Used by RIGHT accept: variant.root_midi is the target apex, not the actual root.
        Returns (candidate_root, notes, asc_count) or (None, None, None) if no match found.
        """
        for semitone_offset in range(2, 49):
            candidate = target_highest - semitone_offset
            if not self._is_playable_root(candidate, instrument):
                continue
            notes, asc_count = self._build_full_scale_notes(scale_id, candidate, instrument)
            if notes and asc_count > 0 and asc_count < len(notes) and notes[asc_count - 1].midi == target_highest:
                return candidate, notes, asc_count
        return None, None, None

    def _fret_in_window(self, midi: int, instrument: Instrument, base_fret: int, num_lanes: int):
        """Find any (string, fret) playing `midi` inside the variant fret window.

        Returns (string_1based_from_HIGH, fret) or (None, None) if no string can
        play this midi within the window.
        """
        # tuning is LOW→HIGH; convert to HIGH-based 1-indexed strings on the way.
        for low_idx, open_midi in enumerate(instrument.tuning):
            fret = midi - open_midi
            if base_fret <= fret < base_fret + num_lanes:
                high_idx_1based = instrument.stringCount - low_idx
                return high_idx_1based, fret
        return None, None

    def propose_variant(self, session_id: str, now_ms: Optional[int] = None) -> dict:
        session = self.get_session(session_id)
        if not session:
            return {"success": False, "error": "session_not_found"}
        if session.status != "running":
            return {"success": False, "error": "game_not_running"}
        if session.active_variant is not None:
            return {"success": False, "error": "variant_already_active"}
        if session.scale_passes_completed < SCALES_PER_VARIANT:
            return {"success": False, "error": "milestone_not_reached"}

        instrument = get_instrument(session.instrument_id) or Instrument(
            id="default", name="Default", kind="guitar",
            stringCount=6, tuning=[40, 45, 50, 55, 59, 64], maxFret=24,
        )
        # Direction follows upcoming half-cycle: just descended (root) → about to go up → RIGHT.
        # Just ascended (apex) → about to go down → LEFT.
        if session.last_pass_direction is None:
            primary_side = "RIGHT"
        else:
            primary_side = "RIGHT" if session.last_pass_direction == "DOWN" else "LEFT"

        new_root = None
        side = None
        geom = None
        for candidate_side in (primary_side, "LEFT" if primary_side == "RIGHT" else "RIGHT"):
            candidate_root = self._candidate_root_for_side(session, candidate_side)
            if not self._is_playable_root(candidate_root, instrument):
                continue
            candidate_geom = self._variant_geometry(
                candidate_root, instrument, session.num_lanes,
                preferred_string=session.notes[0].string if session.notes else None,
            )
            if candidate_geom is not None:
                new_root = candidate_root
                side = candidate_side
                geom = candidate_geom
                break

        if geom is None:
            return {"success": False, "error": "no_playable_variant"}
        v_base_fret, v_num_lanes, v_base_lane, v_base_string = geom

        now_ms = now_ms if now_ms is not None else int(time.time() * 1000)
        variant = VariantTrackSet(
            variant_id=f"v-{session.session_id[:8]}-{session.scale_passes_completed}",
            root_midi=new_root,
            base_fret=v_base_fret,
            num_lanes=v_num_lanes,
            base_lane=v_base_lane,
            base_string=v_base_string,
            side=side,
            state="SPAWNING",
            spawned_at_ms=now_ms,
        )
        window = SwitchWindow(
            variant_id=variant.variant_id,
            opened_at_ms=now_ms,
            deadline_ms=now_ms + DEFAULT_WINDOW_MS,
            state="OPEN",
            trigger_midi=new_root,
        )
        session.active_variant = variant
        session.active_window = window
        # Transition spawn → active immediately; frontend handles fade-in animation.
        variant.state = "ACTIVE"
        logger.info(
            "variant.propose session=%s variant=%s side=%s root=%d base_fret=%d num_lanes=%d",
            session.session_id, variant.variant_id, side, new_root, v_base_fret, v_num_lanes,
        )
        return {"success": True, "variant": variant.model_dump(), "window": window.model_dump()}

    def accept_variant(self, session_id: str, midi: int, now_ms: Optional[int] = None) -> dict:
        session = self.get_session(session_id)
        if not session:
            return {"success": False, "error": "session_not_found"}
        if not session.active_variant or not session.active_window:
            return {"success": False, "error": "no_active_variant"}

        now_ms = now_ms if now_ms is not None else int(time.time() * 1000)
        if now_ms > session.active_window.deadline_ms:
            return {"success": False, "error": "window_expired"}
        if midi != session.active_window.trigger_midi:
            return {"success": False, "error": "wrong_midi"}

        variant = session.active_variant
        if variant.state == "ACCEPTED":
            return {"success": False, "error": "variant_already_accepted"}

        variant.state = "ACCEPTED"
        session.active_window.state = "ACCEPTED"
        session.variant_history.append({
            "variant_id": variant.variant_id,
            "root_midi": variant.root_midi,
            "side": variant.side,
            "decision": "ACCEPTED",
            "at_ms": now_ms,
        })
        logger.info(
            "variant.accept session=%s variant=%s",
            session.session_id, variant.variant_id,
        )
        # variant_lane_index: 0-indexed lane within the new scale where the character
        # lands (Story 6.8 AC-7). 0 = outermost (landing position). Default 0 — backend
        # can be extended later to return the variant note's actual lane within new scale.
        return {
            "success": True,
            "variant_id": variant.variant_id,
            "state": "accepted",
            "variant_lane_index": 0,
        }

    def _commit_variant_swap(self, session, variant, instrument) -> dict:
        """Perform the scale swap for a previously accepted variant. Called by promote_variant."""
        now_ms = int(time.time() * 1000)

        if variant.side == "LEFT":
            new_notes, new_asc_count = self._build_full_scale_notes(
                session.scale_id_for_variant, variant.root_midi, instrument
            )
            session.root_midi = variant.root_midi
            session.current_note_index = 1 if new_notes and len(new_notes) > 1 else 0
            session.total_notes_played = 1
        else:  # RIGHT
            candidate, new_notes, new_asc_count = self._find_root_for_highest(
                session.scale_id_for_variant, variant.root_midi, instrument
            )
            if candidate is not None:
                session.root_midi = candidate
                session.current_note_index = new_asc_count if new_notes and new_asc_count < len(new_notes) else 0
                session.total_notes_played = 1
            else:
                new_notes, new_asc_count = self._build_full_scale_notes(
                    session.scale_id_for_variant, session.root_midi, instrument
                )
                session.current_note_index = 0
                session.total_notes_played = 0

        session.notes = new_notes
        session.ascending_note_count = new_asc_count
        scale_frets = [n.fret for n in new_notes if n.fret is not None]
        session.base_fret = min(scale_frets) if scale_frets else variant.base_fret
        new_max_fret = max(scale_frets) if scale_frets else session.base_fret
        session.num_lanes = max(3, min(instrument.maxFret, (new_max_fret - session.base_fret) + 1))
        # Position character at the note the player just played (trigger note).
        # LEFT: trigger = root (notes[0]). RIGHT: trigger = apex (notes[asc_count - 1]).
        if variant.side == "RIGHT":
            _trigger_idx = (new_asc_count - 1) if new_notes and new_asc_count < len(new_notes) else 0
        else:
            _trigger_idx = 0
        if new_notes and 0 <= _trigger_idx < len(new_notes) and new_notes[_trigger_idx].fret is not None:
            session.current_track = max(0, min(session.num_lanes - 1, new_notes[_trigger_idx].fret - session.base_fret))
        else:
            session.current_track = 0
        session.scale_passes_completed = 0
        session.last_pass_direction = None
        session.speed_multiplier = 1.0

        variant.state = "PROMOTED"
        session.active_window.state = "CLOSED"
        session.variant_history.append({
            "variant_id": variant.variant_id,
            "root_midi": variant.root_midi,
            "side": variant.side,
            "decision": "PROMOTED",
            "at_ms": now_ms,
        })
        session.active_variant = None
        session.active_window = None
        logger.info(
            "variant.promote session=%s variant=%s new_root=%d base_fret=%d num_lanes=%d",
            session.session_id, variant.variant_id, session.root_midi, session.base_fret, session.num_lanes,
        )
        return {
            "success": True,
            "root_midi": session.root_midi,
            "base_fret": session.base_fret,
            "num_lanes": session.num_lanes,
            "current_track": session.current_track,
            "notes": [n.model_dump() for n in session.notes],
            "ascending_note_count": session.ascending_note_count,
            "current_note_index": session.current_note_index,
        }

    def promote_variant(self, session_id: str) -> dict:
        session = self.get_session(session_id)
        if not session:
            return {"success": False, "error": "session_not_found"}
        if session.status != "running":
            return {"success": False, "error": "game_not_running"}
        # Idempotency: if already promoted (active_variant cleared), return current scale state.
        if not session.active_variant:
            return {
                "success": True,
                "root_midi": session.root_midi,
                "base_fret": session.base_fret,
                "num_lanes": session.num_lanes,
                "notes": [n.model_dump() for n in session.notes],
                "ascending_note_count": session.ascending_note_count,
                "current_note_index": session.current_note_index,
            }
        variant = session.active_variant
        if variant.state != "ACCEPTED":
            return {"success": False, "error": "variant_not_accepted"}

        instrument = get_instrument(session.instrument_id) or Instrument(
            id="default", name="Default", kind="guitar",
            stringCount=6, tuning=[40, 45, 50, 55, 59, 64], maxFret=24,
        )
        return self._commit_variant_swap(session, variant, instrument)

    def dismiss_variant(self, session_id: str) -> dict:
        """Proximity-based dismiss: clear the active variant without checking the deadline."""
        session = self.get_session(session_id)
        if not session:
            return {"success": False, "error": "session_not_found"}
        # Half-state recovery: if either field exists but not both, still clean up.
        if not session.active_variant and not session.active_window:
            return {"success": True}  # idempotent
        variant = session.active_variant
        if variant:
            variant.state = "DISMISSED"
        if session.active_window:
            session.active_window.state = "CLOSED"
        if variant:
            session.variant_history.append({
                "variant_id": variant.variant_id,
                "root_midi": variant.root_midi,
                "side": variant.side,
                "decision": "DISMISSED",
                "at_ms": int(time.time() * 1000),
            })
        session.active_variant = None
        session.active_window = None
        session.scale_passes_completed = 0
        # Preserve last_pass_direction — drives RIGHT/LEFT alternation on next propose.
        # Only accept_variant resets it (player committed to a new scale).
        logger.info(
            "variant.dismiss session=%s variant=%s side=%s",
            session.session_id,
            variant.variant_id if variant else None,
            variant.side if variant else None,
        )
        return {"success": True}

    def timeout_variant(self, session_id: str, now_ms: Optional[int] = None) -> dict:
        session = self.get_session(session_id)
        if not session:
            return {"success": False, "error": "session_not_found"}
        if not session.active_variant or not session.active_window:
            return {"success": False, "error": "no_active_variant"}

        now_ms = now_ms if now_ms is not None else int(time.time() * 1000)
        if now_ms < session.active_window.deadline_ms:
            return {"success": False, "error": "window_not_expired"}

        variant = session.active_variant
        variant.state = "TIMEOUT"
        session.active_window.state = "CLOSED"
        session.variant_history.append({
            "variant_id": variant.variant_id,
            "root_midi": variant.root_midi,
            "side": variant.side,
            "decision": "TIMED_OUT",
            "at_ms": now_ms,
        })
        session.active_variant = None
        session.active_window = None
        # Reset pass counter so the player earns 3 more half-cycles before next offer.
        session.scale_passes_completed = 0
        session.last_pass_direction = None
        logger.info(
            "variant.timeout session=%s variant=%s side=%s",
            session.session_id, variant.variant_id, variant.side,
        )
        return {"success": True}
