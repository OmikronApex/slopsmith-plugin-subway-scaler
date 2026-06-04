"""Contract tests for GET /api/plugins/subway-scaler/sprites/{filename}."""
from __future__ import annotations


def test_running_sprite_ok(client):
    r = client.get("/api/plugins/subway-scaler/sprites/Character_running_north.gif")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/gif"


def test_powerslide_sprite_ok(client):
    r = client.get("/api/plugins/subway-scaler/sprites/Character_powerslide_north.gif")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/gif"


def test_path_traversal_rejected(client):
    r = client.get("/api/plugins/subway-scaler/sprites/../routes.py")
    assert r.status_code in (400, 404)


def test_nonexistent_sprite_404(client):
    r = client.get("/api/plugins/subway-scaler/sprites/nonexistent.gif")
    assert r.status_code == 404


def test_disallowed_extension_404(client):
    r = client.get("/api/plugins/subway-scaler/sprites/routes.py")
    assert r.status_code == 404
