def classify_risk(consumption, avg):
    if avg > 0 and (consumption > avg * 1.5 and consumption > 200):
        return "HIGH", True
    return "NORMAL", False