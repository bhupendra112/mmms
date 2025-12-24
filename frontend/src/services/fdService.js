import httpFD from "../api/httpFD";

const sanitizePayload = (payload) => {
    const entries = Object.entries(payload || {});
    const sanitized = {};
    for (const [k, v] of entries) {
        if (typeof v === "string") {
            const trimmed = v.trim();
            if (trimmed === "") continue;
            sanitized[k] = trimmed;
            continue;
        }
        if (v === undefined || v === null) continue;
        sanitized[k] = v;
    }
    return sanitized;
};

export const createFD = async (data) => {
    const payload = sanitizePayload(data);
    const res = await httpFD.post("/create", payload);
    return res.data;
};

export const getFDsByMember = async (memberId) => {
    const res = await httpFD.get(`/member/${memberId}`);
    return res.data;
};

export const getFDsByGroup = async (groupId) => {
    const res = await httpFD.get(`/group/${groupId}`);
    return res.data;
};

export const getAllFDs = async (params = {}) => {
    const res = await httpFD.get("/list", { params });
    return res.data;
};

export const getFDDetail = async (id) => {
    const res = await httpFD.get(`/detail/${id}`);
    return res.data;
};

export const updateFDStatus = async (id, status) => {
    const res = await httpFD.put(`/status/${id}`, { status });
    return res.data;
};

