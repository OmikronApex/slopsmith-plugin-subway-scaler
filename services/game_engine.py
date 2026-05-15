from __future__ import annotations
import logging
import uuid
import time
import random
from typing import Literal, Optional, Dict, List
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
from services.schemas import (
    Note, CartWave, GameState, Track, SpeedMultiplier, Instrument,
    VariantTrackSet, SwitchWindow,
)
from services.scales import expand
from services.tabulator import Tabulator
from services.instruments import get as get_instrument

# Variant feature: offer a variant track set every N completed octave loops.
OCTAVES_PER_VARIANT = 2
# Default switch window = next cart wave duration (clamped 4-8s).
DEFAULT_WINDOW_MS = 10000
# Variant root is shifted by a full note (2 semitones) for lower pitch,
# and 5 semitones for higher pitch (to avoid overlap).
VARIANT_SHIFT_UP = 5
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
    next_deadline_ms: int = 0
    waves: List[CartWave] = []
    base_fret: int = 0
    num_lanes: int = 6
    # Index into `notes` for the NEXT wave to spawn. Advances per wave
    # generated, independent of player input — waves come continuously.
    next_wave_note_index: int = 1
    total_waves_spawned: int = 0
    total_notes_played: int = 0
    required_timestamp_ms: int = 0
    # --- Variant switching (008-track-variants) ---
    root_midi: int = 60
    instrument_id: str = "guitar-standard"
    scale_id_for_variant: str = "major"
    octave_loops_completed: int = 0
    active_variant: Optional[VariantTrackSet] = None
    active_window: Optional[SwitchWindow] = None
    last_variant_side: Optional[str] = None
    variant_history: List[dict] = []

