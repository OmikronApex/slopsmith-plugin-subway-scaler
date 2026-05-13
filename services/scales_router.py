"""FastAPI router for /api/plugins/subway_scaler/scales*."""
from __future__ import annotations

from fastapi import APIRouter

from services.errors import error_response
from services.schemas import ScaleListResponse, ScaleNotesResponse, TabulateRequest
from services import scales as scales_service
from services import instruments as instruments_service
from services.tabulator import Tabulator, GeometryValidator

router = APIRouter(prefix="/api/plugins/subway-scaler", tags=["scales"])
tabulator = Tabulator()
validator = GeometryValidator()


@router.get("/scales", response_model=ScaleListResponse)
def get_scales():
    return ScaleListResponse(scales=scales_service.list_scales())


@router.get("/scales/{scale_id}")
def get_scale(scale_id: str):
    try:
        return scales_service.get_scale(scale_id)
    except scales_service.ScaleNotFound:
        return error_response("scale-not-found", f"Unknown scale id: {scale_id}", 404)


@router.get("/scales/{scale_id}/notes")
def get_scale_notes(scale_id: str, root_midi: int, octaves: int = 1, descending: bool = False):
    try:
        notes = scales_service.expand(scale_id, root_midi, octaves, descending)
    except scales_service.ScaleNotFound:
        return error_response("scale-not-found", f"Unknown scale id: {scale_id}", 404)
    except scales_service.InvalidRoot:
        return error_response(
            "invalid-root", "root_midi must be in [21, 108]", 422,
            fields={"root_midi": "must be in [21, 108]"},
        )
    except scales_service.InvalidOctaves:
        return error_response(
            "invalid-octaves", "octaves must be 1 or 2", 422,
            fields={"octaves": "must be 1 or 2"},
        )
    body = ScaleNotesResponse(
        scaleId=scale_id, rootMidi=root_midi, octaves=octaves, descending=descending, notes=notes,
    )
    return body


@router.post("/scales/{scale_id}/tabulate")
def post_tabulate(scale_id: str, req: TabulateRequest):
    try:
        scale = scales_service.get_scale(scale_id)
        
        # Get instrument
        instrument = instruments_service.get(req.instrument_id)
        if not instrument:
            return error_response("instrument-not-found", f"Unknown instrument id: {req.instrument_id}", 404)
            
        pattern = tabulator.encode_scale(scale, req.root_note, instrument.tuning)
        
        # Validation
        is_valid, errors = validator.validate_pattern(pattern, instrument)
        if not is_valid:
            return error_response("invalid-geometry", "Pattern is unplayable", 422, fields={"pattern": "; ".join(errors)})
            
        return pattern
    except scales_service.ScaleNotFound:
        return error_response("scale-not-found", f"Unknown scale id: {scale_id}", 404)
    except ValueError as e:
        return error_response("invalid-request", str(e), 422)
