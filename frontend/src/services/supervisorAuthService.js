import axios from "axios";
import { createErrorInterceptor } from "../utils/httpInterceptor";

const getApiOrigin = () => {
    const raw = String(import.meta.env.VITE_BASE_URL || "");
    try {
        return new URL(raw).origin;
    } catch {
        const match = raw.match(/^(https?:\/\/[^/]+)/i);
        return match ? match[1] : "http://localhost:8080";
    }
};

const httpSupervisorAuth = axios.create({
    baseURL: `${getApiOrigin()}/api/supervisor`,
    headers: { "Content-Type": "application/json" },
});

httpSupervisorAuth.interceptors.response.use(
    (res) => res,
    createErrorInterceptor(false)
);

export const loginSupervisor = async (email, password) => {
    const payload = { email: email?.trim?.(), password };
    const res = await httpSupervisorAuth.post("/login", payload);
    return res.data;
};

export const logoutSupervisor = () => {
    localStorage.removeItem("supervisorToken");
    localStorage.removeItem("supervisorData");
};
