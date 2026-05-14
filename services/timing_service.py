"""Timing service for calculating cart movement speeds.
"""

def calculate_cart_speed(track_length: float, timer_duration_ms: float) -> float:
    """Calculates speed in units per millisecond.
    """
    if timer_duration_ms <= 0:
        return 0.0
    return track_length / timer_duration_ms
