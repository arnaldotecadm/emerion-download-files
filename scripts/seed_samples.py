import boto3, os
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
s3 = boto3.client('s3',
    aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
    aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    region_name='eu-north-1')
B = 'emerion-program-fles'
V = 'EComercial/2026-06-01/'
samples = {
    'RELEASE_NOTES.md': b'# EComercial 2026-06-01\n\n- Sample release artifact for the Emerion Release Vault portal.\n- Generated for demo/testing of presigned download links.\n',
    'config.json': b'{\n  "module": "EComercial",\n  "version": "2026-06-01",\n  "env": "production"\n}\n',
    'EComercial-2026-06-01.zip': os.urandom(48000),
    'EComercial-setup.exe': os.urandom(96000),
    'checksums.sha256': b'd41d8cd98f00b204e9800998ecf8427e  EComercial-2026-06-01.zip\n',
}
for name, data in samples.items():
    s3.put_object(Bucket=B, Key=V + name, Body=data)
    print('uploaded', V + name, len(data))
print('done')
