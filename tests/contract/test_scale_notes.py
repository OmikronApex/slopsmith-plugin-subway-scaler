"""Contract test for GET /api/plugins/subway-scaler/scales/{scale_id}/notes."""
from __future__ import annotations


def test_c_major_one_octave(client):
    r = client.get("/api/plugins/subway-scaler/scales/major/notes", params={"root_midi": 60, "octaves": 1})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["scaleId"] == "major"
    assert body["rootMidi"] == 60
    assert body["octaves"] == 1
    assert body["descending"] is False
    midis = [n["midi"] for n in body["notes"]]
    assert midis == [60, 62, 64, 65, 67, 69, 71, 72]
    names = [n["name"] for n in body["notes"]]
    assert names[0] == "C4" and names[-1] == "C5"
    for n in body["notes"]:
        assert n["frequencyHz"] > 0


def test_descending_appended(client):
    r = client.get(
        "/api/plugins/subway-scaler/scales/major/notes",
        params={"root_midi": 60, "octaves": 1, "descending": "true"},
    )
    assert r.status_code == 200
    midis = [n["midi"] for n in r.json()["notes"]]
    # Ascending then descending without duplicating the apex
    assert midis[:8] == [60, 62, 64, 65, 67, 69, 71, 72]
    assert midis[8:] == [71, 69, 67, 65, 64, 62, 60]


def test_scale_not_found(client):
    r = client.get("/api/plugins/subway-scaler/scales/no-such-scale/notes", params={"root_midi": 60})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "scale-not-found"


def test_invalid_root(client):
    r = client.get("/api/plugins/subway-scaler/scales/major/notes", params={"root_midi": 5})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid-root"


def test_invalid_octaves(client):
    r = client.get("/api/plugins/subway-scaler/scales/major/notes", params={"root_midi": 60, "octaves": 5})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid-octaves"
