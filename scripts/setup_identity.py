import boto3, os, json, time
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
REGION = 'eu-north-1'
BUCKET = 'emerion-program-fles'
USER_POOL = 'eu-north-1_NtDQLSmuT'
CLIENT_ID = '395rpr7l5274ei0ivbjm6l2ptd'
PROVIDER = f'cognito-idp.{REGION}.amazonaws.com/{USER_POOL}'
POOL_NAME = 'emerion_release_vault'

sess = boto3.Session(
    aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
    aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'], region_name=REGION)
ci = sess.client('cognito-identity'); iam = sess.client('iam')
idp = sess.client('cognito-idp'); s3 = sess.client('s3')

providers = [{'ProviderName': PROVIDER, 'ClientId': CLIENT_ID, 'ServerSideTokenCheck': False}]

pool_id = None
for pg in ci.get_paginator('list_identity_pools').paginate(MaxResults=60):
    for p in pg['IdentityPools']:
        if p['IdentityPoolName'] == POOL_NAME:
            pool_id = p['IdentityPoolId']
if not pool_id:
    pool_id = ci.create_identity_pool(
        IdentityPoolName=POOL_NAME, AllowUnauthenticatedIdentities=True,
        CognitoIdentityProviders=providers)['IdentityPoolId']
else:
    ci.update_identity_pool(IdentityPoolId=pool_id, IdentityPoolName=POOL_NAME,
        AllowUnauthenticatedIdentities=True, CognitoIdentityProviders=providers)
print('POOL_ID=' + pool_id)


def trust(amr):
    return json.dumps({"Version": "2012-10-17", "Statement": [{
        "Effect": "Allow", "Principal": {"Federated": "cognito-identity.amazonaws.com"},
        "Action": "sts:AssumeRoleWithWebIdentity",
        "Condition": {"StringEquals": {"cognito-identity.amazonaws.com:aud": pool_id},
                      "ForAnyValue:StringLike": {"cognito-identity.amazonaws.com:amr": amr}}}]})


read_policy = json.dumps({"Version": "2012-10-17", "Statement": [
    {"Sid": "List", "Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": f"arn:aws:s3:::{BUCKET}"},
    {"Sid": "Get", "Effect": "Allow", "Action": ["s3:GetObject"], "Resource": f"arn:aws:s3:::{BUCKET}/*"}]})
admin_policy = json.dumps({"Version": "2012-10-17", "Statement": [
    {"Sid": "List", "Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": f"arn:aws:s3:::{BUCKET}"},
    {"Sid": "Get", "Effect": "Allow", "Action": ["s3:GetObject"], "Resource": f"arn:aws:s3:::{BUCKET}/*"},
    {"Sid": "Put", "Effect": "Allow", "Action": ["s3:PutObject"], "Resource": f"arn:aws:s3:::{BUCKET}/*"}]})


def ensure_role(name, amr, policy):
    try:
        iam.get_role(RoleName=name)
        iam.update_assume_role_policy(RoleName=name, PolicyDocument=trust(amr))
    except iam.exceptions.NoSuchEntityException:
        iam.create_role(RoleName=name, AssumeRolePolicyDocument=trust(amr),
                        Description='Emerion Release Vault client-side S3 access')
    iam.put_role_policy(RoleName=name, PolicyName='s3access', PolicyDocument=policy)
    return iam.get_role(RoleName=name)['Role']['Arn']


guest_arn = ensure_role('EmerionReleaseVault-Guest', 'unauthenticated', read_policy)
auth_arn = ensure_role('EmerionReleaseVault-Auth', 'authenticated', read_policy)
admin_arn = ensure_role('EmerionReleaseVault-Admin', 'authenticated', admin_policy)
print('guest', guest_arn); print('auth', auth_arn); print('admin', admin_arn)

roles = {'authenticated': auth_arn, 'unauthenticated': guest_arn}
mappings = {f'{PROVIDER}:{CLIENT_ID}': {'Type': 'Token', 'AmbiguousRoleResolution': 'AuthenticatedRole'}}
for i in range(6):
    try:
        ci.set_identity_pool_roles(IdentityPoolId=pool_id, Roles=roles, RoleMappings=mappings)
        print('pool roles set'); break
    except Exception as e:
        print('retry set roles (%d): %s' % (i, e)); time.sleep(5)

try:
    idp.get_group(GroupName='ADMIN', UserPoolId=USER_POOL)
    idp.update_group(GroupName='ADMIN', UserPoolId=USER_POOL, RoleArn=admin_arn, Precedence=1)
except idp.exceptions.ResourceNotFoundException:
    idp.create_group(GroupName='ADMIN', UserPoolId=USER_POOL, RoleArn=admin_arn, Precedence=1)
print('ADMIN group ready')

s3.put_bucket_cors(Bucket=BUCKET, CORSConfiguration={'CORSRules': [{
    'AllowedHeaders': ['*'], 'AllowedMethods': ['GET', 'PUT', 'POST', 'HEAD'],
    'AllowedOrigins': ['*'], 'ExposeHeaders': ['ETag'], 'MaxAgeSeconds': 3000}]})
print('bucket CORS set')
print('DONE_POOL_ID=' + pool_id)
