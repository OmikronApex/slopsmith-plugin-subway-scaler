import pytest
from services.game_engine import GameEngine

def test_wave_timing_does_not_overlap():
    """Continuous wave generation: waves spawn from update_session_state and
    must not collapse into the same reach time."""
    engine = GameEngine()
    session = engine.create_session(scale_id="major", difficulty="medium")

    assert len(session.waves) == 1
    w0 = session.waves[0]
    assert w0.spawn_time_ms == 0
    assert session.next_deadline_ms == 2500

    # Top up the queue via the lookahead generator (replaces per-note spawning).
    engine.update_session_state(session)
    assert len(session.waves) >= 2
    w1 = session.waves[1]

    reach_0 = w0.spawn_time_ms + w0.duration_ms
    reach_1 = w1.spawn_time_ms + w1.duration_ms
    
    # Expected spacing is base_duration * WAVE_SPACING_FACTOR
    # For medium: 2500 * 0.4 = 1000ms
    expected_spacing = 2500 * engine.WAVE_SPACING_FACTOR
    assert reach_1 >= reach_0 + expected_spacing - 1, f"Waves overlap too much! reach_0={reach_0}, reach_1={reach_1}"

def test_initial_track_randomization():
    """Verify that initial track is not the same as the first note's track."""
    engine = GameEngine()
    
    # Run multiple times to ensure randomization works and it's never the root track
    for _ in range(10):
        session = engine.create_session(scale_id="major")
        first_note_track = (session.notes[0].fret - session.base_fret)
        assert session.current_track != first_note_track, f"Started on root track {first_note_track}"
