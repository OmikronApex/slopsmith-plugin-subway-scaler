import pytest
from services.game_engine import GameEngine

def test_play_note_logic():
    """T008: Unit test for GameEngine.play_note (logic)"""
    engine = GameEngine()
    session = engine.create_session(scale_id="major")
    
    # This should FAIL initially as play_note is not yet implemented in GameEngine
    result = engine.play_note(session.session_id, midi=60, timing_ms=100)
    
    assert result["success"] is True
    assert session.current_score > 0
