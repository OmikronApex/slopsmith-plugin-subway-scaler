"""Contract tests for variant switching (feature 008-track-variants).

Covers:
- US1: variant spawns at milestone with non-overlapping geometry
- US3: switch window deadline + state
- US4: accept variant updates session root + tracks
- US5: side alternation
- US6: instrument compatibility validation
"""
from __future__ import annotations

import pytest
from services.game_engine import SCALES_PER_VARIANT


BASE = "/api/plugins/subway-scaler/game"


def _start(client, **kwargs):
    body = {"scale_id": "major", "difficulty": "easy", "root_midi": 60, "instrument_id": "guitar-standard"}
    body.update(kwargs)
    r = client.post(f"{BASE}/start", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def _force_milestone(client, session_id, direction="UP"):
    """Drive the engine to the next milestone by directly bumping the counter.

    The user-facing flow requires playing N half-cycles; we shortcut via the
    in-process engine to keep the contract focused on variant logic.
    direction: "UP" → RIGHT variant; "DOWN" → LEFT variant.
    """
    from services.game_router import engine
    sess = engine.get_session(session_id)
    sess.scale_passes_completed = SCALES_PER_VARIANT
    sess.last_pass_direction = direction


def test_propose_rejected_before_milestone(client):
    s = _start(client)
    r = client.post(f"{BASE}/{s['session_id']}/variant/propose", json={})
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is False
    assert body["error"] == "milestone_not_reached"


def test_propose_creates_variant_at_milestone(client):
    s = _start(client)
    _force_milestone(client, s["session_id"])
    r = client.post(f"{BASE}/{s['session_id']}/variant/propose", json={"now_ms": 1000})
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    v = body["variant"]
    w = body["window"]
    assert v["side"] in ("LEFT", "RIGHT")
    assert v["state"] == "ACTIVE"
    assert v["num_lanes"] >= 3
    assert w["state"] == "OPEN"
    assert w["deadline_ms"] > w["opened_at_ms"]
    assert w["trigger_midi"] == v["root_midi"]


def test_propose_blocked_when_active_variant_exists(client):
    s = _start(client)
    _force_milestone(client, s["session_id"])
    client.post(f"{BASE}/{s['session_id']}/variant/propose", json={"now_ms": 1000})
    r2 = client.post(f"{BASE}/{s['session_id']}/variant/propose", json={"now_ms": 1100})
    assert r2.json()["error"] == "variant_already_active"


def test_accept_with_wrong_midi_rejected(client):
    s = _start(client)
    _force_milestone(client, s["session_id"])
    p = client.post(f"{BASE}/{s['session_id']}/variant/propose", json={"now_ms": 1000}).json()
    r = client.post(
        f"{BASE}/{s['session_id']}/variant/accept",
        json={"midi": p["variant"]["root_midi"] + 1, "now_ms": 1500},
    )
    assert r.json()["error"] == "wrong_midi"


def test_accept_after_deadline_rejected(client):
    s = _start(client)
    _force_milestone(client, s["session_id"])
    p = client.post(f"{BASE}/{s['session_id']}/variant/propose", json={"now_ms": 1000}).json()
    deadline = p["window"]["deadline_ms"]
    r = client.post(
        f"{BASE}/{s['session_id']}/variant/accept",
        json={"midi": p["variant"]["root_midi"], "now_ms": deadline + 1},
    )
    assert r.json()["error"] == "window_expired"


def test_accept_switches_root_and_regenerates_notes(client):
    from services.game_router import engine
    s = _start(client)
    original_root = 60  # passed in _start
    _force_milestone(client, s["session_id"])
    p = client.post(f"{BASE}/{s['session_id']}/variant/propose", json={"now_ms": 1000}).json()
    new_root = p["variant"]["root_midi"]
    side = p["variant"]["side"]
    # RIGHT: 2 above highest scale note; LEFT: root - 2
    sess_before = engine.get_session(s["session_id"])
    if side == "RIGHT":
        expected_root = max(n.midi for n in sess_before.notes) + 2
    else:
        expected_root = original_root - 2
    assert new_root == expected_root
    r = client.post(
        f"{BASE}/{s['session_id']}/variant/accept",
        json={"midi": new_root, "now_ms": 1500},
    ).json()
    assert r["success"] is True
    assert r["base_fret"] >= 0
    assert r["num_lanes"] >= 3
    assert len(r["notes"]) > 0
    sess_after = engine.get_session(s["session_id"])
    if side == "LEFT":
        # LEFT: root_midi = variant.root_midi; start at index 1 (player just played root)
        assert r["root_midi"] == new_root
        assert r["notes"][0]["midi"] == new_root
        assert sess_after.current_note_index == 1
    else:
        # RIGHT: root_midi is the computed actual root (not the trigger apex)
        assert r["root_midi"] != new_root
        assert r["root_midi"] == sess_after.root_midi
        # Apex of new scale = trigger note
        assert sess_after.notes[sess_after.ascending_note_count - 1].midi == new_root
        # Start descending: first note is first step below apex
        assert sess_after.current_note_index == sess_after.ascending_note_count


def test_timeout_clears_variant_and_records_history(client):
    s = _start(client)
    _force_milestone(client, s["session_id"])
    p = client.post(f"{BASE}/{s['session_id']}/variant/propose", json={"now_ms": 1000}).json()
    deadline = p["window"]["deadline_ms"]
    r = client.post(
        f"{BASE}/{s['session_id']}/variant/timeout",
        json={"now_ms": deadline + 1},
    )
    assert r.json()["success"] is True
    # Next propose should succeed once milestone is restored (timeout cleared active variant).
    from services.game_router import engine
    sess = engine.get_session(s["session_id"])
    assert sess.active_variant is None
    assert sess.active_window is None
    assert sess.variant_history[-1]["decision"] == "TIMED_OUT"


def test_timeout_before_deadline_rejected(client):
    s = _start(client)
    _force_milestone(client, s["session_id"])
    p = client.post(f"{BASE}/{s['session_id']}/variant/propose", json={"now_ms": 1000}).json()
    r = client.post(
        f"{BASE}/{s['session_id']}/variant/timeout",
        json={"now_ms": p["window"]["opened_at_ms"] + 100},
    )
    assert r.json()["error"] == "window_not_expired"


def test_side_alternates_across_consecutive_variants(client):
    s = _start(client, root_midi=48)  # C3 so RIGHT variant lands in playable frets
    sid = s["session_id"]
    _force_milestone(client, sid, direction="DOWN")  # DOWN → RIGHT variant
    first = client.post(f"{BASE}/{sid}/variant/propose", json={"now_ms": 1000}).json()
    assert first["variant"]["side"] == "RIGHT"
    # Timeout the first to clear it.
    client.post(f"{BASE}/{sid}/variant/timeout", json={"now_ms": first["window"]["deadline_ms"] + 1})
    _force_milestone(client, sid, direction="UP")  # UP → LEFT variant
    second = client.post(f"{BASE}/{sid}/variant/propose", json={"now_ms": 10000}).json()
    assert second["variant"]["side"] == "LEFT"
    assert second["variant"]["side"] != first["variant"]["side"]
