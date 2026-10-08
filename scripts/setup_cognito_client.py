import boto3, os, json
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
REGION='eu-north-1'; USER_POOL='eu-north-1_NtDQLSmuT'; CLIENT_ID='395rpr7l5274ei0ivbjm6l2ptd'
idp=boto3.client('cognito-idp',region_name=REGION,
 aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'])

ORIGINS=[
 'https://aws-download-hub.preview.emergentagent.com/',
 'http://localhost:5173/',
 'http://localhost:3000/',
]

c=idp.describe_user_pool_client(UserPoolId=USER_POOL,ClientId=CLIENT_ID)['UserPoolClient']
print('EXISTING callbacks:',c.get('CallbackURLs'))
print('EXISTING oauth flows:',c.get('AllowedOAuthFlows'),'scopes:',c.get('AllowedOAuthScopes'),'idp:',c.get('SupportedIdentityProviders'))

cb=sorted(set((c.get('CallbackURLs') or [])+ORIGINS))
lo=sorted(set((c.get('LogoutURLs') or [])+ORIGINS))
kwargs=dict(UserPoolId=USER_POOL,ClientId=CLIENT_ID,
  ClientName=c['ClientName'],
  CallbackURLs=cb, LogoutURLs=lo,
  AllowedOAuthFlows=sorted(set((c.get('AllowedOAuthFlows') or [])+['code'])),
  AllowedOAuthScopes=sorted(set((c.get('AllowedOAuthScopes') or [])+['openid','email','phone'])),
  AllowedOAuthFlowsUserPoolClient=True,
  SupportedIdentityProviders=c.get('SupportedIdentityProviders') or ['COGNITO'])
for k in ['RefreshTokenValidity','AccessTokenValidity','IdTokenValidity','TokenValidityUnits',
          'ReadAttributes','WriteAttributes','ExplicitAuthFlows','PreventUserExistenceErrors',
          'EnableTokenRevocation','AuthSessionValidity']:
    if c.get(k) is not None:
        kwargs[k]=c[k]
if not kwargs['SupportedIdentityProviders']:
    kwargs['SupportedIdentityProviders']=['COGNITO']
idp.update_user_pool_client(**kwargs)
print('UPDATED callbacks:',cb)
print('UPDATED logout:',lo)

# ---- test ADMIN user ----
pool=idp.describe_user_pool(UserPoolId=USER_POOL)['UserPool']
uname_attrs=pool.get('UsernameAttributes') or []
print('UsernameAttributes:',uname_attrs)
EMAIL='releasevault-admin@emerion.test'
USERNAME=EMAIL if 'email' in uname_attrs else 'releasevault-admin'
PASSWORD='Rel3aseVault!2026'
try:
    idp.admin_create_user(UserPoolId=USER_POOL,Username=USERNAME,MessageAction='SUPPRESS',
      UserAttributes=[{'Name':'email','Value':EMAIL},{'Name':'email_verified','Value':'true'}])
    print('created user',USERNAME)
except idp.exceptions.UsernameExistsException:
    print('user already exists',USERNAME)
idp.admin_set_user_password(UserPoolId=USER_POOL,Username=USERNAME,Password=PASSWORD,Permanent=True)
idp.admin_add_user_to_group(UserPoolId=USER_POOL,Username=USERNAME,GroupName='ADMIN')
print('TEST_USERNAME='+USERNAME)
print('TEST_PASSWORD='+PASSWORD)
print('HOSTED_UI=https://eu-north-1ntdqlsmut.auth.eu-north-1.amazoncognito.com/login?client_id=%s&response_type=code&scope=email+openid+phone&redirect_uri=%s'%(CLIENT_ID,'https://aws-download-hub.preview.emergentagent.com/'))
