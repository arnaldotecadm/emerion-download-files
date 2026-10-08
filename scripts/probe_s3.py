import boto3, os
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
s3 = boto3.client('s3',
    aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
    aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    region_name='us-east-1')
try:
    buckets = s3.list_buckets().get('Buckets', [])
    print('BUCKETS:', [b['Name'] for b in buckets])
    for b in buckets:
        name = b['Name']
        try:
            loc = s3.get_bucket_location(Bucket=name).get('LocationConstraint')
            print('REGION', name, loc)
        except Exception as e:
            print('loc err', name, e)
except Exception as e:
    print('list_buckets ERROR:', repr(e))
