import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const REGION = process.env.REACT_APP_AWS_REGION;
const BUCKET = process.env.REACT_APP_S3_BUCKET;
const IDENTITY_POOL_ID = process.env.REACT_APP_COGNITO_IDENTITY_POOL_ID;
const USER_POOL_ID = process.env.REACT_APP_COGNITO_USER_POOL_ID;
const BASE_PREFIX = "";
const PRESIGN_EXPIRY = 900;
const LOGIN_KEY = `cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`;

let _client = null;
let _clientKey = null;

const getS3 = (idToken) => {
  const key = idToken || "guest";
  if (_client && _clientKey === key) return _client;
  _client = new S3Client({
    region: REGION,
    credentials: fromCognitoIdentityPool({
      identityPoolId: IDENTITY_POOL_ID,
      ...(idToken ? { logins: { [LOGIN_KEY]: idToken } } : {}),
      clientConfig: { region: REGION },
    }),
  });
  _clientKey = key;
  return _client;
};

const seg = (prefix, parent) => prefix.slice(parent.length).replace(/\/$/, "");

const listLevel = async (s3, prefix) => {
  const folders = [];
  const objects = [];
  let token;
  do {
    const r = await s3.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, Delimiter: "/", ContinuationToken: token })
    );
    (r.CommonPrefixes || []).forEach((c) => folders.push(c.Prefix));
    (r.Contents || []).forEach((o) => {
      if (!o.Key.endsWith("/")) objects.push(o);
    });
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return { folders: [...new Set(folders)].sort(), objects };
};

const toFile = (o) => ({
  key: o.Key,
  name: o.Key.replace(/\/$/, "").split("/").pop(),
  size: o.Size,
  last_modified: o.LastModified ? new Date(o.LastModified).toISOString() : null,
});

const filesFor = async (s3, prefix) => {
  const { objects } = await listLevel(s3, prefix);
  return objects.map(toFile).sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
};

const buildModule = async (s3, modulePrefix) => {
  const name = seg(modulePrefix, BASE_PREFIX);
  const { folders, objects } = await listLevel(s3, modulePrefix);
  const versions = folders.map((f) => seg(f, modulePrefix)).sort().reverse();
  let latest = null;
  let files = [];
  if (versions.length) {
    latest = versions[0];
    files = await filesFor(s3, `${modulePrefix}${latest}/`);
  } else {
    files = objects.map(toFile);
  }
  return {
    module: name,
    prefix: modulePrefix,
    latest_version: latest,
    latest_prefix: latest ? `${modulePrefix}${latest}/` : modulePrefix,
    versions,
    files,
    file_count: files.length,
    total_size: files.reduce((s, f) => s + (f.size || 0), 0),
  };
};

export const getStatus = async (idToken) => {
  try {
    await listLevel(getS3(idToken), BASE_PREFIX);
    return { connected: true, bucket: BUCKET, region: REGION, base_prefix: BASE_PREFIX };
  } catch (e) {
    return { connected: false, bucket: BUCKET, region: REGION, error: e?.message || "S3 error" };
  }
};

export const getModules = async (idToken) => {
  const s3 = getS3(idToken);
  const { folders } = await listLevel(s3, BASE_PREFIX);
  return Promise.all(folders.map((mp) => buildModule(s3, mp)));
};

export const getModule = async (module, version, idToken) => {
  const s3 = getS3(idToken);
  const modulePrefix = `${BASE_PREFIX}${module}/`;
  const info = await buildModule(s3, modulePrefix);
  if (version && info.versions.includes(version)) {
    info.latest_version = version;
    info.latest_prefix = `${modulePrefix}${version}/`;
    info.files = await filesFor(s3, info.latest_prefix);
    info.file_count = info.files.length;
    info.total_size = info.files.reduce((s, f) => s + (f.size || 0), 0);
  }
  return info;
};

export const getDownloadUrl = async (key, idToken) => {
  const s3 = getS3(idToken);
  const name = key.replace(/\/$/, "").split("/").pop();
  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key, ResponseContentDisposition: `attachment; filename="${name}"` }),
    { expiresIn: PRESIGN_EXPIRY }
  );
  return { key, name, url, expires_in: PRESIGN_EXPIRY };
};

export const uploadFiles = async (module, version, files, idToken) => {
  const s3 = getS3(idToken);
  const uploaded = [];
  for (const f of files) {
    const safe = f.name.replace(/[/\\]/g, "_");
    const key = `${BASE_PREFIX}${module}/${version}/${safe}`;
    await s3.send(
      new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: f, ContentType: f.type || "application/octet-stream" })
    );
    uploaded.push(key);
  }
  return { uploaded, count: uploaded.length, module, version };
};

export const formatBytes = (bytes) => {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

export const fileCategory = (name) => {
  const ext = name.split(".").pop().toLowerCase();
  if (["exe", "bin", "dll", "app", "msi", "deb", "rpm", "jar"].includes(ext)) return "binaries";
  if (["zip", "tar", "gz", "rar", "7z", "tgz"].includes(ext)) return "archives";
  if (["json", "yaml", "yml", "xml", "conf", "ini", "env", "toml"].includes(ext)) return "configs";
  if (["sha256", "md5", "sig", "asc", "sum"].includes(ext)) return "checksums";
  return "docs";
};
