import pytest
from services.game_engine import GameEngine

def test_initial_track_randomization():
    """Verify that initial track is not the same as the first note's track."""
    engine = GameEngine()

    for _ in range(10):
        session = engine.create_session(scale_id="major")
        first_note_track = (session.notes[0].fret - session.base_fret)
        assert session.current_track != first_note_track, f"Started on root track {first_note_track}"
