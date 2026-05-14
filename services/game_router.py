from fastapi import APIRouter, HTTPException
from services.schemas import Track, GameState, SpeedMultiplier, Note
from services.speed_service import SpeedService
from services.note_service import NoteService
from services.game_engine import GameEngine

router = APIRouter(prefix="/api/plugins/subway-scaler/game", tags=["game"])
engine = GameEngine()
speed_service = SpeedService()
note_service: NoteService = None

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
        spawn_z=-20.0,
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
        "initial_track": session.current_track,
        "base_fret": session.base_fret,
        "num_lanes": session.num_lanes,
        "notes": session.notes,
        "root_note": session.notes[0] if session.notes else None,
        "waves": session.waves,
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
        
    engine.update_session_state(session)
    
    track = Track(
        length=20.0,
        spawn_z=-20.0,
        exit_boundary=0.0,
        interaction_point_z=-5.0,
        queue_positions=[-5.0, -10.0]
    )
    
    game_state = GameState(
        carts=[],
        track=track,
        speed_multiplier=SpeedMultiplier(current_value=session.speed_multiplier)
    )
    
    # Return all waves so frontend can render them
    waves = session.waves[-10:] # Return last 10 waves
    
    return {
        "session_id": session.session_id,
        "status": session.status,
        "game_state": {
            **game_state.model_dump(),
            "waves": waves
        },
        "score": session.current_score,
        "current_note_index": session.current_note_index,
        "next_expected_note": session.notes[session.current_note_index] if session.notes else None
    }

@router.post("/reset")
async def reset_game():
    """Resets the speed multiplier and game state.
    """
    speed_service.reset()
    return {"status": "reset"}
