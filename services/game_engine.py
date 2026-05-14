from __future__ import annotations
import uuid
import time
import random
from typing import Literal, Optional, Dict, List
from pydantic import BaseModel, Field
from services.schemas import Note, CartWave, GameState, Track, SpeedMultiplier, Instrument
from services.scales import expand
from services.tabulator import Tabulator
from services.instruments import get as get_instrument

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
        
        # Speed to cross 30 units in base_duration ms (with 0.5 factor in frontend)
        # 30 = duration * speed * 0.5  => speed = 60 / duration
        base_speed = 60.0 / base_duration
        
        first_wave = CartWave(
            wave_id="w-0",
            safe_track=first_safe_track,
            safe_string=notes[0].string if notes else None,
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
            next_deadline_ms=base_duration, # T_reach_0
            base_fret=base_fret,
            num_lanes=num_lanes
        )
        self.sessions[session.session_id] = session
        return session

    def play_note(self, session_id: str, midi: int, timing_ms: int) -> dict:
        session = self.get_session(session_id)
        if not session:
            return {"success": False, "error": "session_not_found"}
        
        if session.status != "running":
            return {"success": False, "error": "game_not_running"}
            
        # Check deadline with 500ms grace period to account for latency and visual drift
        if timing_ms > session.next_deadline_ms + 500:
            self.fail_session(session, "deadline_exceeded")
            return {
                "success": False,
                "error": "too_late",
                "game_state": {
                    "status": session.status,
                    "score": session.current_score
                }
            }

        expected_note = session.notes[session.current_note_index]
        if midi == expected_note.midi:
            session.current_score += 100
            session.current_note_index = (session.current_note_index + 1) % len(session.notes)
            
            # Difficulty scaling
            session.speed_multiplier *= 1.05 # 5% increase per correct note
            
            # Update track to the safe track of the wave they just passed
            if session.waves:
                session.current_track = session.waves[-1].safe_track
                
            # Update deadline BEFORE generating next wave so spawn_time is calculated correctly
            session.next_deadline_ms += (2500.0 / session.speed_multiplier) if session.difficulty == "medium" else (4000.0 / session.speed_multiplier if session.difficulty == "easy" else 1500.0 / session.speed_multiplier)

            # Generate next wave
            next_note = session.notes[session.current_note_index]
            next_wave = self.generate_next_wave(session, next_note)
            session.waves.append(next_wave)
            
            return {
                "success": True,
                "game_state": {
                    "status": session.status,
                    "score": session.current_score,
                    "current_track": session.current_track
                },
                "next_wave": next_wave
            }
        else:
            self.fail_session(session, "wrong_note")
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

    def update_session_state(self, session: GameSession):
        if session.status != "running":
            return
        
        now_ms = int(time.time() * 1000)
        elapsed_ms = now_ms - session.started_at_ms
        
        # Check for timeout (doing nothing)
        # Use a generous grace period (1000ms) to avoid race conditions with poll latency
        if elapsed_ms > session.next_deadline_ms + 1000:
            self.fail_session(session, "timeout")

    def generate_next_wave(self, session: GameSession, next_note: Note) -> CartWave:
        wave_idx = len(session.waves)
        # Safe track is now fret-based: fret relative to base_fret
        safe_track = (next_note.fret - session.base_fret) if next_note.fret is not None else 0
        # Clamp to available lanes
        safe_track = max(0, min(session.num_lanes - 1, safe_track))
        
        duration_map = {"easy": 4000, "medium": 2500, "hard": 1500}
        base_duration = duration_map.get(session.difficulty, 2500)
        
        # Speed increases with multiplier
        # 30 = (duration / mult) * (base_speed * mult) * 0.5
        # So base_speed = 60 / duration
        base_speed = 60.0 / base_duration
        current_speed = base_speed * session.speed_multiplier
        
        # spawn_time_ms_i = sum(j=0 to i-1) of (base_duration / multiplier_j)
        # We can calculate this from the last wave's spawn time and multiplier
        last_wave = session.waves[-1]
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
            wave_id=f"w-{wave_idx}",
            safe_track=safe_track,
            safe_string=next_note.string,
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
