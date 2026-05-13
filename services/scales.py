"""Scale catalog and expansion logic.

The catalog satisfies FR-001: major, natural minor, the seven diatonic modes,
plus pentatonics and blues. Expansion follows data-model.md §ExpectedNote.
"""
from __future__ import annotations

import json
import os
from typing import Optional

from services.schemas import Note, Scale

_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def midi_to_name(midi: int) -> str:
    return f"{_NOTE_NAMES[midi % 12]}{(midi // 12) - 1}"


def midi_to_frequency(midi: int) -> float:
    return 440.0 * (2.0 ** ((midi - 69) / 12.0))


def make_note(midi: int) -> Note:
    return Note(midi=midi, name=midi_to_name(midi), frequencyHz=midi_to_frequency(midi))


def load_scales_from_json(path: str) -> list[Scale]:
    """Loads scale definitions from a JSON file."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return [Scale(**s) for s in data["scales"]]
    except Exception as e:
        raise ValueError(f"Failed to load scales from {path}: {e}")


# Initialize scale catalog from JSON
_default_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), "..", "scales.json")
try:
    _loaded = load_scales_from_json(_default_path)
    SCALES: dict[str, Scale] = {s.id: s for s in _loaded}
except Exception:
    # Mandatory for plugin operation
    SCALES = {}


def list_scales() -> list[Scale]:
    return list(SCALES.values())


def get_scale(scale_id: str) -> Scale:
    """Retrieves a single scale by ID."""
    if scale_id not in SCALES:
        raise ScaleNotFound(scale_id)
    return SCALES[scale_id]


class ScaleNotFound(Exception):
    pass


class InvalidRoot(Exception):
    pass


class InvalidOctaves(Exception):
    pass


def expand(
    scale_id: str,
    root_midi: int,
    octaves: int = 1,
    descending: bool = False,
) -> list[Note]:
    if scale_id not in SCALES:
        raise ScaleNotFound(scale_id)
    if not (21 <= root_midi <= 108):
        raise InvalidRoot(root_midi)
    if octaves not in (1, 2):
        raise InvalidOctaves(octaves)

    intervals = SCALES[scale_id].intervals
    midis: list[int] = []
    # Repeat the within-octave portion for each octave block, then add the apex once.
    body = intervals[:-1]
    apex = intervals[-1]
    for k in range(octaves):
        for iv in body:
            midis.append(root_midi + iv + 12 * k)
    midis.append(root_midi + apex + 12 * (octaves - 1))

    if descending:
        midis.extend(reversed(midis[:-1]))

    return [make_note(m) for m in midis]
