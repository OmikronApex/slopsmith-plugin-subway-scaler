import pytest

def test_tabulate_major_c(client):
    r = client.post("/api/plugins/subway-scaler/scales/major/tabulate", json={"root_note": "C"})
    assert r.status_code == 200
    body = r.json()
    assert body["scaleId"] == "major"
    assert body["rootNote"] == "C"
    assert len(body["pattern"]) > 0

def test_tabulate_all_notes(client):
    r = client.post("/api/plugins/subway-scaler/scales/major/tabulate", json={"root_note": "C"})
    assert r.status_code == 200
    pattern = r.json()["pattern"]
    # Major scale has 8 notes (including octave)
    assert len(pattern) == 8

def test_tabulate_different_roots(client):
    r_c = client.post("/api/plugins/subway-scaler/scales/major/tabulate", json={"root_note": "C"})
    r_g = client.post("/api/plugins/subway-scaler/scales/major/tabulate", json={"root_note": "G"})
    assert r_c.status_code == 200
    assert r_g.status_code == 200
    assert r_c.json()["pattern"] != r_g.json()["pattern"]
