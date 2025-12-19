import axios from "axios";

const http = axios.create({
    baseURL: import.meta.env.VITE_BASE_URL, // VITE_ prefix required
    headers: { "Content-Type": "application/json" },
});

// ⬇️ REQUEST INTERCEPTOR — Automatically add token
http.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token");

        if (token) config.headers["Authorization"] = `Bearer ${token}`;

        return config;
    },
    (error) => Promise.reject(error)
);

// Error Interceptor
http.interceptors.response.use(
    (res) => res,
    (err) => {
        console.log("[API ERROR]", err);
        return Promise.reject(err.response?.data?.message || "Something went wrong");
    }
);

export default http;