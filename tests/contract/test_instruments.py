"""Contract test for GET /api/plugins/subway-scaler/instruments."""
from __future__ import annotations


REQUIRED_IDS = {"guitar-standard", "bass-4-standard"}


def test_get_instruments_ok(client):
    r = client.get("/api/plugins/subway-scaler/instruments")
    assert r.status_code == 200, r.text
    body = r.json()
    assert "instruments" in body
    by_id = {inst["id"]: inst for inst in body["instruments"]}
    missing = REQUIRED_IDS - by_id.keys()
    assert not missing, f"missing instrument ids: {missing}"

    guitar = by_id["guitar-standard"]
    assert guitar["kind"] == "guitar"
    assert guitar["stringCount"] == 6
    assert guitar["tuning"] == [40, 45, 50, 55, 59, 64]
    assert guitar["maxFret"] == 24
    assert isinstance(guitar["name"], str) and guitar["name"]

    bass = by_id["bass-4-standard"]
    assert bass["kind"] == "bass"
    assert bass["stringCount"] == 4
    assert bass["tuning"] == [28, 33, 38, 43]
    assert bass["maxFret"] == 24

    for inst in body["instruments"]:
        assert inst["stringCount"] == len(inst["tuning"])
        assert all(b > a for a, b in zip(inst["tuning"], inst["tuning"][1:]))
        assert 12 <= inst["maxFret"] <= 24
