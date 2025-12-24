import axios from "axios";
import { getAuthToken } from "../utils/getAuthToken";
import { createRequestInterceptor, createErrorInterceptor } from "../utils/httpInterceptor";

const getApiOrigin = () => {
    const raw = String(import.meta.env.VITE_BASE_URL || "");
    try {
        return new URL(raw).origin;
    } catch {
        const match = raw.match(/^(https?:\/\/[^/]+)/i);
        // Use environment variable or default to production URL
        return match ? match[1] : (import.meta.env.PROD ? "https://api.mmms.online" : "http://localhost:8080");
    }
};

const httpLoan = axios.create({
    baseURL: `${getApiOrigin()}/api/admin/loan`,
    headers: { "Content-Type": "application/json" },
});

// Request interceptor - add token
httpLoan.interceptors.request.use(
    createRequestInterceptor(getAuthToken),
    (error) => Promise.reject(error)
);

// Response interceptor
httpLoan.interceptors.response.use(
    (res) => res,
    createErrorInterceptor(true) // true = isAdmin
);

export default httpLoan;

