from fastapi import APIRouter, HTTPException
from services.schemas import Track, GameState, SpeedMultiplier, Note
from services.game_engine import GameEngine
from services.scales import SCALES, midi_to_name
from services.instruments import INSTRUMENTS
from services.tabulator import Tabulator
from services.errors import error_response

router = APIRouter(prefix="/api/plugins/subway-scaler/game", tags=["game"])
engine = GameEngine()
tabulator = Tabulator()


@router.get("/session-config")
async def get_session_config(
    scale_id: str,
    root_midi: int,
    instrument_id: str,
):
    """Returns session config: scale notes with fret/string positions.

    AC-1: Returns scale notes with fret/string positions for given scale/root/instrument.
    AC-2: Fret values computed by Tabulator (verified against tests).
    AC-3: track_count = distinct frets, clamped 3-12.
    AC-4: Unknown scale → 404, invalid root_midi → 422.
    """
    # Validate root_midi in valid range [21, 108]
    if not (21 <= root_midi <= 108):
        return error_response(
            code="INVALID_ROOT",
            message=f"root_midi must be in range [21, 108], got {root_midi}",
            status=422,
        )

    # Get scale from registry
    scale = SCALES.get(scale_id)
    if not scale:
        return error_response(
            code="SCALE_NOT_FOUND",
            message=f"Unknown scale_id: {scale_id}",
            status=404,
        )

    # Get instrument from registry
    instrument = INSTRUMENTS.get(instrument_id)
    if not instrument:
        return error_response(
            code="INSTRUMENT_NOT_FOUND",
            message=f"Unknown instrument_id: {instrument_id}",
            status=404,
        )

    # Convert root_midi to root_note (e.g., 60 → "C4")
    root_note = midi_to_name(root_midi)

    # Get fret/string pattern from Tabulator
    try:
        pattern = tabulator.encode_scale(scale, root_note, instrument.tuning)
    except Exception as e:
        return error_response(
            code="TABULATION_ERROR",
            message=str(e),
            status=400,
        )

    # Build notes array by expanding scale intervals
    notes = []
    for interval, fret_pair in zip(scale.intervals, pattern.pattern):
        midi = root_midi + interval
        note_name = midi_to_name(midi)
        notes.append({
            "midi": midi,
            "name": note_name,
            "string": fret_pair.string,
            "fret": fret_pair.fret,
        })

    # Calculate track_count: distinct frets, clamped 3-12
    distinct_frets = set(note["fret"] for note in notes)
    track_count = max(3, min(12, len(distinct_frets)))

    return {
        "scale_id": scale_id,
        "root_midi": root_midi,
        "instrument_id": instrument_id,
        "notes": notes,
        "track_count": track_count,
    }


@router.get("/notes/{note_id}")
async def get_note_timing(note_id: str):
    """Returns timing information for a specific note.
    """
    return {
        "note_id": note_id,
        "timer_window_ms": 2500.0,
        "timer_window_tolerance_ms": 50.0
    }

