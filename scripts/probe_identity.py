import boto3, os, json
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
sess = boto3.Session(
    aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
    aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    region_name='eu-north-1')
ci = sess.client('cognito-identity')
iam = sess.client('iam')
POOL = 'eu-north-1:4676bb00-39f6-4322-8899-e958aa3cb0e5'

print('== describe_identity_pool ==')
d = ci.describe_identity_pool(IdentityPoolId=POOL)
print('name:', d.get('IdentityPoolName'))
print('AllowUnauthenticated:', d.get('AllowUnauthenticatedIdentities'))
print('CognitoProviders:', json.dumps(d.get('CognitoIdentityProviders', []), default=str))
print('OpenIdConnectProviderARNs:', d.get('OpenIdConnectProviderARNs'))

print('\n== get_identity_pool_roles ==')
r = ci.get_identity_pool_roles(IdentityPoolId=POOL)
print('roles:', json.dumps(r.get('Roles', {}), default=str))
print('role_mappings:', json.dumps(r.get('RoleMappings', {}), default=str))

def dump_role(arn):
    name = arn.split('/')[-1]
    print('\n-- role', name)
    try:
        ap = iam.list_attached_role_policies(RoleName=name).get('AttachedPolicies', [])
        print('  attached:', [p['PolicyName'] for p in ap])
        for p in ap:
            pv = iam.get_policy(PolicyArn=p['PolicyArn'])['Policy']['DefaultVersionId']
            doc = iam.get_policy_version(PolicyArn=p['PolicyArn'], VersionId=pv)['PolicyVersion']['Document']
            print('    ', p['PolicyName'], json.dumps(doc))
        il = iam.list_role_policies(RoleName=name).get('PolicyNames', [])
        print('  inline:', il)
        for pn in il:
            doc = iam.get_role_policy(RoleName=name, PolicyName=pn)['PolicyDocument']
            print('    ', pn, json.dumps(doc))
    except Exception as e:
        print('  role inspect error:', e)

for k, arn in r.get('Roles', {}).items():
    dump_role(arn)
