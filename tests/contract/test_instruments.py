"""Contract test for GET /api/plugins/subway-scaler/instruments."""
from __future__ import annotations

import pytest

REQUIRED_IDS = {
    "guitar-standard",
    "bass-4-standard",
    "bass-5-standard",
    "guitar-7-standard",
    "guitar-8-standard",
}

NEW_INSTRUMENTS = {
    "bass-5-standard": {
        "kind": "bass",
        "stringCount": 5,
        "tuning": [23, 28, 33, 38, 43],
    },
    "guitar-7-standard": {
        "kind": "guitar",
        "stringCount": 7,
        "tuning": [35, 40, 45, 50, 55, 59, 64],
    },
    "guitar-8-standard": {
        "kind": "guitar",
        "stringCount": 8,
        "tuning": [30, 35, 40, 45, 50, 55, 59, 64],
    },
}


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


@pytest.mark.parametrize("inst_id,expected", NEW_INSTRUMENTS.items())
def test_new_instruments_fields(client, inst_id, expected):
    r = client.get("/api/plugins/subway-scaler/instruments")
    assert r.status_code == 200, r.text
    by_id = {i["id"]: i for i in r.json()["instruments"]}
    assert inst_id in by_id, f"{inst_id} missing from registry"
    inst = by_id[inst_id]
    assert inst["kind"] == expected["kind"]
    assert inst["stringCount"] == expected["stringCount"]
    assert inst["tuning"] == expected["tuning"]
    assert inst["maxFret"] == 24
    assert inst["stringCount"] == len(inst["tuning"])


@pytest.mark.parametrize("inst_id", NEW_INSTRUMENTS)
def test_new_instruments_accepted_by_settings(client, inst_id):
    """New instrument IDs must pass settings validation."""
    r = client.put(
        "/api/plugins/subway-scaler/settings",
        json={"instrumentId": inst_id, "lastScaleId": "major"},
    )
    assert r.status_code == 200, f"settings rejected new instrument {inst_id}: {r.text}"
