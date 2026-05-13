"""Contract test for GET /api/plugins/subway-scaler/settings."""
from __future__ import annotations


DEFAULT_BODY = {
    "lastScaleId": "major",
    "lastRootMidi": 60,
    "lastOctaves": 1,
    "lastDifficulty": "medium",
    "strictOctave": False,
}


def test_get_returns_defaults_when_missing(client, tmp_settings_path):
    assert not tmp_settings_path.exists()
    r = client.get("/api/plugins/subway-scaler/settings")
    assert r.status_code == 200, r.text
    body = r.json()
    for k, v in DEFAULT_BODY.items():
        assert body[k] == v
    assert body["audio"]["toleranceCents"] == 50
    assert body["audio"]["confidenceThreshold"] == 0.8
    assert body["audio"]["stabilityFrames"] == 3


def test_get_returns_stored_after_put(client):
    new = {
        "lastScaleId": "dorian",
        "lastRootMidi": 62,
        "lastOctaves": 2,
        "lastDifficulty": "hard",
        "strictOctave": True,
        "audio": {
            "deviceId": "abc",
            "deviceLabel": "USB Mic",
            "sampleRate": 48000,
            "toleranceCents": 25,
            "confidenceThreshold": 0.9,
            "stabilityFrames": 4,
        },
    }
    r = client.put("/api/plugins/subway-scaler/settings", json=new)
    assert r.status_code == 200, r.text
    r2 = client.get("/api/plugins/subway-scaler/settings")
    assert r2.status_code == 200
    assert r2.json() == new


def test_get_overwrites_corrupt_file(client, tmp_settings_path):
    tmp_settings_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_settings_path.write_text("not json {")
    r = client.get("/api/plugins/subway-scaler/settings")
    assert r.status_code == 200
    # File should now be valid JSON with defaults
    import json
    assert json.loads(tmp_settings_path.read_text())["lastScaleId"] == "major"
