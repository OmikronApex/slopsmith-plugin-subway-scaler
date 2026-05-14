from services.speed_service import SpeedService

def test_speed_multiplier_increment():
    service = SpeedService(base_increment=1.02)
    assert service.get_current_multiplier() == 1.0
    
    val1 = service.increment()
    # Using approx for float comparison
    assert abs(val1 - 1.02) < 1e-6
    assert service.state.notes_played == 1
    
    val2 = service.increment()
    assert abs(val2 - (1.02 * 1.02)) < 1e-6
    assert service.state.notes_played == 2

def test_speed_multiplier_reset():
    service = SpeedService()
    service.increment()
    service.reset()
    assert service.get_current_multiplier() == 1.0
    assert service.state.notes_played == 0
