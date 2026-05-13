"""Single-shape error responses for the Subway Scaler API.

Shape from specs/002-subway-scales/contracts/api.md:
    { "error": { "code": ..., "message": ..., "fields"?: {...} } }
"""
from __future__ import annotations

from typing import Optional

from fastapi.responses import JSONResponse


def error_response(
    code: str,
    message: str,
    status: int,
    fields: Optional[dict[str, str]] = None,
) -> JSONResponse:
    body: dict = {"error": {"code": code, "message": message}}
    if fields is not None:
        body["error"]["fields"] = fields
    return JSONResponse(status_code=status, content=body)
