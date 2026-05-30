"""Integration: settings stored in config_dir (Story 10-6)."""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import routes
from services import settings as settings_module


@pytest.fixture(autouse=True)
def reset_settings(tmp_path):
    settings_module.init(tmp_path)
    yield
    settings_module._config_dir = None


def _make_client(config_dir=None):
    app = FastAPI()
    ctx = {"config_dir": str(config_dir)} if config_dir else {}
    routes.setup(app, ctx)
    return TestClient(app)


def test_get_returns_defaults_when_no_file(tmp_path):
    client = _make_client(tmp_path)
    r = client.get("/api/plugins/subway-scaler/settings")
    assert r.status_code == 200
    data = r.json()
    assert "lastScaleId" in data


def test_put_writes_to_config_dir(tmp_path):
    client = _make_client(tmp_path)
    body = {
        "lastScaleId": "major",
        "lastRootMidi": 60,
        "lastDifficulty": "hard",
        "strictOctave": False,
        "instrumentId": "guitar-standard",
        "strictTuning": False,
        "audio": {
            "deviceId": None,
            "deviceLabel": "",
            "sampleRate": 44100,
            "toleranceCents": 50,
            "confidenceThreshold": 0.8,
            "stabilityFrames": 3,
        },
    }
    r = client.put("/api/plugins/subway-scaler/settings", json=body)
    assert r.status_code == 200
    config_file = tmp_path / "subway_scaler.json"
    assert config_file.exists()
    saved = json.loads(config_file.read_text())
    assert saved["lastDifficulty"] == "hard"


def test_corrupt_json_returns_defaults(tmp_path):
    config_file = tmp_path / "subway_scaler.json"
    config_file.write_text("{invalid json", encoding="utf-8")
    settings_module.init(tmp_path)
    client = _make_client(tmp_path)
    r = client.get("/api/plugins/subway-scaler/settings")
    assert r.status_code == 200


def test_legacy_migration(tmp_path):
    from services.settings import PLUGIN_DIR
    legacy = PLUGIN_DIR / "data" / "settings.json"
    target = tmp_path / "subway_scaler.json"
    # Create legacy file with known content
    legacy.parent.mkdir(parents=True, exist_ok=True)
    test_data = '{"lastScaleId":"major","lastRootMidi":60,"lastDifficulty":"easy","strictOctave":false,"instrumentId":"guitar-standard","strictTuning":false,"audio":{"deviceId":null,"deviceLabel":"","sampleRate":44100,"toleranceCents":50,"confidenceThreshold":0.8,"stabilityFrames":3}}'
    legacy.write_text(test_data, encoding="utf-8")
    try:
        settings_module.init(tmp_path)
        assert target.exists(), "Settings should have been migrated to config_dir"
        assert legacy.with_suffix(".json.bak").exists(), "Legacy should be renamed to .bak"
        assert not legacy.exists(), "Legacy file should no longer exist"
    finally:
        # Cleanup: remove bak file if test created it
        bak = legacy.with_suffix(".json.bak")
        if bak.exists():
            bak.unlink()
