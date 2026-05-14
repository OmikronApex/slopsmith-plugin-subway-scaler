from services.schemas import SpeedMultiplier

class SpeedService:
    def __init__(self, base_increment: float = 1.02):
        self.state = SpeedMultiplier(base_increment=base_increment)

    def increment(self) -> float:
        """Increments multiplier and returns the new value.
        """
        self.state.current_value *= self.state.base_increment
        self.state.notes_played += 1
        return self.state.current_value

    def reset(self):
        """Resets the multiplier to initial state.
        """
        self.state.current_value = 1.0
        self.state.notes_played = 0

    def get_current_multiplier(self) -> float:
        return self.state.current_value
