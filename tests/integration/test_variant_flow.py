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


def _play_loops(client, session_id, loops=2):
    """Play full asc+desc octave loops to advance the milestone counter."""
    from services.game_router import engine
    sess = engine.get_session(session_id)
    n = len(sess.notes)
    for _ in range(loops):
        for _ in range(n):
            expected = sess.notes[sess.current_note_index].midi
            r = client.post(f"{BASE}/{session_id}/play-note", json={"midi": expected, "timing_ms": 0})
            assert r.status_code == 200
            assert r.json()["success"], r.text


def test_full_variant_accept_flow_via_http(client):
    """Start → play 2 octave loops → propose → accept → session reseats on new root."""
    s = _start(client)
    sid = s["session_id"]
    original_root = 60
    assert s["notes"][0]["midi"] == original_root

    _play_loops(client, sid, loops=2)

    # GET session should reflect the milestone counter.
    state = client.get(f"{BASE}/{sid}").json()
    assert state["octave_loops_completed"] >= 2
    assert state["active_variant"] is None

    # Propose: should succeed.
    propose = client.post(f"{BASE}/{sid}/variant/propose", json={"now_ms": 1000}).json()
    assert propose["success"] is True
    new_root = propose["variant"]["root_midi"]
    assert new_root != original_root

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
    assert state3["next_expected_note"]["midi"] == new_root


def test_full_variant_timeout_flow_via_http(client):
    """Start → loops → propose → no accept → timeout → state cleared."""
    s = _start(client)
    sid = s["session_id"]
    _play_loops(client, sid, loops=2)

    propose = client.post(f"{BASE}/{sid}/variant/propose", json={"now_ms": 0}).json()
    deadline = propose["window"]["deadline_ms"]

    timeout = client.post(f"{BASE}/{sid}/variant/timeout", json={"now_ms": deadline + 1}).json()
    assert timeout["success"] is True

    state = client.get(f"{BASE}/{sid}").json()
    assert state["active_variant"] is None
    assert state["active_window"] is None
    # Loop counter resets on timeout so the player must earn the next offer
    # (prevents the camera jerking right back into another variant on the
    # opposite side immediately after the first one fades out).
    assert state["octave_loops_completed"] == 0


def test_consecutive_variants_alternate_sides_via_http(client):
    """First variant on one side; after timeout, next variant on the opposite side."""
    s = _start(client)
    sid = s["session_id"]
    _play_loops(client, sid, loops=2)

    p1 = client.post(f"{BASE}/{sid}/variant/propose", json={"now_ms": 0}).json()
    side1 = p1["variant"]["side"]
    client.post(f"{BASE}/{sid}/variant/timeout", json={"now_ms": p1["window"]["deadline_ms"] + 1})

    # Force milestone again for second variant.
    from services.game_router import engine
    engine.get_session(sid).octave_loops_completed = 2

    p2 = client.post(f"{BASE}/{sid}/variant/propose", json={"now_ms": 10000}).json()
    assert p2["success"] is True
    assert p2["variant"]["side"] != side1
