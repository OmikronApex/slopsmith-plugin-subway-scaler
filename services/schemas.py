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


class StringFretPair(BaseModel):
    string: int = Field(..., ge=1, le=6)
    fret: int = Field(..., ge=0, le=24)


class ScalePattern(BaseModel):
    scaleId: str
    rootNote: str
    pattern: list[StringFretPair]


class TabulateRequest(BaseModel):
    root_note: str
    instrument_id: str = "guitar-standard"


class Note(BaseModel):
    midi: int = Field(..., ge=21, le=108)
    name: str
    frequencyHz: float
    fret: Optional[int] = None
    string: Optional[int] = None


class ScaleListResponse(BaseModel):
    scales: list[Scale]


class ScaleNotesResponse(BaseModel):
    scaleId: str
    rootMidi: int
    octaves: int
    descending: bool
    notes: list[Note]


InstrumentKind = Literal["guitar", "bass"]


class Instrument(BaseModel):
    id: str
    name: str
    kind: InstrumentKind
    stringCount: int = Field(..., ge=4, le=6)
    tuning: list[int]
    maxFret: int = Field(..., ge=12, le=24)

    @field_validator("id")
    @classmethod
    def _validate_id(cls, v: str) -> str:
        import re
        if not re.fullmatch(r"[a-z0-9-]+", v):
            raise ValueError("id must match ^[a-z0-9-]+$")
        return v

    @field_validator("tuning")
    @classmethod
    def _validate_tuning(cls, v: list[int]) -> list[int]:
        if len(v) not in (4, 6):
            raise ValueError("tuning length must be 4 or 6")
        if any(not (21 <= x <= 108) for x in v):
            raise ValueError("tuning values must be in [21, 108]")
        for a, b in zip(v, v[1:]):
            if b <= a:
                raise ValueError("tuning must be strictly increasing")
        return v

    def model_post_init(self, _ctx) -> None:
        if self.stringCount != len(self.tuning):
            raise ValueError("stringCount must equal len(tuning)")


class InstrumentListResponse(BaseModel):
    instruments: list[Instrument]


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
    instrumentId: str = "guitar-standard"
    strictTuning: bool = False
    audio: AudioInputSettings = Field(default_factory=AudioInputSettings)

    model_config = {"extra": "forbid"}


class ErrorBody(BaseModel):
    code: str
    message: str
    fields: Optional[dict[str, str]] = None


class ErrorResponse(BaseModel):
    error: ErrorBody

class SpeedMultiplier(BaseModel):
    current_value: float = 1.0
    base_increment: float = 1.02
    notes_played: int = 0

class Track(BaseModel):
    length: float
    spawn_z: float
    exit_boundary: float
    interaction_point_z: float
    queue_positions: list[float]

class GameState(BaseModel):
    carts: list[dict]
    track: Track
    speed_multiplier: SpeedMultiplier

VariantSide = Literal["LEFT", "RIGHT"]
VariantStateLit = Literal["SPAWNING", "ACTIVE", "SWITCH_TRIGGERED", "SWITCHED", "TIMEOUT"]
WindowStateLit = Literal["OPEN", "SWITCHED", "CLOSED"]


class VariantTrackSet(BaseModel):
    """A proposed alternate track set anchored at a different root_midi.

    Spec: 008-track-variants. Offered at milestones (e.g., every 2 octave loops).
    `base_lane` is the lane index of the variant's root note (the lane the
    player must "land" on to switch) — used by the renderer to draw a target
    highlight.
    """
    variant_id: str
    root_midi: int = Field(..., ge=21, le=108)
    base_fret: int = Field(..., ge=0, le=24)
    num_lanes: int = Field(..., ge=3, le=12)
    base_lane: int = Field(0, ge=0, le=11)
    base_string: int = Field(1, ge=1, le=6)
    side: VariantSide
    state: VariantStateLit = "SPAWNING"
    spawned_at_ms: int


class SwitchWindow(BaseModel):
    """Time-limited window during which playing the variant root triggers a switch."""
    variant_id: str
    opened_at_ms: int
    deadline_ms: int
    state: WindowStateLit = "OPEN"
    trigger_midi: int
