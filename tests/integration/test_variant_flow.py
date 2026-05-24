"""Integration tests for variant switching end-to-end (008-track-variants).

Exercises the HTTP API: start → drive to milestone → propose → accept/timeout.
"""
from __future__ import annotations
from services.game_engine import SCALES_PER_VARIANT


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

    # Accept by playing the trigger note.
    accept = client.post(
        f"{BASE}/{sid}/variant/accept", json={"midi": new_root, "now_ms": 1500}
    ).json()
    assert accept["success"] is True

    # Variant cleared; session reseated on new scale.
    state3 = client.get(f"{BASE}/{sid}").json()
    assert state3["active_variant"] is None
    assert state3["active_window"] is None

    from services.game_router import engine
    sess = engine.get_session(sid)
    if side == "LEFT":
        # LEFT: root_midi == trigger; start at index 1 (player just played root)
        assert accept["root_midi"] == new_root
        assert sess.current_note_index == 1
        assert state3["next_expected_note"]["midi"] == accept["notes"][1]["midi"]
    else:
        # RIGHT: root_midi is computed candidate root; start descending
        assert accept["root_midi"] != new_root
        assert sess.current_note_index == sess.ascending_note_count
        assert state3["next_expected_note"]["midi"] == accept["notes"][sess.ascending_note_count]["midi"]


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
    s = _start(client, root_midi=48)  # C3 so RIGHT variant lands in playable frets
    sid = s["session_id"]
    _play_passes(client, sid, passes=3)

    p1 = client.post(f"{BASE}/{sid}/variant/propose", json={"now_ms": 0}).json()
    assert p1["success"] is True
    side1 = p1["variant"]["side"]
    client.post(f"{BASE}/{sid}/variant/timeout", json={"now_ms": p1["window"]["deadline_ms"] + 1})

    # Force second milestone with direction opposite to first.
    sess = engine.get_session(sid)
    sess.scale_passes_completed = SCALES_PER_VARIANT
    sess.last_pass_direction = "UP" if side1 == "RIGHT" else "DOWN"

    p2 = client.post(f"{BASE}/{sid}/variant/propose", json={"now_ms": 10000}).json()
    assert p2["success"] is True
    assert p2["variant"]["side"] != side1


# ---------------------------------------------------------------------------
# Story 5-3: Polling integration coverage — variant lifecycle (AC-1 through AC-7)
# ---------------------------------------------------------------------------

def test_poll_baseline_no_variant(client):
    """AC-1: Fresh session poll returns active_variant and active_window as null."""
    s = _start(client)
    sid = s["session_id"]
    state = client.get(f"{BASE}/{sid}").json()
    assert state["active_variant"] is None
    assert state["active_window"] is None
    assert state["status"] == "running"


def test_poll_after_propose_shows_active_variant(client):
    """AC-2: Poll after propose returns active_variant with all required fields and OPEN window."""
    import time
    s = _start(client)
    sid = s["session_id"]
    _play_passes(client, sid, passes=3)

    now_ms = int(time.time() * 1000)
    propose = client.post(f"{BASE}/{sid}/variant/propose", json={"now_ms": now_ms}).json()
    assert propose["success"] is True
    variant_id = propose["variant"]["variant_id"]

    state = client.get(f"{BASE}/{sid}").json()
    av = state["active_variant"]
    aw = state["active_window"]
    assert av is not None
    assert av["variant_id"] == variant_id
    assert av["root_midi"] is not None
    assert av["base_fret"] >= 0
    assert av["num_lanes"] >= 3
    assert av["base_lane"] >= 0
    assert av["side"] in ("LEFT", "RIGHT")
    assert aw is not None
    assert aw["state"] == "OPEN"
    assert aw["deadline_ms"] > now_ms


def test_poll_after_accept_clears_variant(client):
    """AC-3: Poll after accept returns active_variant: null; root updated per direction."""
    s = _start(client)
    sid = s["session_id"]
    _play_passes(client, sid, passes=3)

    propose = client.post(f"{BASE}/{sid}/variant/propose", json={"now_ms": 1000}).json()
    assert propose["success"] is True
    new_root = propose["variant"]["root_midi"]
    side = propose["variant"]["side"]
    trigger = propose["window"]["trigger_midi"]

    accept = client.post(f"{BASE}/{sid}/variant/accept", json={"midi": trigger, "now_ms": 1500}).json()
    assert accept["success"] is True
    if side == "LEFT":
        assert accept["root_midi"] == new_root
    else:
        # RIGHT: returned root_midi is the candidate root, not the trigger apex
        assert accept["root_midi"] != new_root

    state = client.get(f"{BASE}/{sid}").json()
    assert state["active_variant"] is None
    assert state["active_window"] is None
    assert state["status"] == "running"


def test_poll_after_timeout_clears_variant(client):
    """AC-4: Poll after timeout returns active_variant: null; session remains running."""
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
    assert state["status"] == "running"


def test_propose_gate_before_and_after_threshold(client):
    """AC-5 + AC-6: Propose rejected before threshold; succeeds after 3 completed passes."""
    s = _start(client)
    sid = s["session_id"]

    # AC-5: before milestone
    r = client.post(f"{BASE}/{sid}/variant/propose", json={}).json()
    assert r["success"] is False
    assert r["error"] == "milestone_not_reached"

    # AC-6: after milestone — drive full note sequence to earn 3 passes
    _play_passes(client, sid, passes=3)
    r2 = client.post(f"{BASE}/{sid}/variant/propose", json={"now_ms": 1000}).json()
    assert r2["success"] is True

    state = client.get(f"{BASE}/{sid}").json()
    assert state["active_variant"] is not None
    assert state["active_variant"]["variant_id"] == r2["variant"]["variant_id"]


def test_rapid_poll_idempotency(client):
    """AC-7: Two consecutive polls between state transitions return identical variant state."""
    s = _start(client)
    sid = s["session_id"]
    _play_passes(client, sid, passes=3)
    client.post(f"{BASE}/{sid}/variant/propose", json={"now_ms": 1000})

    state_a = client.get(f"{BASE}/{sid}").json()
    state_b = client.get(f"{BASE}/{sid}").json()

    assert state_a["active_variant"]["variant_id"] == state_b["active_variant"]["variant_id"]
    assert state_a["active_window"]["state"] == state_b["active_window"]["state"]
    assert state_a["active_window"]["deadline_ms"] == state_b["active_window"]["deadline_ms"]
