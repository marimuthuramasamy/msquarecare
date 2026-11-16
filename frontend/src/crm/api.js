import axios from "axios";
import { API } from "@/lib/config";

const TOKEN_KEY = "msq_crm_token";

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (t) => {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
};

export const crm = axios.create({ baseURL: `${API}/crm` });

crm.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

crm.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !err.config.url.includes("/auth/login")) {
      setToken(null);
      if (!window.location.pathname.startsWith("/crm/login")) window.location.assign("/crm/login");
    }
    return Promise.reject(err);
  }
);

export const errMsg = (e, fallback = "Something went wrong") => {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d[0]?.msg) return `${d[0].loc?.slice(-1)[0] || "field"}: ${d[0].msg}`;
  return fallback;
};

// Fetch a CSV with the auth header and trigger a browser download.
export const downloadCsv = async (kind) => {
  const res = await crm.get(`/export/${kind}`, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `msquare_${kind}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
