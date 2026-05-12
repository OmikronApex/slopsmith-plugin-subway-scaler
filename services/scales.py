"""Scale catalog and expansion logic.

The catalog satisfies FR-001: major, natural minor, the seven diatonic modes,
plus pentatonics and blues. Expansion follows data-model.md §ExpectedNote.
"""
from __future__ import annotations

from typing import Optional

from services.schemas import Note, Scale

_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def midi_to_name(midi: int) -> str:
    return f"{_NOTE_NAMES[midi % 12]}{(midi // 12) - 1}"


def midi_to_frequency(midi: int) -> float:
    return 440.0 * (2.0 ** ((midi - 69) / 12.0))


def make_note(midi: int) -> Note:
    return Note(midi=midi, name=midi_to_name(midi), frequencyHz=midi_to_frequency(midi))


_RAW_SCALES: list[tuple[str, str, list[int]]] = [
    ("major", "Major", [0, 2, 4, 5, 7, 9, 11, 12]),
    ("natural-minor", "Natural Minor", [0, 2, 3, 5, 7, 8, 10, 12]),
    ("harmonic-minor", "Harmonic Minor", [0, 2, 3, 5, 7, 8, 11, 12]),
    ("melodic-minor", "Melodic Minor (ascending)", [0, 2, 3, 5, 7, 9, 11, 12]),
    ("ionian", "Ionian", [0, 2, 4, 5, 7, 9, 11, 12]),
    ("dorian", "Dorian", [0, 2, 3, 5, 7, 9, 10, 12]),
    ("phrygian", "Phrygian", [0, 1, 3, 5, 7, 8, 10, 12]),
    ("lydian", "Lydian", [0, 2, 4, 6, 7, 9, 11, 12]),
    ("mixolydian", "Mixolydian", [0, 2, 4, 5, 7, 9, 10, 12]),
    ("aeolian", "Aeolian", [0, 2, 3, 5, 7, 8, 10, 12]),
    ("locrian", "Locrian", [0, 1, 3, 5, 6, 8, 10, 12]),
    ("major-pentatonic", "Major Pentatonic", [0, 2, 4, 7, 9, 12]),
    ("minor-pentatonic", "Minor Pentatonic", [0, 3, 5, 7, 10, 12]),
    ("blues", "Blues", [0, 3, 5, 6, 7, 10, 12]),
]

SCALES: dict[str, Scale] = {
    sid: Scale(id=sid, name=name, intervals=intervals)
    for sid, name, intervals in _RAW_SCALES
}


def list_scales() -> list[Scale]:
    return list(SCALES.values())


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
