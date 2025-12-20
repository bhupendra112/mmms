import axios from "axios";
import { getAuthToken } from "../utils/getAuthToken";
import { createRequestInterceptor, createErrorInterceptor } from "../utils/httpInterceptor";

const http = axios.create({
    baseURL: import.meta.env.VITE_BASE_URL || "https://mmms.online/api",
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