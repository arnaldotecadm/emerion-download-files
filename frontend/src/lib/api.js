import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const getStatus = () => axios.get(`${API}/status`).then((r) => r.data);
export const getModules = () => axios.get(`${API}/modules`).then((r) => r.data);
export const getModule = (module, version) =>
  axios
    .get(`${API}/modules/${encodeURIComponent(module)}`, {
      params: version ? { version } : {},
    })
    .then((r) => r.data);
export const getDownloadUrl = (key) =>
  axios.get(`${API}/download`, { params: { key } }).then((r) => r.data);

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
