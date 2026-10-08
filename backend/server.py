from fastapi import FastAPI, APIRouter, HTTPException, Query, Depends, Header, File, Form, UploadFile, status
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import re
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError, NoCredentialsError
import jwt
from jwt import PyJWKClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

AWS_REGION = os.environ.get('AWS_REGION', 'eu-north-1')
BUCKET = os.environ.get('S3_BUCKET_NAME', '')
BASE_PREFIX = os.environ.get('S3_BASE_PREFIX', '')
PRESIGN_EXPIRY = int(os.environ.get('PRESIGN_EXPIRY_SECONDS', '900'))

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# S3 client: SigV4, explicit region (required for eu-north-1 presigned URLs)
s3 = boto3.client(
    's3',
    region_name=AWS_REGION,
    aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY'),
    aws_session_token=os.environ.get('AWS_SESSION_TOKEN'),
    config=Config(signature_version='s3v4', s3={'addressing_style': 'virtual'}),
)

app = FastAPI()

# ---- Cognito JWT auth ----
COGNITO_ISSUER = os.environ.get('COGNITO_ISSUER', '')
COGNITO_CLIENT_ID = os.environ.get('COGNITO_CLIENT_ID', '')
COGNITO_ADMIN_GROUP = os.environ.get('COGNITO_ADMIN_GROUP', 'ADMIN')
JWKS_URL = f"{COGNITO_ISSUER}/.well-known/jwks.json" if COGNITO_ISSUER else ''
_jwks_client = PyJWKClient(JWKS_URL, cache_jwk_set=True, lifespan=3600) if JWKS_URL else None


def verify_cognito_token(authorization: Optional[str]) -> dict:
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Missing Bearer token')
    token = authorization[7:].strip()
    if not token or not _jwks_client:
        raise HTTPException(status_code=401, detail='Authentication unavailable')
    try:
        header = jwt.get_unverified_header(token)
        if header.get('alg') != 'RS256' or not header.get('kid'):
            raise ValueError('bad header')
        signing_key = _jwks_client.get_signing_key_from_jwt(token).key
        claims = jwt.decode(
            token, signing_key, algorithms=['RS256'],
            issuer=COGNITO_ISSUER, options={'verify_aud': False}, leeway=30,
        )
        use = claims.get('token_use')
        if use == 'access':
            if claims.get('client_id') != COGNITO_CLIENT_ID:
                raise ValueError('wrong client_id')
        elif use == 'id':
            if claims.get('aud') != COGNITO_CLIENT_ID:
                raise ValueError('wrong aud')
        else:
            raise ValueError('bad token_use')
        return claims
    except (jwt.PyJWTError, ValueError, KeyError) as e:
        logger.warning('Cognito token verify failed: %s', e)
        raise HTTPException(status_code=401, detail='Invalid or expired token',
                            headers={'WWW-Authenticate': 'Bearer'})


def admin_user(authorization: Optional[str] = Header(default=None)) -> dict:
    claims = verify_cognito_token(authorization)
    groups = claims.get('cognito:groups', [])
    if isinstance(groups, str):
        groups = [groups]
    if COGNITO_ADMIN_GROUP not in (groups or []):
        raise HTTPException(status_code=403, detail=f'{COGNITO_ADMIN_GROUP} group required')
    return claims


api_router = APIRouter(prefix="/api")


class FileItem(BaseModel):
    key: str
    name: str
    size: int
    last_modified: Optional[str] = None


class VersionInfo(BaseModel):
    version: str
    prefix: str


class ModuleInfo(BaseModel):
    module: str
    prefix: str
    latest_version: Optional[str] = None
    latest_prefix: Optional[str] = None
    versions: List[str] = []
    files: List[FileItem] = []
    total_size: int = 0
    file_count: int = 0


class BucketStatus(BaseModel):
    connected: bool
    bucket: str
    region: str
    base_prefix: str
    error: Optional[str] = None


class DownloadResponse(BaseModel):
    key: str
    name: str
    url: str
    expires_in: int


def _list_level(prefix: str):
    """Return (common_prefixes, objects) for the immediate level under prefix."""
    folders, objects = [], []
    paginator = s3.get_paginator('list_objects_v2')
    for page in paginator.paginate(Bucket=BUCKET, Prefix=prefix, Delimiter='/'):
        folders.extend(cp['Prefix'] for cp in page.get('CommonPrefixes', []))
        for o in page.get('Contents', []):
            # Skip zero-byte folder-marker objects (keys ending with '/')
            if o['Key'].endswith('/'):
                continue
            objects.append(o)
    return sorted(set(folders)), objects


def _segment(prefix: str, parent: str) -> str:
    """The folder name portion of `prefix` relative to `parent`."""
    return prefix[len(parent):].rstrip('/')


def _files_for_prefix(prefix: str) -> List[FileItem]:
    _, objects = _list_level(prefix)
    items = [
        FileItem(
            key=o['Key'],
            name=o['Key'].rstrip('/').split('/')[-1],
            size=o['Size'],
            last_modified=o['LastModified'].isoformat() if o.get('LastModified') else None,
        )
        for o in objects
    ]
    return sorted(items, key=lambda x: x.name.lower())


