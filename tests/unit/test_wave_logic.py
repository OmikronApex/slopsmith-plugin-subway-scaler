import pytest
from services.game_engine import GameEngine

def test_wave_timing_overlap_bug():
    """Reproduce the bug where wave 1 reaches player at the same time as wave 0."""
    engine = GameEngine()
    # Use medium difficulty: duration = 2500ms
    session = engine.create_session(scale_id="major", difficulty="medium")
    
    assert len(session.waves) == 1
    w0 = session.waves[0]
    assert w0.spawn_time_ms == 0
    assert session.next_deadline_ms == 2500
    
    # Play note 0
    engine.play_note(session.session_id, midi=session.notes[0].midi, timing_ms=500)
    
    assert len(session.waves) == 2
    w1 = session.waves[1]
    
    # Wave 0 reaches at: spawn_0 + duration_0 = 0 + 2500 = 2500
    reach_0 = w0.spawn_time_ms + w0.duration_ms
    # Wave 1 reaches at: spawn_1 + duration_1
    reach_1 = w1.spawn_time_ms + w1.duration_ms
    
    print(f"Wave 0 reaches at {reach_0}")
    print(f"Wave 1 reaches at {reach_1}")
    
    # The bug is that they reach at roughly the same time (2500ms)
    # They should be separated by the duration of the wave.
    assert reach_1 > reach_0 + 1000, f"Waves overlap! reach_0={reach_0}, reach_1={reach_1}"

def test_initial_track_randomization():
    """Verify that initial track is not the same as the first note's track."""
    engine = GameEngine()
    
    # Run multiple times to ensure randomization works and it's never the root track
    for _ in range(10):
        session = engine.create_session(scale_id="major")
        first_note_track = (session.notes[0].fret - session.base_fret)
        assert session.current_track != first_note_track, f"Started on root track {first_note_track}"
