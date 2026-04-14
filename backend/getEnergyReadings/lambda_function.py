
import boto3
import json
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('EnergyReadings')


def convert_decimal(obj):
    if isinstance(obj, list):
        return [convert_decimal(i) for i in obj]

    elif isinstance(obj, dict):
        return {k: convert_decimal(v) for k, v in obj.items()}

    elif isinstance(obj, Decimal):
        return float(obj)

    elif isinstance(obj, str):
        # Convert ONLY numeric strings, keep timestamps safe
        try:
            if obj.replace('.', '', 1).isdigit():
                return float(obj)
            return obj
        except:
            return obj

    else:
        return obj


def lambda_handler(event, context):
    try:
        # Fetch data from DynamoDB
        response = table.scan()
        items = response.get('Items', [])

        # Clean data (Decimal → float, safe conversion)
        clean_items = convert_decimal(items)

        # Sort by timestamp (latest first)
        clean_items.sort(
            key=lambda x: str(x.get("timestamp", "")),
            reverse=True
        )

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*'
            },
            'body': json.dumps(clean_items)
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*'
            },
            'body': json.dumps({
                'error': str(e)
            })
        }