"""Integration: difficulty multiplier applied correctly in score increments (Story 10-4)."""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import routes


@pytest.fixture
def game_client(tmp_settings_path):
    app = FastAPI()
    routes.setup(app, {})
    return TestClient(app)


def _start_session(game_client, difficulty="easy"):
    r = game_client.post("/api/plugins/subway-scaler/game/start", json={
        "scale_id": "major",
        "difficulty": difficulty,
        "root_midi": 60,
        "instrument_id": "guitar-standard",
    })
    assert r.status_code == 200, r.text
    data = r.json()
    return data["session_id"], data["notes"]


def _play_note(game_client, session_id, midi):
    r = game_client.post(f"/api/plugins/subway-scaler/game/{session_id}/play-note", json={
        "midi": midi,
        "timing_ms": 100,
    })
    return r.json()


@pytest.mark.parametrize("difficulty,expected_score", [
    ("easy", 100),
    ("medium", 200),
    ("hard", 300),
])
def test_difficulty_multiplier_score(game_client, difficulty, expected_score):
    session_id, notes = _start_session(game_client, difficulty=difficulty)
    first_midi = notes[0]["midi"]
    result = _play_note(game_client, session_id, first_midi)
    assert result["success"] is True
    assert result["game_state"]["score"] == expected_score
