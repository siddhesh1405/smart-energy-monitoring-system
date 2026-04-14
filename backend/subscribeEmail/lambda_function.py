import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'common'))
import json
import boto3

sns = boto3.client('sns')

TOPIC_ARN = "arn:aws:sns:us-east-1:350532691557:energy-alerts"

def lambda_handler(event, context):
    try:
        body = json.loads(event['body'])
        email = body.get('email')

        if not email:
            return {
                'statusCode': 400,
                'headers': {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*"
                },
                'body': json.dumps({'error': 'Email is required'})
            }

        sns.subscribe(
            TopicArn=TOPIC_ARN,
            Protocol='email',
            Endpoint=email
        )

        return {
            'statusCode': 200,
            'headers': {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*"
            },
            'body': json.dumps({
                'message': 'Subscription request sent. Please check your email to confirm.'
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