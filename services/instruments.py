"""Instrument registry for the Subway Scaler plugin.

Static data per `specs/003-guitar-subway-scaler/data-model.md`. Strings indexed
low-to-high; lane index = string index (lowest pitch is leftmost / front row).
"""
from __future__ import annotations

from services.schemas import Instrument


_RAW: list[Instrument] = [
    Instrument(
        id="guitar-standard",
        name="Guitar (Standard)",
        kind="guitar",
        stringCount=6,
        tuning=[40, 45, 50, 55, 59, 64],
        maxFret=24,
    ),
    Instrument(
        id="bass-4-standard",
        name="Bass 4-string (Standard)",
        kind="bass",
        stringCount=4,
        tuning=[28, 33, 38, 43],
        maxFret=24,
    ),
    Instrument(
        id="bass-5-standard",
        name="Bass 5-string (Standard)",
        kind="bass",
        stringCount=5,
        tuning=[23, 28, 33, 38, 43],
        maxFret=24,
    ),
    Instrument(
        id="guitar-7-standard",
        name="Guitar 7-string (Standard)",
        kind="guitar",
        stringCount=7,
        tuning=[35, 40, 45, 50, 55, 59, 64],
        maxFret=24,
    ),
    Instrument(
        id="guitar-8-standard",
        name="Guitar 8-string (Standard)",
        kind="guitar",
        stringCount=8,
        tuning=[30, 35, 40, 45, 50, 55, 59, 64],
        maxFret=24,
    ),
]

INSTRUMENTS: dict[str, Instrument] = {i.id: i for i in _RAW}


def list_instruments() -> list[Instrument]:
    return list(INSTRUMENTS.values())


def get(instrument_id: str) -> Instrument | None:
    return INSTRUMENTS.get(instrument_id)
