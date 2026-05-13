"""FastAPI router for /api/plugins/subway-scaler/instruments."""
from __future__ import annotations

from fastapi import APIRouter

from services.schemas import InstrumentListResponse
from services import instruments as instruments_service

router = APIRouter(prefix="/api/plugins/subway-scaler", tags=["instruments"])


@router.get("/instruments", response_model=InstrumentListResponse)
def get_instruments():
    return InstrumentListResponse(instruments=instruments_service.list_instruments())