@router.post("/start")
async def start_game(payload: dict):
    """Initializes the game session with a note sequence.
    """
    scale_id = payload.get("scale_id", "major")
    difficulty = payload.get("difficulty", "easy")
    root_midi = payload.get("root_midi", 60)
    octaves = payload.get("octaves", 1)
    descending = payload.get("descending", False)
    instrument_id = payload.get("instrument_id", "guitar-standard")
    
    try:
        session = engine.create_session(
            scale_id, 
            difficulty, 
            root_midi=root_midi, 
            octaves=octaves, 
            descending=descending,
            instrument_id=instrument_id
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    track = Track(
        length=20.0,
        spawn_z=-50.0,
        exit_boundary=0.0,
        interaction_point_z=-5.0,
        queue_positions=[-5.0, -10.0]
    )
    
    game_state = GameState(
        carts=[],
        track=track,
        speed_multiplier=SpeedMultiplier(current_value=session.speed_multiplier)
    )
    
    duration_map = {"easy": 4000, "medium": 2500, "hard": 1500}
    base_duration_ms = duration_map.get(session.difficulty, 2500)
    timing_params = {
        "base_duration_ms": base_duration_ms,
        "wave_spacing_factor": 0.4,
        "wave_lookahead_ms": 10000,
        "speed_increment_per_note": 0.05,
    }

    return {
        "session_id": session.session_id,
        "initial_track": session.current_track,
        "base_fret": session.base_fret,
        "num_lanes": session.num_lanes,
        "notes": session.notes,
        "root_note": session.notes[0] if session.notes else None,
        "timing_params": timing_params,
        "game_state": game_state
    }

@router.post("/{session_id}/play-note")
async def play_note_route(session_id: str, payload: dict):
    """Handles note play event and updates game state.
    """
    midi = payload.get("midi")
    timing_ms = payload.get("timing_ms", 0)
    
    if midi is None:
        raise HTTPException(status_code=400, detail="midi note is required")
        
    result = engine.play_note(session_id, midi, timing_ms)
    
    if not result["success"]:
        if result["error"] == "session_not_found":
            raise HTTPException(status_code=404, detail="Session not found")
        return result
        
    return result

@router.get("/{session_id}")
async def get_session_route(session_id: str):
    """Returns the full session state.
    """
    session = engine.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    track = Track(
        length=20.0,
        spawn_z=-50.0,
        exit_boundary=0.0,
        interaction_point_z=-5.0,
        queue_positions=[-5.0, -10.0]
    )
    
    game_state = GameState(
        carts=[],
        track=track,
        speed_multiplier=SpeedMultiplier(current_value=session.speed_multiplier)
    )
    
    return {
        "session_id": session.session_id,
        "status": session.status,
        "game_state": {
            **game_state.model_dump(),
            "required_timestamp_ms": session.required_timestamp_ms,
        },
        "score": session.current_score,
        "current_note_index": session.current_note_index,
        "next_expected_note": session.notes[session.current_note_index] if session.notes else None,
        # Variant exposure (feature 008-track-variants).
        "octave_loops_completed": session.octave_loops_completed,
        "active_variant": session.active_variant.model_dump() if session.active_variant else None,
        "active_window": session.active_window.model_dump() if session.active_window else None,
    }

@router.post("/{session_id}/pause")
async def pause_session_route(session_id: str):
    session = engine.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    engine.pause_session(session)
    return {"status": session.status}


@router.post("/{session_id}/resume")
async def resume_session_route(session_id: str):
    session = engine.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    engine.resume_session(session)
    return {"status": session.status}


# -----------------------------------------------------------------------------
# Variant switching (feature 008-track-variants)
# -----------------------------------------------------------------------------

@router.post("/{session_id}/variant/propose")
async def propose_variant(session_id: str, payload: dict | None = None):
    """Offer a variant track set if a milestone is reached."""
    now_ms = (payload or {}).get("now_ms") if payload else None
    result = engine.propose_variant(session_id, now_ms=now_ms)
    if not result["success"] and result.get("error") == "session_not_found":
        raise HTTPException(status_code=404, detail="Session not found")
    return result


@router.post("/{session_id}/variant/accept")
async def accept_variant(session_id: str, payload: dict):
    """Accept the active variant by playing its root MIDI within the switch window."""
    midi = payload.get("midi")
    now_ms = payload.get("now_ms")
    if midi is None:
        raise HTTPException(status_code=400, detail="midi is required")
    result = engine.accept_variant(session_id, midi, now_ms=now_ms)
    if not result["success"] and result.get("error") == "session_not_found":
        raise HTTPException(status_code=404, detail="Session not found")
    return result


@router.post("/{session_id}/variant/timeout")
async def timeout_variant(session_id: str, payload: dict | None = None):
    """Mark the active variant as timed out (deadline passed)."""
    now_ms = (payload or {}).get("now_ms") if payload else None
    result = engine.timeout_variant(session_id, now_ms=now_ms)
    if not result["success"] and result.get("error") == "session_not_found":
        raise HTTPException(status_code=404, detail="Session not found")
    return result
