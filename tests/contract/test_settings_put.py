"""Contract test for PUT /api/plugins/subway-scaler/settings."""
from __future__ import annotations


def _valid_body(**overrides):
    body = {
        "lastScaleId": "major",
        "lastRootMidi": 60,
        "lastOctaves": 1,
        "lastDifficulty": "medium",
        "strictOctave": False,
        "audio": {
            "deviceId": None,
            "deviceLabel": "",
            "sampleRate": 48000,
            "toleranceCents": 50,
            "confidenceThreshold": 0.8,
            "stabilityFrames": 3,
        },
    }
    body.update(overrides)
    return body


def test_put_happy_path(client):
    r = client.put("/api/plugins/subway-scaler/settings", json=_valid_body())
    assert r.status_code == 200, r.text


def test_put_rejects_bad_difficulty(client):
    body = _valid_body()
    body["lastDifficulty"] = "extreme"
    r = client.put("/api/plugins/subway-scaler/settings", json=body)
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid-settings"
    assert "lastDifficulty" in r.json()["error"]["fields"]


def test_put_rejects_out_of_range_tolerance(client):
    body = _valid_body()
    body["audio"]["toleranceCents"] = 999
    r = client.put("/api/plugins/subway-scaler/settings", json=body)
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid-settings"
    assert any("toleranceCents" in k for k in r.json()["error"]["fields"])


def test_put_rejects_unknown_scale(client):
    body = _valid_body()
    body["lastScaleId"] = "not-a-real-scale"
    r = client.put("/api/plugins/subway-scaler/settings", json=body)
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid-settings"
    assert "lastScaleId" in r.json()["error"]["fields"]


def test_put_rejects_unknown_field(client):
    body = _valid_body()
    body["foo"] = "bar"
    r = client.put("/api/plugins/subway-scaler/settings", json=body)
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid-settings"


def test_put_rejects_bad_confidence(client):
    body = _valid_body()
    body["audio"]["confidenceThreshold"] = 1.5
    r = client.put("/api/plugins/subway-scaler/settings", json=body)
    assert r.status_code == 422


def test_put_rejects_bad_stability(client):
    body = _valid_body()
    body["audio"]["stabilityFrames"] = 99
    r = client.put("/api/plugins/subway-scaler/settings", json=body)
    assert r.status_code == 422
