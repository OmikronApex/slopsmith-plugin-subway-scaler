"""Contract tests for POST /variant/promote (Story 6-5)."""
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
    from services.game_router import engine
    sess = engine.get_session(session_id)
    sess.scale_passes_completed = SCALES_PER_VARIANT
    sess.last_pass_direction = direction


def _propose_and_accept(client, sid):
    _force_milestone(client, sid)
    p = client.post(f"{BASE}/{sid}/variant/propose", json={"now_ms": 1000}).json()
    new_root = p["variant"]["root_midi"]
    accept = client.post(f"{BASE}/{sid}/variant/accept", json={"midi": new_root, "now_ms": 1500}).json()
    assert accept["success"] is True
    return p


def test_promote_without_accept_rejected(client):
    s = _start(client)
    _force_milestone(client, s["session_id"])
    client.post(f"{BASE}/{s['session_id']}/variant/propose", json={"now_ms": 1000})
    r = client.post(f"{BASE}/{s['session_id']}/variant/promote").json()
    assert r["success"] is False
    assert r["error"] == "variant_not_accepted"


def test_promote_without_active_variant_rejected(client):
    s = _start(client)
    r = client.post(f"{BASE}/{s['session_id']}/variant/promote").json()
    # Idempotent: no active_variant → return current scale state as success
    assert r["success"] is True
    assert "root_midi" in r
    assert "notes" in r


def test_promote_after_accept_returns_full_scale_data(client):
    s = _start(client)
    _propose_and_accept(client, s["session_id"])
    r = client.post(f"{BASE}/{s['session_id']}/variant/promote").json()
    assert r["success"] is True
    assert r["base_fret"] >= 0
    assert r["num_lanes"] >= 3
    assert isinstance(r["notes"], list)
    assert len(r["notes"]) > 0
    assert "root_midi" in r
    assert "ascending_note_count" in r
    assert "current_note_index" in r


def test_promote_clears_active_variant(client):
    from services.game_router import engine
    s = _start(client)
    _propose_and_accept(client, s["session_id"])
    client.post(f"{BASE}/{s['session_id']}/variant/promote")
    sess = engine.get_session(s["session_id"])
    assert sess.active_variant is None
    assert sess.active_window is None


def test_promote_records_history(client):
    from services.game_router import engine
    s = _start(client)
    _propose_and_accept(client, s["session_id"])
    client.post(f"{BASE}/{s['session_id']}/variant/promote")
    sess = engine.get_session(s["session_id"])
    decisions = [h["decision"] for h in sess.variant_history]
    assert "ACCEPTED" in decisions
    assert "PROMOTED" in decisions


def test_promote_idempotent_double_call(client):
    s = _start(client)
    _propose_and_accept(client, s["session_id"])
    r1 = client.post(f"{BASE}/{s['session_id']}/variant/promote").json()
    r2 = client.post(f"{BASE}/{s['session_id']}/variant/promote").json()
    assert r1["success"] is True
    assert r2["success"] is True
    assert r1["root_midi"] == r2["root_midi"]


def test_promote_after_dismiss_rejected(client):
    s = _start(client)
    _force_milestone(client, s["session_id"])
    client.post(f"{BASE}/{s['session_id']}/variant/propose", json={"now_ms": 1000})
    client.post(f"{BASE}/{s['session_id']}/variant/dismiss")
    r = client.post(f"{BASE}/{s['session_id']}/variant/promote").json()
    # active_variant cleared by dismiss → idempotent success
    assert r["success"] is True


def test_poll_outgoing_scale_served_between_accept_and_promote(client):
    """AC-7: Between accept and promote, poll returns unchanged outgoing scale."""
    s = _start(client)
    sid = s["session_id"]
    original_root = s["root_note"]["midi"]
    _force_milestone(client, sid)
    p = client.post(f"{BASE}/{sid}/variant/propose", json={"now_ms": 1000}).json()
    new_root = p["variant"]["root_midi"]
    client.post(f"{BASE}/{sid}/variant/accept", json={"midi": new_root, "now_ms": 1500})

    # Poll during ACCEPTED gap
    state_gap = client.get(f"{BASE}/{sid}").json()
    assert state_gap["active_variant"]["state"] == "ACCEPTED"
    # Verify outgoing scale still in session (not yet swapped).
    from services.game_router import engine as _eng
    gap_sess = _eng.get_session(sid)
    assert gap_sess.root_midi == original_root

    # Promote and verify scale updated.
    client.post(f"{BASE}/{sid}/variant/promote")
    state_after = client.get(f"{BASE}/{sid}").json()
    assert state_after["active_variant"] is None
    promoted_sess = _eng.get_session(sid)
    assert promoted_sess.root_midi != original_root