def _build_module(module_prefix: str) -> ModuleInfo:
    module_name = _segment(module_prefix, BASE_PREFIX)
    version_prefixes, direct_objects = _list_level(module_prefix)
    versions = [_segment(vp, module_prefix) for vp in version_prefixes]
    # Newest first (dated/version folder names sort lexicographically)
    versions_sorted = sorted(versions, reverse=True)

    info = ModuleInfo(module=module_name, prefix=module_prefix, versions=versions_sorted)

    if versions_sorted:
        latest = versions_sorted[0]
        latest_prefix = f"{module_prefix}{latest}/"
        info.latest_version = latest
        info.latest_prefix = latest_prefix
        info.files = _files_for_prefix(latest_prefix)
    else:
        # No version subfolders: treat files directly under the module as the release
        info.latest_version = None
        info.latest_prefix = module_prefix
        info.files = [
            FileItem(
                key=o['Key'],
                name=o['Key'].rstrip('/').split('/')[-1],
                size=o['Size'],
                last_modified=o['LastModified'].isoformat() if o.get('LastModified') else None,
            )
            for o in direct_objects
        ]

    info.file_count = len(info.files)
    info.total_size = sum(f.size for f in info.files)
    return info


@api_router.get("/")
async def root():
    return {"message": "S3 Release Distribution API"}


@api_router.get("/status", response_model=BucketStatus)
async def bucket_status():
    try:
        s3.head_bucket(Bucket=BUCKET)
        return BucketStatus(connected=True, bucket=BUCKET, region=AWS_REGION, base_prefix=BASE_PREFIX)
    except (ClientError, NoCredentialsError) as e:
        logger.error("Bucket status error: %s", e)
        return BucketStatus(connected=False, bucket=BUCKET, region=AWS_REGION,
                            base_prefix=BASE_PREFIX, error="Unable to reach S3 bucket")


@api_router.get("/modules", response_model=List[ModuleInfo])
async def list_modules():
    try:
        module_prefixes, _ = _list_level(BASE_PREFIX)
        return [_build_module(mp) for mp in module_prefixes]
    except (ClientError, NoCredentialsError) as e:
        logger.error("list_modules error: %s", e)
        raise HTTPException(status_code=502, detail="Failed to list S3 modules")


@api_router.get("/modules/{module}", response_model=ModuleInfo)
async def get_module(module: str, version: Optional[str] = Query(None)):
    module_prefix = f"{BASE_PREFIX}{module}/"
    try:
        info = _build_module(module_prefix)
        if version and version in info.versions:
            info.latest_version = version
            info.latest_prefix = f"{module_prefix}{version}/"
            info.files = _files_for_prefix(info.latest_prefix)
            info.file_count = len(info.files)
            info.total_size = sum(f.size for f in info.files)
        return info
    except (ClientError, NoCredentialsError) as e:
        logger.error("get_module error: %s", e)
        raise HTTPException(status_code=502, detail="Failed to read module")


@api_router.get("/download", response_model=DownloadResponse)
async def presign_download(key: str = Query(..., min_length=1)):
    # Keep downloads scoped to the configured base prefix; block traversal
    if '..' in key or '\\' in key or key.startswith('/'):
        raise HTTPException(status_code=400, detail="Invalid key")
    if BASE_PREFIX and not key.startswith(BASE_PREFIX):
        raise HTTPException(status_code=400, detail="Key outside allowed path")
    filename = key.rstrip('/').split('/')[-1]
    try:
        url = s3.generate_presigned_url(
            ClientMethod='get_object',
            Params={
                'Bucket': BUCKET,
                'Key': key,
                'ResponseContentDisposition': f'attachment; filename="{filename}"',
            },
            ExpiresIn=PRESIGN_EXPIRY,
            HttpMethod='GET',
        )
    except (ClientError, NoCredentialsError) as e:
        logger.error("presign error: %s", e)
        raise HTTPException(status_code=502, detail="Could not generate download link")
    return DownloadResponse(key=key, name=key.rstrip('/').split('/')[-1], url=url, expires_in=PRESIGN_EXPIRY)


@api_router.post("/modules/{module}/upload")
async def upload_files(
    module: str,
    version: str = Form(...),
    files: List[UploadFile] = File(...),
    claims: dict = Depends(admin_user),
):
    if not re.match(r'^[A-Za-z0-9._-]+$', module):
        raise HTTPException(status_code=400, detail='Invalid module name')
    if not re.match(r'^[A-Za-z0-9._-]+$', version):
        raise HTTPException(status_code=400, detail='Invalid version name')
    uploaded = []
    for f in files:
        safe = os.path.basename(f.filename or '').replace('/', '_').replace('\\', '_')
        if not safe:
            continue
        key = f"{BASE_PREFIX}{module}/{version}/{safe}"
        try:
            s3.upload_fileobj(
                f.file, BUCKET, key,
                ExtraArgs={'ContentType': f.content_type or 'application/octet-stream'},
            )
        except (ClientError, NoCredentialsError) as e:
            logger.error("upload error: %s", e)
            raise HTTPException(status_code=502, detail=f'Failed to upload {safe}')
        uploaded.append(key)
    if not uploaded:
        raise HTTPException(status_code=400, detail='No valid files provided')
    return {"uploaded": uploaded, "count": len(uploaded), "module": module, "version": version}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
