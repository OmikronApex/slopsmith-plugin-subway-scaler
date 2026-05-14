import pytest
from services.game_engine import GameEngine

def test_create_session():
    """T007: Unit test for GameEngine.create_session"""
    engine = GameEngine()
    session = engine.create_session(scale_id="major", difficulty="easy")
    
    assert session.session_id is not None
    assert session.scale_id == "major"
    assert session.status == "running"
    assert engine.get_session(session.session_id) == session


def test_no_duplicate_root_at_loop_boundary():
    """Descending scale must not end on root (which duplicates index 0 when looping)."""
    engine = GameEngine()
    session = engine.create_session(scale_id="natural-minor", root_midi=33)
    notes = session.notes
    # Last note must differ from first note (root) so loop wrap has no duplicate
    assert notes[-1].midi != notes[0].midi, (
        f"Last note {notes[-1].midi} equals root {notes[0].midi} — duplicate root on loop"
    )
