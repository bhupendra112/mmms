import axios from "axios";
import { getAuthToken } from "../utils/getAuthToken";
import { createRequestInterceptor, createErrorInterceptor } from "../utils/httpInterceptor";

// Ensure baseURL doesn't have trailing slash and doesn't include /admin/auth
const getBaseURL = () => {
    const raw = import.meta.env.VITE_BASE_URL || "https://mmms.online/api";
    // Remove any trailing slashes
    let baseURL = raw.replace(/\/+$/, "");
    // Ensure it ends with /api but not /api/admin/auth
    if (baseURL.endsWith("/admin/auth")) {
        baseURL = baseURL.replace(/\/admin\/auth$/, "");
    }
    if (!baseURL.endsWith("/api")) {
        baseURL = baseURL.endsWith("/") ? `${baseURL}api` : `${baseURL}/api`;
    }
    return baseURL;
};

const http = axios.create({
    baseURL: getBaseURL(),
    headers: { "Content-Type": "application/json" },
});

// ⬇️ REQUEST INTERCEPTOR — Automatically add token
http.interceptors.request.use(
    createRequestInterceptor(getAuthToken),
    (error) => Promise.reject(error)
);

// ⬇️ RESPONSE INTERCEPTOR — Handle all error status codes
http.interceptors.response.use(
    (res) => res,
    createErrorInterceptor(true) // true = isAdmin
);

export default http;