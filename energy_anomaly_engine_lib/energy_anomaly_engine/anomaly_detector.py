def detect_anomaly(current_value, moving_avg, multiplier=1.5):
    if moving_avg <= 0:
        return False, 0

    is_anomaly = current_value > moving_avg * multiplier
    deviation = (current_value - moving_avg) / moving_avg

    return is_anomaly, deviation
