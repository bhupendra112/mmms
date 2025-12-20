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

const httpGroupAuth = axios.create({
    baseURL: `${getApiOrigin()}/api/admin/group-auth`,
    headers: { "Content-Type": "application/json" },
});

// Response interceptor - use centralized error handler
httpGroupAuth.interceptors.response.use(
    (res) => res,
    createErrorInterceptor(false) // false = isGroup (not admin)
);

export const loginGroup = async (groupName, groupIdOrCode, isCode = false) => {
    const payload = {
        groupName,
        [isCode ? "groupCode" : "groupId"]: groupIdOrCode,
    };
    const res = await httpGroupAuth.post("/login", payload);
    return res.data;
};

export const logoutGroup = () => {
    localStorage.removeItem("groupToken");
    localStorage.removeItem("groupData");
    localStorage.removeItem("activeGroupId");
    localStorage.removeItem("activeGroupCode");
    localStorage.removeItem("activeGroupCache");
};

export const getGroupToken = () => {
    return localStorage.getItem("groupToken");
};

export const getGroupData = () => {
    const data = localStorage.getItem("groupData");
    return data ? JSON.parse(data) : null;
};

export const isGroupAuthenticated = () => {
    return !!getGroupToken();
};

export const setGroupAuth = (token, groupData) => {
    localStorage.setItem("groupToken", token);
    localStorage.setItem("groupData", JSON.stringify(groupData));
    // Also set for GroupContext compatibility
    localStorage.setItem("activeGroupId", groupData.id);
    localStorage.setItem("activeGroupCode", groupData.code);
    localStorage.setItem("activeGroupCache", JSON.stringify(groupData));
};

