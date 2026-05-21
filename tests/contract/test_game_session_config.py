"""Red-phase ATDD scaffolds for Story 1.4: GET /game/session-config endpoint."""

import pytest


def test_session_config_happy_path_200_and_required_shape(client):
    """T014: Happy path returns 200 with all required top-level snake_case fields."""
    response = client.get(
        "/api/plugins/subway-scaler/game/session-config",
        params={
            "scale_id": "major",
            "root_midi": 65,
            "instrument_id": "guitar-standard",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "scale_id" in data
    assert "root_midi" in data
    assert "instrument_id" in data
    assert "notes" in data
    assert "track_count" in data
    # Confirm no camelCase variants leak through
    assert "rootMidi" not in data
    assert "instrumentId" not in data
    assert "scaleId" not in data
    assert "trackCount" not in data


def test_session_config_root_midi_is_integer(client):
    """T015: root_midi in the response body is an integer."""
    response = client.get(
        "/api/plugins/subway-scaler/game/session-config",
        params={
            "scale_id": "major",
            "root_midi": 65,
            "instrument_id": "guitar-standard",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data["root_midi"], int)
    assert data["root_midi"] == 65


def test_session_config_notes_list_snake_case_shape(client):
    """T016: notes is a list; each item has midi, name, string, fret keys (snake_case)."""
    response = client.get(
        "/api/plugins/subway-scaler/game/session-config",
        params={
            "scale_id": "major",
            "root_midi": 65,
            "instrument_id": "guitar-standard",
        },
    )
    assert response.status_code == 200
    data = response.json()
    notes = data["notes"]
    assert isinstance(notes, list)
    assert len(notes) > 0
    for note in notes:
        assert "midi" in note
        assert "name" in note
        assert "string" in note
        assert "fret" in note
        # Confirm no camelCase variants
        assert "midiNote" not in note
        assert "noteName" not in note
        assert "stringNum" not in note
        assert "fretNum" not in note


def test_session_config_track_count_in_valid_range(client):
    """T017: track_count is an integer clamped between 3 and 12 inclusive."""
    response = client.get(
        "/api/plugins/subway-scaler/game/session-config",
        params={
            "scale_id": "major",
            "root_midi": 65,
            "instrument_id": "guitar-standard",
        },
    )
    assert response.status_code == 200
    data = response.json()
    track_count = data["track_count"]
    assert isinstance(track_count, int)
    assert 3 <= track_count <= 12


def test_session_config_unknown_scale_returns_404_scale_not_found(client):
    """T018: Unknown scale_id → 404 with error.code == SCALE_NOT_FOUND."""
    response = client.get(
        "/api/plugins/subway-scaler/game/session-config",
        params={
            "scale_id": "not-a-real-scale",
            "root_midi": 65,
            "instrument_id": "guitar-standard",
        },
    )
    assert response.status_code == 404
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "SCALE_NOT_FOUND"
    assert "message" in data["error"]


def test_session_config_root_midi_below_21_returns_422_invalid_root(client):
    """T019: root_midi below MIDI range (< 21) → 422 with error.code == INVALID_ROOT."""
    response = client.get(
        "/api/plugins/subway-scaler/game/session-config",
        params={
            "scale_id": "major",
            "root_midi": 20,
            "instrument_id": "guitar-standard",
        },
    )
    assert response.status_code == 422
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "INVALID_ROOT"
    assert "message" in data["error"]


def test_session_config_root_midi_above_108_returns_422_invalid_root(client):
    """T020: root_midi above MIDI range (> 108) → 422 with error.code == INVALID_ROOT."""
    response = client.get(
        "/api/plugins/subway-scaler/game/session-config",
        params={
            "scale_id": "major",
            "root_midi": 109,
            "instrument_id": "guitar-standard",
        },
    )
    assert response.status_code == 422
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "INVALID_ROOT"
    assert "message" in data["error"]
