
import json
import boto3
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('EnergyReadings')

def lambda_handler(event, context):
    try:
        body = json.loads(event['body'])

        meter_id = body.get('meterId')
        timestamp = body.get('timestamp')
        consumption = float(body.get('consumptionValue'))

        if not meter_id or not timestamp:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Missing fields'})
            }

        # 🔹 Get past data for average
        response = table.scan()
        items = response.get('Items', [])

        past_values = [
            float(item['consumptionValue'])
            for item in items
            if item.get('meterId') == meter_id and item.get('timestamp') != timestamp
        ]

        # 🔹 Last 5 values
        past_values = past_values[-5:] if past_values else [consumption]

        avg = sum(past_values) / len(past_values)

        # 🔹 Recalculate risk + anomaly
        if avg > 0 and (consumption > avg * 1.5 and consumption > 200):
            risk = "HIGH"
            anomaly = True
        else:
            risk = "NORMAL"
            anomaly = False

        # 🔹 Update ALL fields
        table.update_item(
            Key={
                'meterId': meter_id,
                'timestamp': timestamp
            },
            UpdateExpression="""
                SET consumptionValue = :val,
                    movingAverage = :avg,
                    anomalyDetected = :anomaly,
                    riskLevel = :risk
            """,
            ExpressionAttributeValues={
                ':val': Decimal(str(consumption)),
                ':avg': Decimal(str(avg)),
                ':anomaly': anomaly,
                ':risk': risk
            }
        )

        return {
            'statusCode': 200,
            'headers': {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*"
            },
            'body': json.dumps({
                'message': 'Updated with recalculated risk',
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
            'body': json.dumps({'error': str(e)})
        }