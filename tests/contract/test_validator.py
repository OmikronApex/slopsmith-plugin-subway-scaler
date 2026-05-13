import pytest

def test_validate_valid_pattern(client):
    r = client.post("/api/plugins/subway-scaler/scales/major/tabulate", json={"root_note": "C"})
    assert r.status_code == 200

def test_validate_invalid_fret(client, monkeypatch):
    from services.tabulator import Tabulator
    from services.schemas import ScalePattern, StringFretPair
    
    def mock_encode(self, scale, root_note, tuning):
        return ScalePattern.model_construct(
            scaleId=scale.id,
            rootNote=root_note,
            pattern=[StringFretPair.model_construct(string=1, fret=25)]
        )
    monkeypatch.setattr(Tabulator, "encode_scale", mock_encode)
    
    r = client.post("/api/plugins/subway-scaler/scales/major/tabulate", json={"root_note": "C"})
    assert r.status_code == 422
    assert "invalid-geometry" in r.json()["error"]["code"]

def test_validate_invalid_string(client, monkeypatch):
    from services.tabulator import Tabulator
    from services.schemas import ScalePattern, StringFretPair
    
    def mock_encode(self, scale, root_note, tuning):
        return ScalePattern.model_construct(
            scaleId=scale.id,
            rootNote=root_note,
            pattern=[StringFretPair.model_construct(string=7, fret=10)]
        )
    monkeypatch.setattr(Tabulator, "encode_scale", mock_encode)
    
    r = client.post("/api/plugins/subway-scaler/scales/major/tabulate", json={"root_note": "C"})
    assert r.status_code == 422
    assert "invalid-geometry" in r.json()["error"]["code"]
