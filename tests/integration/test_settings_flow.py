"""Integration: PUT settings referencing a real scale, then GET and confirm round-trip."""
from __future__ import annotations


def test_settings_round_trip_with_real_scale(client):
    scales = client.get("/api/plugins/subway_scaler/scales").json()["scales"]
    target = next(s for s in scales if s["id"] == "natural-minor")

    body = {
        "lastScaleId": target["id"],
        "lastRootMidi": 69,
        "lastOctaves": 2,
        "lastDifficulty": "easy",
        "strictOctave": True,
        "audio": {
            "deviceId": None,
            "deviceLabel": "",
            "sampleRate": 48000,
            "toleranceCents": 40,
            "confidenceThreshold": 0.85,
            "stabilityFrames": 2,
        },
    }
    r = client.put("/api/plugins/subway_scaler/settings", json=body)
    assert r.status_code == 200
    fetched = client.get("/api/plugins/subway_scaler/settings").json()
    assert fetched == body
