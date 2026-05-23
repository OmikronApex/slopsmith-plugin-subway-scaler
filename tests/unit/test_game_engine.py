import pytest
from services.game_engine import GameEngine, SCALES_PER_VARIANT


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


def _force_milestone(engine, session, direction="UP"):
    session.scale_passes_completed = SCALES_PER_VARIANT
    session.last_pass_direction = direction


def test_left_accept_starts_ascending_from_root():
    """AC-3: LEFT accept sets current_note_index=0 and root_midi=variant.root_midi."""
    engine = GameEngine()
    session = engine.create_session(scale_id="major", root_midi=60)
    _force_milestone(engine, session, direction="DOWN")  # DOWN → LEFT variant

    propose = engine.propose_variant(session.session_id, now_ms=1000)
    assert propose["success"] is True
    assert propose["variant"]["side"] == "LEFT"
    new_root = propose["variant"]["root_midi"]
    trigger = propose["window"]["trigger_midi"]

    result = engine.accept_variant(session.session_id, midi=trigger, now_ms=1500)
    assert result["success"] is True

    session = engine.get_session(session.session_id)
    assert session.root_midi == new_root
    assert session.current_note_index == 0
    assert session.notes[0].midi == new_root


def test_right_accept_starts_descending_from_apex():
    """AC-4: RIGHT accept sets current_note_index=ascending_note_count and apex=trigger_midi."""
    engine = GameEngine()
    session = engine.create_session(scale_id="major", root_midi=60)
    _force_milestone(engine, session, direction="UP")  # UP → RIGHT variant

    propose = engine.propose_variant(session.session_id, now_ms=1000)
    assert propose["success"] is True
    assert propose["variant"]["side"] == "RIGHT"
    target_apex = propose["variant"]["root_midi"]  # = old_highest + 2
    trigger = propose["window"]["trigger_midi"]

    result = engine.accept_variant(session.session_id, midi=trigger, now_ms=1500)
    assert result["success"] is True

    session = engine.get_session(session.session_id)
    # Apex of new scale must equal the trigger (target_apex)
    assert session.notes[session.ascending_note_count - 1].midi == target_apex
    # First note to play is the first descending step
    assert session.current_note_index == session.ascending_note_count
    # Returned root_midi is the computed root, not the trigger apex
    assert result["root_midi"] != target_apex
    assert result["root_midi"] == session.root_midi
