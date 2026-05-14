import pytest

def test_game_loop_integration(client):
    """T017: Integration test covering start -> 3 correct notes."""
    # 1. Start game
    start_resp = client.post("/api/plugins/subway-scaler/game/start", json={
        "scale_id": "major",
        "difficulty": "easy"
    })
    assert start_resp.status_code == 200
    data = start_resp.json()
    session_id = data["session_id"]
    notes = data["root_note"] # root_note field
    
    # Actually I should get the first note's MIDI
    expected_midi = data["root_note"]["midi"]
    
    # 2. Play 3 correct notes
    for i in range(3):
        # Get session to know expected note
        sess_resp = client.get(f"/api/plugins/subway-scaler/game/{session_id}")
        assert sess_resp.status_code == 200
        current_expected_midi = sess_resp.json()["next_expected_note"]["midi"]
        
        play_resp = client.post(f"/api/plugins/subway-scaler/game/{session_id}/play-note", json={
            "midi": current_expected_midi,
            "timing_ms": 100 * (i + 1)
        })
        assert play_resp.status_code == 200
        assert play_resp.json()["success"] is True
        
    # 3. Verify score and multiplier
    final_sess_resp = client.get(f"/api/plugins/subway-scaler/game/{session_id}")
    final_data = final_sess_resp.json()
    assert final_data["score"] == 300
    assert final_data["game_state"]["speed_multiplier"]["current_value"] > 1.0
