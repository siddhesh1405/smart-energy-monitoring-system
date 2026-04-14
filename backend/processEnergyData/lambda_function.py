
import json
import boto3
from datetime import datetime
from decimal import Decimal

from energy_anomaly_engine.moving_average import calculate_moving_average
from energy_anomaly_engine.risk_classifier import classify_risk

sns = boto3.client('sns')
TOPIC_ARN = "arn:aws:sns:us-east-1:350532691557:energy-alerts"

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('EnergyReadings')

def to_decimal(value):
    return Decimal(str(value))

def lambda_handler(event, context):
    try:
        body = json.loads(event['body'])

        meter_id = body.get('meterId', 'meter-1')
        consumption = float(body.get('consumptionValue', 0))

        response = table.scan()
        items = response.get('Items', [])

        filtered_items = [
            item for item in items
            if item.get('meterId') == meter_id
        ]

        filtered_items.sort(key=lambda x: str(x.get('timestamp', '')))

        recent_items = filtered_items[-5:]

        past_data = [
            float(item['consumptionValue'])
            for item in recent_items
        ]

        if not past_data:
            past_data = [consumption]

        avg = calculate_moving_average(past_data)

        risk, is_anomaly = classify_risk(consumption, avg)

        if is_anomaly:
            sns.publish(
                TopicArn=TOPIC_ARN,
                Message=f"High energy usage detected: {consumption} kWh",
                Subject="Energy Alert"
            )

        timestamp = datetime.utcnow().isoformat()

        table.put_item(
            Item={
                'meterId': meter_id,
                'timestamp': timestamp,
                'consumptionValue': to_decimal(consumption),
                'movingAverage': to_decimal(avg),
                'anomalyDetected': is_anomaly,
                'riskLevel': risk
            }
        )

        return {
            'statusCode': 200,
            'headers': {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*"
            },
            'body': json.dumps({
                'message': 'Processed successfully',
                'anomaly': is_anomaly,
                'risk': risk
            })
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*"
            },
            'body': json.dumps({
                'error': str(e)
            })
        }