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
// CLUSTER: rename (all groups in cluster) — admin only
// -------------------------------------------------------------
export const updateClusterApi = async (payload) => {
    try {
        const res = await httpGroup.put("/cluster", {
            old_cluster_name: payload.old_cluster_name ?? "",
            old_cluster_code: payload.old_cluster_code ?? "",
            new_cluster_name: String(payload.new_cluster_name || "").trim(),
            new_cluster_code: String(payload.new_cluster_code || "").trim(),
        });
        return res.data;
    } catch (err) {
        throw err.response ? err.response.data : err;
    }
};

// -------------------------------------------------------------
// CLUSTER: delete all groups under cluster — admin only (destructive)
// -------------------------------------------------------------
export const deleteClusterApi = async (payload) => {
    try {
        const res = await httpGroup.delete("/cluster", {
            data: {
                cluster_name: payload.cluster_name ?? "",
                cluster_code: payload.cluster_code ?? "",
            },
        });
        return res.data;
    } catch (err) {
        throw err.response ? err.response.data : err;
    }
};

// -------------------------------------------------------------
// DELETE GROUP — admin only (cascade)
// -------------------------------------------------------------
export const deleteGroupApi = async (groupId) => {
    if (!groupId) throw new Error("groupId is required");
    try {
        const res = await httpGroup.delete(`/delete-group/${groupId}`);
        return res.data;
    } catch (err) {
        throw err.response ? err.response.data : err;
    }
};

// -------------------------------------------------------------
// LIST ALL CLUSTERS
// -------------------------------------------------------------
export const getClusters = async () => {
    try {
        const res = await httpGroup.get("/list-clusters");
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

// -------------------------------------------------------------
// GET BANK DETAIL WITH TRANSACTIONS
// -------------------------------------------------------------
export const getBankDetail = async (bankId) => {
    if (!bankId) throw new Error("bankId is required");
    try {
        const res = await httpGroup.get(`/bank/${bankId}`);
        return res.data;
    } catch (err) {
        throw err.response ? err.response.data : err;
    }
};

// -------------------------------------------------------------
// GET CASH TRANSACTIONS FOR A GROUP
// -------------------------------------------------------------
export const getCashTransactions = async (groupId) => {
    if (!groupId) throw new Error("groupId is required");
    try {
        const res = await httpGroup.get(`/${groupId}/cash-transactions`);
        return res.data;
    } catch (err) {
        throw err.response ? err.response.data : err;
    }
};

// -------------------------------------------------------------
// UPDATE GROUP
// -------------------------------------------------------------
export const updateGroup = async (id, data) => {
    try {
        const payload = sanitizePayload(data);
        const res = await httpGroup.put(`/update/${id}`, payload);
        return res.data;
    } catch (err) {
        throw err.response ? err.response.data : err;
    }
};

// -------------------------------------------------------------
// UPDATE BANK DETAIL
// -------------------------------------------------------------
export const updateBank = async (bankId, data) => {
    try {
        const payload = sanitizePayload(data);
        const res = await httpGroup.put(`/bank/${bankId}`, payload);
        return res.data;
    } catch (err) {
        throw err.response ? err.response.data : err;
    }
};

// -------------------------------------------------------------
// CHARGE MANAGEMENT
// -------------------------------------------------------------
export const addGroupCharge = async (groupId, chargeData) => {
    try {
        const payload = sanitizePayload(chargeData);
        const res = await httpGroup.post(`/${groupId}/charges`, payload);
        return res.data;
    } catch (err) {
        throw err.response ? err.response.data : err;
    }
};

export const updateGroupCharge = async (groupId, chargeId, chargeData) => {
    try {
        const payload = sanitizePayload(chargeData);
        const res = await httpGroup.put(`/${groupId}/charges/${chargeId}`, payload);
        return res.data;
    } catch (err) {
        throw err.response ? err.response.data : err;
    }
};

export const deleteGroupCharge = async (groupId, chargeId) => {
    try {
        const res = await httpGroup.delete(`/${groupId}/charges/${chargeId}`);
        return res.data;
    } catch (err) {
        throw err.response ? err.response.data : err;
    }
};

export const getGroupCharges = async (groupId) => {
    try {
        const res = await httpGroup.get(`/${groupId}/charges`);
        return res.data;
    } catch (err) {
        throw err.response ? err.response.data : err;
    }
};

// -------------------------------------------------------------
// SUPERVISOR & PASSWORD
// -------------------------------------------------------------
export const changeSupervisor = async (groupId, data) => {
    try {
        const payload = sanitizePayload(data);
        const res = await httpGroup.post(`/${groupId}/change-supervisor`, payload);
        return res.data;
    } catch (err) {
        throw err.response ? err.response.data : err;
    }
};

export const changePassword = async (groupId, newPassword) => {
    try {
        const res = await httpGroup.post(`/${groupId}/change-password`, {
            newPassword: String(newPassword).trim(),
        });
        return res.data;
    } catch (err) {
        throw err.response ? err.response.data : err;
    }
};