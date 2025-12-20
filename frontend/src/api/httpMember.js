import axios from "axios";
import { getAuthToken } from "../utils/getAuthToken";
import { createRequestInterceptor, createErrorInterceptor } from "../utils/httpInterceptor";

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
  createRequestInterceptor(getAuthToken),
  (error) => Promise.reject(error)
);

httpMember.interceptors.response.use(
  (res) => res,
  createErrorInterceptor(true) // true = isAdmin
);

export default httpMember;


