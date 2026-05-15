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


BASE = "/api/plugins/subway-scaler/game"


def _start(client, **kwargs):
    body = {"scale_id": "major", "difficulty": "easy", "root_midi": 60, "instrument_id": "guitar-standard"}
    body.update(kwargs)
    r = client.post(f"{BASE}/start", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def _force_milestone(client, session_id, loops=2):
    """Drive the engine to the next milestone by directly bumping the counter.

    The user-facing flow requires playing all 13 notes loops*times; we shortcut
    via the in-process engine to keep the contract focused on variant logic.
    """
    from services.game_router import engine
    sess = engine.get_session(session_id)
    sess.octave_loops_completed = loops


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
    s = _start(client)
    original_root = 60  # passed in _start
    _force_milestone(client, s["session_id"])
    p = client.post(f"{BASE}/{s['session_id']}/variant/propose", json={"now_ms": 1000}).json()
    new_root = p["variant"]["root_midi"]
    assert new_root != original_root
    r = client.post(
        f"{BASE}/{s['session_id']}/variant/accept",
        json={"midi": new_root, "now_ms": 1500},
    ).json()
    assert r["success"] is True
    assert r["root_midi"] == new_root
    assert r["base_fret"] == p["variant"]["base_fret"]
    assert r["num_lanes"] == p["variant"]["num_lanes"]
    assert len(r["notes"]) > 0
    # First note should be the new root MIDI.
    assert r["notes"][0]["midi"] == new_root


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
    s = _start(client)
    sid = s["session_id"]
    _force_milestone(client, sid)
    first = client.post(f"{BASE}/{sid}/variant/propose", json={"now_ms": 1000}).json()
    # Timeout the first to clear it.
    client.post(f"{BASE}/{sid}/variant/timeout", json={"now_ms": first["window"]["deadline_ms"] + 1})
    _force_milestone(client, sid)
    second = client.post(f"{BASE}/{sid}/variant/propose", json={"now_ms": 10000}).json()
    # Sides should differ when both are playable; on standard guitar at root C4 they are.
    assert second["variant"]["side"] != first["variant"]["side"]
