import boto3, os
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
sess = boto3.Session(
    aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
    aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    region_name='eu-north-1')
sts = sess.client('sts')
iam = sess.client('iam')
who = sts.get_caller_identity()
print('account:', who['Account'])
print('arn:', who['Arn'])
# What actions can this principal do? simulate a few.
arn = who['Arn']
actions = ['cognito-identity:CreateIdentityPool','cognito-identity:SetIdentityPoolRoles',
           'iam:CreateRole','iam:PutRolePolicy','iam:AttachRolePolicy',
           'cognito-idp:GetGroup','cognito-idp:CreateGroup','iam:PassRole']
try:
    res = iam.simulate_principal_policy(PolicySourceArn=arn, ActionNames=actions)
    for r in res['EvaluationResults']:
        print(r['EvalActionName'], '->', r['EvalDecision'])
except Exception as e:
    print('simulate not permitted:', e)
