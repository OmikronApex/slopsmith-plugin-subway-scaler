"""Integration tests for variant switching end-to-end (008-track-variants).

Exercises the HTTP API: start → drive to milestone → propose → accept/timeout.
"""
from __future__ import annotations


BASE = "/api/plugins/subway-scaler/game"


def _start(client, **kwargs):
    body = {"scale_id": "major", "difficulty": "easy", "root_midi": 60, "instrument_id": "guitar-standard"}
    body.update(kwargs)
    r = client.post(f"{BASE}/start", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def _play_passes(client, session_id, passes=3):
    """Play enough notes to complete N half-cycle passes (ascending or descending)."""
    from services.game_router import engine
    sess = engine.get_session(session_id)
    t = 0
    completed = 0
    while completed < passes:
        expected = sess.notes[sess.current_note_index].midi
        r = client.post(f"{BASE}/{session_id}/play-note", json={"midi": expected, "timing_ms": t})
        assert r.status_code == 200
        res = r.json()
        assert res["success"], res.get("error")
        t += 1
        # Re-read pass counter from session
        completed = sess.scale_passes_completed


def test_full_variant_accept_flow_via_http(client):
    """Start → play 3 passes → propose → accept → session reseats on new root."""
    s = _start(client)
    sid = s["session_id"]
    original_root = 60
    assert s["notes"][0]["midi"] == original_root

    _play_passes(client, sid, passes=3)

    # GET session should reflect the milestone counter.
    state = client.get(f"{BASE}/{sid}").json()
    assert state["scale_passes_completed"] >= 3
    assert state["active_variant"] is None

    # Propose: should succeed.
    propose = client.post(f"{BASE}/{sid}/variant/propose", json={"now_ms": 1000}).json()
    assert propose["success"] is True
    new_root = propose["variant"]["root_midi"]
    side = propose["variant"]["side"]
    # RIGHT: highest_note + 2; LEFT: root - 2
    from services.game_router import engine
    sess = engine.get_session(sid)
    if side == "RIGHT":
        expected_root = max(n.midi for n in sess.notes) + 2
    else:
        expected_root = original_root - 2
    assert new_root == expected_root

    # Poll exposes the active variant.
    state2 = client.get(f"{BASE}/{sid}").json()
    assert state2["active_variant"]["variant_id"] == propose["variant"]["variant_id"]
    assert state2["active_window"]["state"] == "OPEN"

    # Accept by playing the new root.
    accept = client.post(
        f"{BASE}/{sid}/variant/accept", json={"midi": new_root, "now_ms": 1500}
    ).json()
    assert accept["success"] is True
    assert accept["root_midi"] == new_root

    # Variant cleared; new notes are anchored at new root.
    state3 = client.get(f"{BASE}/{sid}").json()
    assert state3["active_variant"] is None
    assert state3["active_window"] is None
    # We now expect the second note (index 1) of the new scale
    # Because index 0 (the root) was already "played" to accept the variant.
    assert state3["current_note_index"] == 1
    assert state3["next_expected_note"]["midi"] == accept["notes"][1]["midi"]


def test_full_variant_timeout_flow_via_http(client):
    """Start → 3 passes → propose → no accept → timeout → state cleared."""
    s = _start(client)
    sid = s["session_id"]
    _play_passes(client, sid, passes=3)

    propose = client.post(f"{BASE}/{sid}/variant/propose", json={"now_ms": 0}).json()
    deadline = propose["window"]["deadline_ms"]

    timeout = client.post(f"{BASE}/{sid}/variant/timeout", json={"now_ms": deadline + 1}).json()
    assert timeout["success"] is True

    state = client.get(f"{BASE}/{sid}").json()
    assert state["active_variant"] is None
    assert state["active_window"] is None
    # Pass counter resets on timeout so the player must earn 3 more half-cycles.
    assert state["scale_passes_completed"] == 0


def test_consecutive_variants_alternate_sides_via_http(client):
    """First variant direction driven by last pass; second variant is opposite after 3 more passes."""
    from services.game_router import engine
    s = _start(client)
    sid = s["session_id"]
    _play_passes(client, sid, passes=3)

    p1 = client.post(f"{BASE}/{sid}/variant/propose", json={"now_ms": 0}).json()
    assert p1["success"] is True
    side1 = p1["variant"]["side"]
    client.post(f"{BASE}/{sid}/variant/timeout", json={"now_ms": p1["window"]["deadline_ms"] + 1})

    # Force second milestone with direction opposite to first.
    sess = engine.get_session(sid)
    sess.scale_passes_completed = 3
    sess.last_pass_direction = "DOWN" if side1 == "RIGHT" else "UP"

    p2 = client.post(f"{BASE}/{sid}/variant/propose", json={"now_ms": 10000}).json()
    assert p2["success"] is True
    assert p2["variant"]["side"] != side1
