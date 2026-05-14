import pytest

def test_game_failure_too_late(client):
    """T020: Integration test covering note played too late."""
    # 1. Start game
    start_resp = client.post("/api/plugins/subway-scaler/game/start", json={
        "scale_id": "major",
        "difficulty": "medium"
    })
    assert start_resp.status_code == 200
    session_id = start_resp.json()["session_id"]
    
    # 2. Get session to know deadline
    sess_resp = client.get(f"/api/plugins/subway-scaler/game/{session_id}")
    # We don't expose next_deadline_ms in the public API yet, but we know it's 2500ms
    
    # 3. Play note too late (timing_ms > 2500 + 500 grace)
    play_resp = client.post(f"/api/plugins/subway-scaler/game/{session_id}/play-note", json={
        "midi": 60,
        "timing_ms": 4000
    })
    
    assert play_resp.status_code == 200
    assert play_resp.json()["success"] is False
    assert play_resp.json()["error"] == "too_late"
    assert play_resp.json()["game_state"]["status"] == "failed"

def test_game_failure_wrong_note(client):
    """T020: Integration test covering wrong note played."""
    # 1. Start game
    start_resp = client.post("/api/plugins/subway-scaler/game/start", json={
        "scale_id": "major",
        "difficulty": "medium"
    })
    assert start_resp.status_code == 200
    session_id = start_resp.json()["session_id"]
    
    # 2. Play wrong note (e.g., MIDI 61 instead of 60)
    play_resp = client.post(f"/api/plugins/subway-scaler/game/{session_id}/play-note", json={
        "midi": 61,
        "timing_ms": 100
    })
    
    assert play_resp.status_code == 200
    assert play_resp.json()["success"] is False
    assert play_resp.json()["error"] == "wrong_note"
    assert play_resp.json()["game_state"]["status"] == "failed"
