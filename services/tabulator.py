from __future__ import annotations
from .schemas import Scale, ScalePattern, StringFretPair, Instrument

class GeometryValidator:
    """Validates if a scale pattern is physically playable on an instrument."""
    
    @staticmethod
    def validate_pattern(pattern: ScalePattern, instrument: Instrument) -> tuple[bool, list[str]]:
        """
        Validates the given scale pattern against an instrument.
        Returns (is_valid, list_of_error_messages).
        """
        errors = []
        for i, pair in enumerate(pattern.pattern):
            if not (1 <= pair.string <= instrument.stringCount):
                errors.append(f"Note {i}: String {pair.string} is out of range (1-{instrument.stringCount})")
            if not (0 <= pair.fret <= instrument.maxFret):
                errors.append(f"Note {i}: Fret {pair.fret} is out of range (0-{instrument.maxFret})")
        
        return len(errors) == 0, errors


class Tabulator:
    """Encodes scales as fret/string pairs."""

    def _note_to_midi_pc(self, note_name: str) -> int:
        """Converts note name to pitch class (0-11)."""
        names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
        standard = note_name.replace("Db", "C#").replace("Eb", "D#").replace("Gb", "F#").replace("Ab", "G#").replace("Bb", "A#")
        if standard not in names:
            raise ValueError(f"Invalid note name: {note_name}")
        return names.index(standard)

    def encode_scale(self, scale: Scale, root_note: str, tuning: list[int]) -> ScalePattern:
        """
        Maps scale intervals to fret/string pairs using a 'box' or 'finger pattern' approach.
        tuning: List of MIDI notes for open strings, LOW TO HIGH (e.g., [28, 33, 38, 43] for bass).
        """
        root_pc = self._note_to_midi_pc(root_note)
        pattern = []

        # Current implementation prefers lower frets and higher strings.
        # To match "natural" finger patterns, we should:
        # 1. Start on the lowest possible string for the root note.
        # 2. Stay within a 4-5 fret span.
        # 3. Use 2-4 notes per string.
        
        # String indexing: String 1 is highest pitch.
        # So high_to_low = [G, D, A, E]
        high_to_low = list(reversed(tuning))
        num_strings = len(high_to_low)
        
        # Find the starting string (lowest string that can play the root note with a reasonable fret)
        # We prefer frets 1-12 for the start of a scale if possible.
        # For bass E string (idx 4), A1 is fret 5.
        start_string_idx = num_strings  # 1-based index from High to Low
        start_fret = 0
        
        for s_idx in range(num_strings, 0, -1):
            open_midi = high_to_low[s_idx-1]
            open_pc = open_midi % 12
            fret = (root_pc - open_pc) % 12
            # If we want A1 (33) on E1 (28), it's fret 5.
            # My current PC-based logic (note_pc - open_pc)%12 gives 5.
            
            # Use the lowest string that can play the root (preferring frets > 0 to avoid open strings if requested?)
            # User wants 5,7,8 on E string. So start_string_idx=4, start_fret=5.
            if fret >= 0:
                start_string_idx = s_idx
                start_fret = fret
                # Break at first (lowest) string found
                break

        current_string_idx = start_string_idx
        
        for interval in scale.intervals:
            note_pc = (root_pc + interval) % 12
            
            # Find fret on current string
            open_midi = high_to_low[current_string_idx-1]
            open_pc = open_midi % 12
            fret = (note_pc - open_pc) % 12
            
            # If fret is too far or we have too many notes on this string, move to next string (higher pitch)
            # notes_on_current = len([p for p in pattern if p.string == current_string_idx])
            
            # Check if this note is better played on current string or next string
            # Natural pattern: approx 3 notes per string.
            # If fret > start_fret + 3 (approx 4 fret span), or we already have 3 notes:
            if (fret > start_fret + 3 or len([p for p in pattern if p.string == current_string_idx]) >= 3) and current_string_idx > 1:
                # Try next string (lower index)
                next_string_idx = current_string_idx - 1
                next_open_midi = high_to_low[next_string_idx-1]
                next_open_pc = next_open_midi % 12
                next_fret = (note_pc - next_open_pc) % 12
                
                # If next_fret is more "natural" (closer to start_fret), switch
                if abs(next_fret - start_fret) <= 3:
                    current_string_idx = next_string_idx
                    fret = next_fret

            pattern.append(StringFretPair(string=current_string_idx, fret=fret))

        return ScalePattern(
            scaleId=scale.id,
            rootNote=root_note,
            pattern=pattern
        )
