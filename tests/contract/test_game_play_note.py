import pytest

def test_game_play_note_contract(client):
    """T005: Contract test for POST /api/plugins/subway_scaler/game/{id}/play-note"""
    # First start a game
    start_resp = client.post("/api/plugins/subway-scaler/game/start", json={
        "scale_id": "major"
    })
    
    # If start fails (which it will initially), this will fail too
    assert start_resp.status_code == 200
    session_id = start_resp.json()["session_id"]
    
    response = client.post(f"/api/plugins/subway-scaler/game/{session_id}/play-note", json={
        "midi": 60,
        "timing_ms": 100
    })
    
    assert response.status_code == 200
    data = response.json()
    assert "success" in data
    assert "game_state" in data
