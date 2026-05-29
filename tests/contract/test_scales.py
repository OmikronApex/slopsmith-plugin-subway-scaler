"""Contract test for GET /api/plugins/subway-scaler/scales."""
from __future__ import annotations

import pytest


REQUIRED_IDS = {
    # Major and natural minor are the common names for ionian and aeolian
    "major", "natural-minor",
    "dorian", "phrygian", "lydian", "mixolydian", "locrian",
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


def test_load_scales_json():
    from services.scales import load_scales_from_json
    scales = load_scales_from_json("scales.json")
    assert len(scales) > 0


def test_load_invalid_json(tmp_path):
    from services.scales import load_scales_from_json
    p = tmp_path / "invalid.json"
    p.write_text("invalid json {")
    with pytest.raises(ValueError):
        load_scales_from_json(str(p))


def test_get_scale_by_id(client):
    r = client.get("/api/plugins/subway-scaler/scales/major")
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == "major"
    assert body["name"] == "Major"
    assert body["intervals"] == [0, 2, 4, 5, 7, 9, 11, 12]


def test_get_scale_by_id_404(client):
    r = client.get("/api/plugins/subway-scaler/scales/nonexistent")
    assert r.status_code == 404
