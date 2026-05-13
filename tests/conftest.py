"""Shared pytest fixtures: FastAPI TestClient and a temp settings file path."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import routes  # noqa: E402


@pytest.fixture
def tmp_settings_path(tmp_path, monkeypatch):
    """Point services.settings at a per-test temp file."""
    from services import settings as settings_module

    path = tmp_path / "settings.json"
    monkeypatch.setattr(settings_module, "SETTINGS_PATH", path)
    return path


@pytest.fixture
def client(tmp_settings_path) -> TestClient:
    app = FastAPI()
    routes.setup(app, {})
    return TestClient(app)
