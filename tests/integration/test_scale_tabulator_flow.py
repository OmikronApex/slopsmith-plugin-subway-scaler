import pytest

def test_scale_tabulator_flow(client):
    # 1. Get scales list
    r = client.get("/api/plugins/subway-scaler/scales")
    assert r.status_code == 200
    scales = r.json()["scales"]
    assert len(scales) > 0
    
    # Pick Major scale
    major = next(s for s in scales if s["id"] == "major")
    
    # 2. Get scale detail
    r = client.get(f"/api/plugins/subway-scaler/scales/{major['id']}")
    assert r.status_code == 200
    assert r.json()["name"] == "Major"
    
    # 3. Tabulate Major C
    r = client.post(f"/api/plugins/subway-scaler/scales/{major['id']}/tabulate", json={"root_note": "C"})
    assert r.status_code == 200
    pattern = r.json()
    assert pattern["scaleId"] == "major"
    assert pattern["rootNote"] == "C"
    assert len(pattern["pattern"]) == 8 # Octave inclusive major scale
    
    # 4. Check some specific fret/string pairs for C Major
    # Guitar Standard: 1:E, 2:B, 3:G, 4:D, 5:A, 6:E
    # C on guitar: 
    # Lowest root: 6:E, C is 6:8. 5:A, C is 5:3. 
    # Our new logic picks lowest string: String 6.
    p1 = pattern["pattern"][0]
    assert p1["string"] == 6
    assert p1["fret"] == 8
