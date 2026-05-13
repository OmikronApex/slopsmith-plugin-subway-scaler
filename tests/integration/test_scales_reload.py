import json
import os
import pytest

def test_scales_reload(tmp_path, monkeypatch, client):
    # Setup a temp scales.json
    scales_dir = tmp_path / "plugin"
    scales_dir.mkdir()
    scales_file = scales_dir / "scales.json"
    
    initial_data = {
        "scales": [
            {"id": "test-scale", "name": "Test Scale", "intervals": [0, 1, 2, 12]}
        ]
    }
    scales_file.write_text(json.dumps(initial_data))
    
    # Monkeypatch the default path in services.scales
    import services.scales
    monkeypatch.setattr(services.scales, "_default_path", str(scales_file))
    
    # Reload scales manually (since it's a global)
    loaded = services.scales.load_scales_from_json(str(scales_file))
    monkeypatch.setattr(services.scales, "SCALES", {s.id: s for s in loaded})
    
    # 1. Check initial scale
    r = client.get("/api/plugins/subway-scaler/scales")
    assert r.status_code == 200
    ids = [s["id"] for s in r.json()["scales"]]
    assert "test-scale" in ids
    
    # 2. Modify file
    updated_data = {
        "scales": [
            {"id": "new-scale", "name": "New Scale", "intervals": [0, 2, 4, 12]}
        ]
    }
    scales_file.write_text(json.dumps(updated_data))
    
    # 3. Reload and check
    loaded_new = services.scales.load_scales_from_json(str(scales_file))
    monkeypatch.setattr(services.scales, "SCALES", {s.id: s for s in loaded_new})
    
    r = client.get("/api/plugins/subway-scaler/scales")
    assert r.status_code == 200
    ids = [s["id"] for s in r.json()["scales"]]
    assert "new-scale" in ids
    assert "test-scale" not in ids
