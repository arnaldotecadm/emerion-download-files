import boto3, os, json, base64
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
REGION='eu-north-1'; UP='eu-north-1_NtDQLSmuT'; CID='395rpr7l5274ei0ivbjm6l2ptd'
POOL='eu-north-1:904ac5e6-6753-4caf-a153-94fecab60d0e'
PROVIDER=f'cognito-idp.{REGION}.amazonaws.com/{UP}'
EMAIL='releasevault-admin@emerion.test'; PW='Rel3aseVault!2026'

idp=boto3.client('cognito-idp',region_name=REGION,
 aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'])
ci=boto3.client('cognito-identity',region_name=REGION,
 aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'])

# ensure ADMIN_USER_PASSWORD_AUTH enabled
c=idp.describe_user_pool_client(UserPoolId=UP,ClientId=CID)['UserPoolClient']
flows=set(c.get('ExplicitAuthFlows') or [])
if 'ALLOW_ADMIN_USER_PASSWORD_AUTH' not in flows:
    flows |= {'ALLOW_ADMIN_USER_PASSWORD_AUTH','ALLOW_REFRESH_TOKEN_AUTH'}
    kw=dict(UserPoolId=UP,ClientId=CID,ClientName=c['ClientName'],ExplicitAuthFlows=sorted(flows),
      CallbackURLs=c.get('CallbackURLs'),LogoutURLs=c.get('LogoutURLs'),
      AllowedOAuthFlows=c.get('AllowedOAuthFlows'),AllowedOAuthScopes=c.get('AllowedOAuthScopes'),
      AllowedOAuthFlowsUserPoolClient=True,SupportedIdentityProviders=c.get('SupportedIdentityProviders'))
    idp.update_user_pool_client(**{k:v for k,v in kw.items() if v is not None})
    print('enabled ADMIN_USER_PASSWORD_AUTH')

auth=idp.admin_initiate_auth(UserPoolId=UP,ClientId=CID,AuthFlow='ADMIN_USER_PASSWORD_AUTH',
  AuthParameters={'USERNAME':EMAIL,'PASSWORD':PW})
idtok=auth['AuthenticationResult']['IdToken']

def claims(tok):
    p=tok.split('.')[1]; p+='='*(-len(p)%4)
    return json.loads(base64.urlsafe_b64decode(p))
cl=claims(idtok)
print('TOKEN cognito:groups =', cl.get('cognito:groups'))
print('TOKEN cognito:preferred_role =', cl.get('cognito:preferred_role'))
print('TOKEN cognito:roles =', cl.get('cognito:roles'))

logins={PROVIDER: idtok}
cid_id=ci.get_id(IdentityPoolId=POOL, Logins=logins)['IdentityId']
cr=ci.get_credentials_for_identity(IdentityId=cid_id, Logins=logins)['Credentials']
sts=boto3.client('sts',region_name=REGION,aws_access_key_id=cr['AccessKeyId'],
  aws_secret_access_key=cr['SecretKey'],aws_session_token=cr['SessionToken'])
print('ASSUMED ROLE =', sts.get_caller_identity()['Arn'])

s3=boto3.client('s3',region_name=REGION,aws_access_key_id=cr['AccessKeyId'],
  aws_secret_access_key=cr['SecretKey'],aws_session_token=cr['SessionToken'])
try:
    s3.put_object(Bucket='emerion-program-fles',Key='EComercial/2026-10-08/repro_test.txt',Body=b'repro')
    print('PUT OK')
except Exception as e:
    print('PUT FAILED:', repr(e))
