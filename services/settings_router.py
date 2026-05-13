"""FastAPI router for /api/plugins/subway_scaler/settings."""
from __future__ import annotations

from fastapi import APIRouter, Request

from services.errors import error_response
from services.schemas import PlayerSettings
from services import settings as settings_service

router = APIRouter(prefix="/api/plugins/subway-scaler", tags=["settings"])


@router.get("/settings", response_model=PlayerSettings)
def get_settings():
    return settings_service.load()


@router.put("/settings")
async def put_settings(request: Request):
    try:
        raw = await request.json()
    except Exception:
        return error_response("invalid-settings", "Body must be JSON", 422)
    try:
        saved = settings_service.validate_and_save(raw)
    except settings_service.InvalidSettings as e:
        return error_response("invalid-settings", "Settings failed validation", 422, fields=e.fields)
    return saved
