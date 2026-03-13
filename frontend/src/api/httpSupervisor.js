import axios from "axios";
import { getAuthToken } from "../utils/getAuthToken";
import { createRequestInterceptor, createErrorInterceptor } from "../utils/httpInterceptor";

const getApiOrigin = () => {
    const raw = String(import.meta.env.VITE_BASE_URL || "");
    try {
        return new URL(raw).origin;
    } catch {
        const match = raw.match(/^(https?:\/\/[^/]+)/i);
        return match ? match[1] : (import.meta.env.PROD ? "https://api.mmms.online" : "http://localhost:8080");
    }
};

const httpSupervisor = axios.create({
    baseURL: `${getApiOrigin()}/api/admin/supervisor`,
    headers: { "Content-Type": "application/json" },
});

httpSupervisor.interceptors.request.use(
    createRequestInterceptor(getAuthToken),
    (error) => Promise.reject(error)
);

httpSupervisor.interceptors.response.use(
    (res) => res,
    createErrorInterceptor(true)
);

export default httpSupervisor;
