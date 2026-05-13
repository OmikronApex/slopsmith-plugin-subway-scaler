"""Contract test for GET /api/plugins/subway-scaler/scales."""
from __future__ import annotations


REQUIRED_IDS = {
    "major", "natural-minor",
    "ionian", "dorian", "phrygian", "lydian", "mixolydian", "aeolian", "locrian",
}


def test_get_scales_ok(client):
    r = client.get("/api/plugins/subway-scaler/scales")
    assert r.status_code == 200, r.text
    body = r.json()
    assert "scales" in body
    ids = {s["id"] for s in body["scales"]}
    # FR-001: at least major, natural minor, and the seven diatonic modes
    missing = REQUIRED_IDS - ids
    assert not missing, f"missing scale ids: {missing}"
    for s in body["scales"]:
        assert isinstance(s["id"], str) and s["id"]
        assert isinstance(s["name"], str) and s["name"]
        ivs = s["intervals"]
        assert isinstance(ivs, list) and ivs
        assert ivs[0] == 0
        assert all(0 <= x <= 24 for x in ivs)
        assert all(b > a for a, b in zip(ivs, ivs[1:]))
