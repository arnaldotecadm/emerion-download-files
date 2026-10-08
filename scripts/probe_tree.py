import boto3, os, json
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
s3 = boto3.client('s3',
    aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
    aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    region_name='eu-north-1')
B='emerion-program-fles'
def level(prefix=''):
    r=s3.list_objects_v2(Bucket=B, Prefix=prefix, Delimiter='/')
    folders=[c['Prefix'] for c in r.get('CommonPrefixes',[])]
    objs=[(o['Key'],o['Size']) for o in r.get('Contents',[])]
    return folders, objs
root_f, root_o = level('')
print('ROOT FOLDERS:', root_f)
print('ROOT OBJECTS:', root_o[:10])
for f in root_f:
    sf, so = level(f)
    print('\n==', f)
    print('  subfolders:', sf)
    print('  objects:', so[:10])
    for s in sf[:3]:
        ssf, sso = level(s)
        print('    --', s, 'subfolders:', ssf, 'objects:', sso[:5])
