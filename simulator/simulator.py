import requests
import random
import time

API_URL = "https://dpn4u69wn0.execute-api.us-east-1.amazonaws.com/process-energy"

while True:
    data = {
        "meterId": "meter-1",
        "consumptionValue": random.randint(50, 1000)
    }

    response = requests.post(API_URL, json=data)

    print("Sent:", data)
    print("Response:", response.text)
    print("-" * 40)

    time.sleep(5)  # send every 5 seconds