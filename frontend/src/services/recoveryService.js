import httpRecovery from "../api/httpRecovery";

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

export const registerRecovery = async (data) => {
  const payload = sanitizePayload(data);
  const res = await httpRecovery.post("/register-recovery", payload);
  return res.data;
};

export const getRecoveries = async (groupId = null) => {
  const params = groupId ? { groupId } : {};
  const res = await httpRecovery.get("/list", { params });
  return res.data;
};

export const getRecoveryDetail = async (id) => {
  const res = await httpRecovery.get(`/detail/${id}`);
  return res.data;
};

