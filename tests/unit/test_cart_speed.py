from services.timing_service import calculate_cart_speed

def test_calculate_cart_speed():
    # Example: 10 units track, 2000ms duration -> 0.005 units/ms
    assert calculate_cart_speed(10, 2000) == 0.005
    assert calculate_cart_speed(10, 1000) == 0.01
    assert calculate_cart_speed(5, 2000) == 0.0025

def test_calculate_cart_speed_zero_duration():
    assert calculate_cart_speed(10, 0) == 0.0
    assert calculate_cart_speed(10, -100) == 0.0

def test_speed_timing_accuracy():
    track_length = 20.0
    timer_duration = 2000.0
    speed = calculate_cart_speed(track_length, timer_duration)
    
    # After 2000ms, distance should be exactly track_length
    distance = speed * timer_duration
    assert distance == 20.0
    
    # After 2000ms + 50ms, it should be slightly past
    distance_past = speed * (timer_duration + 50)
    assert distance_past == 20.5
