"""Pydantic schemas shared by the FastAPI routers.

Shapes mirror specs/002-subway-scales/contracts/api.md.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


Difficulty = Literal["easy", "medium", "hard"]


class Scale(BaseModel):
    id: str
    name: str
    intervals: list[int]

    @field_validator("intervals")
    @classmethod
    def _validate_intervals(cls, v: list[int]) -> list[int]:
        if not v:
            raise ValueError("intervals must be non-empty")
        if v[0] != 0:
            raise ValueError("intervals must start at 0")
        if any(not (0 <= x <= 24) for x in v):
            raise ValueError("intervals must be in [0, 24]")
        for a, b in zip(v, v[1:]):
            if b <= a:
                raise ValueError("intervals must be strictly increasing")
        return v


class Note(BaseModel):
    midi: int = Field(..., ge=21, le=108)
    name: str
    frequencyHz: float


class ScaleListResponse(BaseModel):
    scales: list[Scale]


class ScaleNotesResponse(BaseModel):
    scaleId: str
    rootMidi: int
    octaves: int
    descending: bool
    notes: list[Note]


class AudioInputSettings(BaseModel):
    deviceId: Optional[str] = None
    deviceLabel: str = ""
    sampleRate: int = 48000
    toleranceCents: int = Field(50, ge=1, le=100)
    confidenceThreshold: float = Field(0.8, ge=0.0, le=1.0)
    stabilityFrames: int = Field(3, ge=1, le=10)


class PlayerSettings(BaseModel):
    lastScaleId: str = "major"
    lastRootMidi: int = Field(60, ge=21, le=108)
    lastOctaves: int = Field(1, ge=1, le=2)
    lastDifficulty: Difficulty = "medium"
    strictOctave: bool = False
    audio: AudioInputSettings = Field(default_factory=AudioInputSettings)

    model_config = {"extra": "forbid"}


class ErrorBody(BaseModel):
    code: str
    message: str
    fields: Optional[dict[str, str]] = None


class ErrorResponse(BaseModel):
    error: ErrorBody
