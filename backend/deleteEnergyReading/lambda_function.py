import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'common'))
import json
import boto3

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('EnergyReadings')

def lambda_handler(event, context):
    try:
        body = json.loads(event['body'])

        meter_id = body.get('meterId')
        timestamp = body.get('timestamp')

        if not meter_id or not timestamp:
            return {
                'statusCode': 400,
                'headers': {
                    "Access-Control-Allow-Origin": "*"
                },
                'body': json.dumps({'error': 'meterId and timestamp required'})
            }

        table.delete_item(
            Key={
                'meterId': meter_id,
                'timestamp': timestamp
            }
        )

        return {
            'statusCode': 200,
            'headers': {
                "Access-Control-Allow-Origin": "*"
            },
            'body': json.dumps({'message': 'Deleted successfully'})
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                "Access-Control-Allow-Origin": "*"
            },
            'body': json.dumps({'error': str(e)})
        }