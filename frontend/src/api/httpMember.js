import axios from "axios";

const getApiOrigin = () => {
  const raw = String(import.meta.env.VITE_BASE_URL || "");
  try {
    return new URL(raw).origin;
  } catch {
    const match = raw.match(/^(https?:\/\/[^/]+)/i);
    return match ? match[1] : raw;
  }
};

const httpMember = axios.create({
  baseURL: `${getApiOrigin()}/api/admin/member`,
  headers: { "Content-Type": "application/json" },
});

httpMember.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers["Authorization"] = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

httpMember.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject(err.response?.data?.message || "Something went wrong")
);

export default httpMember;


