def calculate_moving_average(data, window_size=5):
    if not data:
        return 0

    if len(data) < window_size:
        return sum(data) / len(data)

    window = data[-window_size:]
    return sum(window) / window_size
