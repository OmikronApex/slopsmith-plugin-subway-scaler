import pytest

def test_game_state_contract(client):
    """T006: Contract test for GET /api/plugins/subway_scaler/game/{id}"""
    # First start a game
    start_resp = client.post("/api/plugins/subway-scaler/game/start", json={
        "scale_id": "major"
    })
    
    assert start_resp.status_code == 200
    session_id = start_resp.json()["session_id"]
    
    response = client.get(f"/api/plugins/subway-scaler/game/{session_id}")
    
    assert response.status_code == 200
    data = response.json()
    assert "session_id" in data
    assert "status" in data
    assert "score" in data