class GameEngine:
    def __init__(self):
        self.sessions: Dict[str, GameSession] = {}
        self.tabulator = Tabulator()

    def create_session(self, scale_id: str, difficulty: str = "easy", root_midi: int = 60, octaves: int = 1, descending: bool = False, instrument_id: str = "guitar-standard") -> GameSession:
        self.cleanup_sessions()
        
        # Force 1 octave and descending as requested by user for endless loop
        octaves = 1
        descending = True
        
        notes = expand(scale_id, root_midi=root_midi, octaves=octaves, descending=descending)
        # Drop the last note: descending ends on root, which duplicates index 0 when looping
        if descending and len(notes) > 1:
            notes = notes[:-1]
        
        instrument = get_instrument(instrument_id)
        if not instrument:
            # Fallback to default guitar if not found
            instrument = Instrument(id="default", name="Default", kind="guitar", stringCount=6, tuning=[40, 45, 50, 55, 59, 64], maxFret=24)

        # Use Tabulator to get natural finger patterns
        from services.scales import get_scale as get_scale_def
        scale_def = get_scale_def(scale_id)
        root_name = notes[0].name if notes else "C"
        pattern = self.tabulator.encode_scale(scale_def, root_name, instrument.tuning)
        
        # Map pattern to notes
        for i, note in enumerate(notes):
            if i < len(pattern.pattern):
                p = pattern.pattern[i]
                note.string = p.string
                note.fret = p.fret
            elif i >= len(pattern.pattern) and descending:
                # Handle descending part by mirroring the pattern
                # The expand function generates ascending then descending
                # Pattern only covers ascending.
                # Midis: [C, D, E, F, G, A, B, C, B, A, G, F, E, D]
                # Pattern: [C, D, E, F, G, A, B, C]
                # For notes[8] (B), we use pattern[6] (B).
                # Length of ascending part is len(pattern.pattern)
                asc_len = len(pattern.pattern)
                if i < 2 * asc_len - 1:
                    mirror_idx = (2 * asc_len - 2) - i
                    if 0 <= mirror_idx < asc_len:
                        p = pattern.pattern[mirror_idx]
                        note.string = p.string
                        note.fret = p.fret

        # Calculate base_fret (min fret used in the scale)
        scale_frets = [n.fret for n in notes if n.fret is not None]
        base_fret = min(scale_frets) if scale_frets else 0
        max_fret = max(scale_frets) if scale_frets else base_fret
        
        # Dynamic track count based on fret span
        num_lanes = (max_fret - base_fret) + 1
        # Minimum 3 lanes for playability/visuals, max 12 just in case
        num_lanes = max(3, min(12, num_lanes))
        
        # First wave safe track corresponds to the first note's fret index
        first_safe_track = (notes[0].fret - base_fret) if notes and notes[0].fret is not None else 0
        # Clamp to available lanes
        first_safe_track = max(0, min(num_lanes - 1, first_safe_track))
        
        # Random starting track that is NOT the safe track
        possible_tracks = [t for t in range(num_lanes) if t != first_safe_track]
        start_track = random.choice(possible_tracks) if possible_tracks else first_safe_track
        
        # Determine duration based on difficulty
        # easy: 4000, medium: 2500, hard: 1500
        duration_map = {"easy": 4000, "medium": 2500, "hard": 1500}
        base_duration = duration_map.get(difficulty, 2500)
        
        # Speed to cross 50 units in base_duration ms (with 0.5 factor in frontend)
        # 50 = duration * speed * 0.5  => speed = 100 / duration
        base_speed = 100.0 / base_duration
        
        first_wave = CartWave(
            wave_id="w-0",
            wave_index=0,
            safe_track=first_safe_track,
            safe_string=notes[0].string if notes else None,
            safe_midi=notes[0].midi if notes else None,
            note_name=notes[0].name if notes else None,
            spawn_time_ms=0,
            speed_px_per_ms=base_speed,
            duration_ms=base_duration
        )
        
        session = GameSession(
            scale_id=scale_id,
            difficulty=difficulty,
            notes=notes,
            current_track=start_track,
            waves=[first_wave],
            total_waves_spawned=1,
            next_deadline_ms=base_duration, # T_reach_0
            base_fret=base_fret,
            num_lanes=num_lanes,
            root_midi=root_midi,
            instrument_id=instrument_id,
            scale_id_for_variant=scale_id,
        )
        self.sessions[session.session_id] = session
        return session

    def play_note(self, session_id: str, midi: int, timing_ms: int) -> dict:
        session = self.get_session(session_id)
        if not session:
            return {"success": False, "error": "session_not_found"}
        
        if session.status != "running":
            return {"success": False, "error": "game_not_running"}
            
        # Check deadline: removed as failure should only occur on collision with a cart.
        # We still keep next_deadline_ms internally for wave spacing.
        pass

        if timing_ms < session.required_timestamp_ms:
            return {"success": False, "error": "too_early"}

        expected_note = session.notes[session.current_note_index]
        if midi == expected_note.midi:
            session.current_score += 100
            prev_idx = session.current_note_index
            # Find the wave that was spawned for this note instance to set the next gate.
            target_wave = next((w for w in session.waves if w.wave_index == session.total_notes_played), None)
            if target_wave:
                session.required_timestamp_ms = target_wave.spawn_time_ms + target_wave.duration_ms
            
            session.total_notes_played += 1
            session.current_note_index = (session.current_note_index + 1) % len(session.notes)
            # Detect completion of an asc+desc octave loop (last index → 0).
            if session.current_note_index == 0 and prev_idx == len(session.notes) - 1:
                session.octave_loops_completed += 1

            # Difficulty scaling.
            session.speed_multiplier *= 1.05  # 5% increase per correct note

            # Move character to the lane that matches the note just played
            # (its fret offset within the current track window). Wave spawning
            # is now driven independently by update_session_state, so no waves
            # are appended here and the wave queue keeps flowing regardless of
            # player input.
            if expected_note.fret is not None:
                target = max(0, min(session.num_lanes - 1, expected_note.fret - session.base_fret))
                session.current_track = target

            return {
                "success": True,
                "game_state": {
                    "status": session.status,
                    "score": session.current_score,
                    "current_track": session.current_track,
                    "required_timestamp_ms": session.required_timestamp_ms,
                },
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

    def fail_session(self, session: GameSession, reason: str):
        session.status = "failed"
        session.ended_at_ms = int(time.time() * 1000)

    # How many milliseconds to keep queued ahead of the current game time.
    # Frontend polls every 200ms.
    WAVE_LOOKAHEAD_MS = 10000
    
    # Adjusts distance between waves. < 1.0 means closer together / spawn earlier.
    WAVE_SPACING_FACTOR = 0.4

    def update_session_state(self, session: GameSession):
        if session.status != "running":
            return
        # Top up the wave queue so carts keep coming whether or not the player
        # plays anything. Each generated wave advances next_wave_note_index
        # through the scale.
        if not session.notes:
            return

        now_ms = int(time.time() * 1000)
        game_now = now_ms - session.started_at_ms

        # Prune old waves that are far in the past (e.g. 10s past their exit).
        # This keeps the session.waves list from growing indefinitely.
        session.waves = [
            w for w in session.waves 
            if w.spawn_time_ms + w.duration_ms > game_now - 10000
        ]

        duration_map = {"easy": 4000, "medium": 2500, "hard": 1500}
        base_duration = duration_map.get(session.difficulty, 2500)
        
        # Continue spawning until we have at least WAVE_LOOKAHEAD_MS in the future.
        while session.next_deadline_ms < game_now + self.WAVE_LOOKAHEAD_MS:
            # Bump deadline FIRST so this wave's spawn lands after the prior
            # wave's reach time.
            session.next_deadline_ms += (base_duration * self.WAVE_SPACING_FACTOR) / session.speed_multiplier
            next_note = session.notes[session.next_wave_note_index]
            next_wave = self.generate_next_wave(session, next_note)
            session.waves.append(next_wave)
            session.next_wave_note_index = (session.next_wave_note_index + 1) % len(session.notes)
            session.total_waves_spawned += 1

    def generate_next_wave(self, session: GameSession, next_note: Note) -> CartWave:
        # Safe track is now fret-based: fret relative to base_fret
        safe_track = (next_note.fret - session.base_fret) if next_note.fret is not None else 0
        # Clamp to available lanes
        safe_track = max(0, min(session.num_lanes - 1, safe_track))
        
        duration_map = {"easy": 4000, "medium": 2500, "hard": 1500}
        base_duration = duration_map.get(session.difficulty, 2500)
        
        # Speed increases with multiplier
        # 50 = (duration / mult) * (base_speed * mult) * 0.5
        # So base_speed = 100 / duration
        base_speed = 100.0 / base_duration
        current_speed = base_speed * session.speed_multiplier
        
        # spawn_time_ms_i = sum(j=0 to i-1) of (base_duration / multiplier_j)
        # We can calculate this from the last wave's spawn time and multiplier
        
        # We need the multiplier that was active when last wave was generated.
        # This is slightly tricky. Let's assume the gap is based on the current (increased) multiplier.
        # Actually, to be precise, the gap between w_{i-1} and w_i should be base_duration / mult_{i-1}.
        
        # Let's just use the next_deadline_ms which is already t_reach_i.
        # t_reach_i = session.next_deadline_ms
        # duration_focus_i = 30 / (current_speed * 0.5) = 60 / current_speed = base_duration / mult
        # spawn_time_i = t_reach_i - (base_duration / mult)
        
        current_focus_duration = base_duration / session.speed_multiplier
        spawn_time_ms = session.next_deadline_ms - current_focus_duration
        
        return CartWave(
            wave_id=f"w-{session.total_waves_spawned}",
            wave_index=session.total_waves_spawned,
            safe_track=safe_track,
            safe_string=next_note.string,
            safe_midi=next_note.midi,
            note_name=next_note.name,
            spawn_time_ms=int(spawn_time_ms),
            speed_px_per_ms=current_speed,
            duration_ms=int(current_focus_duration)
        )

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

    def _next_side(self, session: GameSession, instrument: Instrument) -> Optional[str]:
        # Alternate; fall back to same; None if neither is playable.
        prefer = "RIGHT" if session.last_variant_side == "LEFT" else "LEFT"
        other = "LEFT" if prefer == "RIGHT" else "RIGHT"
        for side in (prefer, other):
            candidate = self._candidate_root_for_side(session.root_midi, side)
            if self._is_playable_root(candidate, instrument):
                return side
        return None

    @staticmethod
    def _candidate_root_for_side(current_root: int, side: str) -> int:
        # RIGHT = higher pitch; LEFT = lower pitch.
        if side == "RIGHT":
            return current_root + VARIANT_SHIFT_UP
        else:
            return current_root - VARIANT_SHIFT_DOWN

    def _variant_geometry(self, root_midi: int, instrument: Instrument, target_num_lanes: int, preferred_string: Optional[int] = None):
        """Compute variant base_fret + num_lanes anchored at the root.

        Independent of tabulator (which wraps pitch-class mod 12 and can yield
        wildly wide spans). Anchor the variant at the lowest string where the
        root sits in fret 1-12 and reserve a tight window matching target_num_lanes.
        The variant base note is therefore always at lane 0 of the variant set,
        which makes the "play the new root to switch" prompt visually obvious.
        Returns (base_fret, num_lanes, base_lane_index, base_string_1based_from_high)
        or None when unplayable.
        """
        def try_idx(idx):
            open_midi = instrument.tuning[idx]
            fret = root_midi - open_midi
            if 1 <= fret <= 12:
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
        if session.octave_loops_completed < OCTAVES_PER_VARIANT:
            return {"success": False, "error": "milestone_not_reached"}

        instrument = get_instrument(session.instrument_id) or Instrument(
            id="default", name="Default", kind="guitar",
            stringCount=6, tuning=[40, 45, 50, 55, 59, 64], maxFret=24,
        )
        side = self._next_side(session, instrument)
        if side is None:
            return {"success": False, "error": "no_playable_variant"}

        new_root = self._candidate_root_for_side(session.root_midi, side)
        # Clean geometry: tight window matching the session's track count
        # anchored at the variant's root fret. Independent of tabulator's 
        # pitch-class wrap, which can produce 11-lane variants for roots like C 
        # that wrap from fret 8 to fret 0.
        preferred_string = session.notes[0].string if session.notes else None
        geom = self._variant_geometry(new_root, instrument, session.num_lanes, preferred_string=preferred_string)
        if geom is None:
            return {"success": False, "error": "no_playable_variant"}
        v_base_fret, v_num_lanes, v_base_lane, v_base_string = geom

        now_ms = now_ms if now_ms is not None else int(time.time() * 1000)
        variant = VariantTrackSet(
            variant_id=f"v-{session.session_id[:8]}-{session.octave_loops_completed}",
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
        variant.state = "SWITCH_TRIGGERED"
        session.active_window.state = "SWITCHED"

        # Reseat session on the new root using the variant's clean geometry.
        old_base_fret = session.base_fret
        session.root_midi = variant.root_midi
        session.base_fret = variant.base_fret
        session.num_lanes = variant.num_lanes

        # Adjust existing waves to stay on the same absolute frets relative to the new base_fret.
        fret_diff = old_base_fret - session.base_fret
        for wave in session.waves:
            wave.safe_track += fret_diff
        # Rebuild notes for the new root and assign frets within the variant
        # window (so safe_track calculation stays consistent with the rendered
        # tracks). Skip tabulator here — it wraps modulo 12 and would push notes
        # outside the window.
        new_notes = expand(session.scale_id_for_variant, root_midi=variant.root_midi, octaves=1, descending=True)
        if len(new_notes) > 1:
            new_notes = new_notes[:-1]
        instrument = get_instrument(session.instrument_id)
        for note in new_notes:
            s, f = self._fret_in_window(note.midi, instrument, variant.base_fret, variant.num_lanes)
            if s is not None:
                note.string = s
                note.fret = f
        session.notes = new_notes
        session.current_note_index = 1 % len(new_notes) if new_notes else 0
        session.total_notes_played = 1
        session.required_timestamp_ms = 0 # Allow next note immediately after switch
        session.current_track = variant.base_lane
        session.octave_loops_completed = 0
        
        # Reset speed to difficulty base (multiplier 1.0) to give the player a breather.
        session.speed_multiplier = 1.0
        
        # Clear all waves so the new scale starts fresh.
        now_real = int(time.time() * 1000)
        game_now = now_real - session.started_at_ms
        session.waves = []
        
        # Start next wave after a small delay (base_duration)
        duration_map = {"easy": 4000, "medium": 2500, "hard": 1500}
        base_duration = duration_map.get(session.difficulty, 2500)
        session.next_deadline_ms = game_now + base_duration

        # Restart the wave-spawn cursor so upcoming waves match the new scale.
        # Starting from index 1 because the root (index 0) was just played.
        session.next_wave_note_index = 1 % len(new_notes) if new_notes else 0

        # Finalize variant state.
        variant.state = "SWITCHED"
        session.last_variant_side = variant.side
        session.variant_history.append({
            "variant_id": variant.variant_id,
            "root_midi": variant.root_midi,
            "side": variant.side,
            "decision": "SWITCHED",
            "at_ms": now_ms,
        })
        session.active_variant = None
        session.active_window = None
        logger.info(
            "variant.accept session=%s variant=%s new_root=%d base_fret=%d num_lanes=%d",
            session.session_id, variant.variant_id, variant.root_midi, variant.base_fret, variant.num_lanes,
        )
        return {
            "success": True,
            "root_midi": session.root_midi,
            "base_fret": session.base_fret,
            "num_lanes": session.num_lanes,
            "notes": [n.model_dump() for n in session.notes],
            "required_timestamp_ms": session.required_timestamp_ms,
        }

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
        session.last_variant_side = variant.side
        session.variant_history.append({
            "variant_id": variant.variant_id,
            "root_midi": variant.root_midi,
            "side": variant.side,
            "decision": "TIMED_OUT",
            "at_ms": now_ms,
        })
        session.active_variant = None
        session.active_window = None
        # Reset milestone counter so the player must earn the next offer.
        # Without this, the next poll (200ms later) would immediately propose
        # another variant on the opposite side and the camera would jerk back.
        session.octave_loops_completed = 0
        logger.info(
            "variant.timeout session=%s variant=%s side=%s",
            session.session_id, variant.variant_id, variant.side,
        )
        return {"success": True}
