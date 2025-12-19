import httpGroup from "../api/httpGroup";

const sanitizePayload = (payload) => {
    const entries = Object.entries(payload || {});
    const sanitized = {};
    for (const [k, v] of entries) {
        if (typeof v === "string") {
            const trimmed = v.trim();
            if (trimmed === "") continue; // drop empty strings (Joi optional() rejects "")
            sanitized[k] = trimmed;
            continue;
        }
        if (v === undefined || v === null) continue;
        sanitized[k] = v;
    }
    return sanitized;
};

// -------------------------------------------------------------
// CREATE GROUP MASTER
// -------------------------------------------------------------
export const createGroup = async (data) => {
    try {
        const payload = sanitizePayload(data);
        const res = await httpGroup.post("/register-group", payload);
        return res.data;
    } catch (err) {
        throw err.response ? err.response.data : err;
    }
};

// -------------------------------------------------------------
// LIST GROUPS
// -------------------------------------------------------------
export const getGroups = async () => {
    try {
        const res = await httpGroup.get("/list");
        return res.data;
    } catch (err) {
        throw err.response ? err.response.data : err;
    }
};

// -------------------------------------------------------------
// GROUP DETAIL BY ID
// -------------------------------------------------------------
export const getGroupDetail = async (id) => {
    try {
        const res = await httpGroup.get(`/detail/${id}`);
        return res.data;
    } catch (err) {
        throw err.response ? err.response.data : err;
    }
};

// -------------------------------------------------------------
// GROUP DETAIL BY CODE
// -------------------------------------------------------------
export const getGroupByCode = async (groupCode) => {
    try {
        const res = await httpGroup.get(`/by-code/${groupCode}`);
        return res.data;
    } catch (err) {
        throw err.response ? err.response.data : err;
    }
};

// -------------------------------------------------------------
// CREATE BANK MASTER (linked with group_id)
// -------------------------------------------------------------
export const createBank = async (data) => {
    try {
        const payload = sanitizePayload(data);
        const res = await httpGroup.post("/add-bank", payload);
        return res.data;
    } catch (err) {
        throw err.response ? err.response.data : err;
    }
};

// -------------------------------------------------------------
// LIST BANKS FOR GROUP (multiple banks)
// -------------------------------------------------------------
export const getGroupBanks = async (groupId) => {
    if (!groupId) throw new Error("groupId is required");
    const res = await httpGroup.get(`/${groupId}/banks`);
    return res.data;
};