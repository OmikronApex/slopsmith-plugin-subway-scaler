import pytest

def test_game_start_contract(client):
    """T004: Contract test for POST /api/plugins/subway_scaler/game/start"""
    response = client.post("/api/plugins/subway-scaler/game/start", json={
        "scale_id": "major",
        "difficulty": "easy"
    })
    
    # This should FAIL initially as the endpoint is not yet extended to handle this
    assert response.status_code == 200
    data = response.json()
    assert "session_id" in data
    assert "initial_track" in data
    assert "root_note" in data
    
    assert "base_fret" in data
    assert "num_lanes" in data
    
    # NEW: Initial track should NOT be the root note's track
    root_track = (data["root_note"]["fret"] - data["base_fret"])
    assert data["initial_track"] != root_track, f"Character started on safe track {root_track}"
    
    assert "notes" in data
    assert isinstance(data["notes"], list)
    assert "waves" in data
    assert len(data["waves"]) > 0
    assert "game_state" in data
