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

const httpGroup = axios.create({
    baseURL: `${getApiOrigin()}/api/admin/group`,
    headers: { "Content-Type": "application/json" },
});

httpGroup.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token");
        if (token) config.headers["Authorization"] = `Bearer ${token}`;

        return config;
    },
    (error) => Promise.reject(error)
);

httpGroup.interceptors.response.use(
    (res) => res,
    (err) => {
        return Promise.reject(err.response?.data?.message || "Something went wrong");
    }
);

export default httpGroup;
