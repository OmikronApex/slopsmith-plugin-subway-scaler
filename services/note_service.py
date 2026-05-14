from typing import Any

class NoteService:
    def __init__(self, sequence: list[Any]):
        self.sequence = sequence
        self.cursor = 0

    def get_next_note(self) -> Any:
        if not self.sequence:
            return None
        self.cursor = (self.cursor + 1) % len(self.sequence)
        return self.sequence[self.cursor]

    def get_current_note(self) -> Any:
        if not self.sequence:
            return None
        return self.sequence[self.cursor]

    def reset(self):
        self.cursor = 0
