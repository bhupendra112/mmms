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

export const updateMemberRecovery = async (groupId, date, memberRecovery) => {
  const payload = {
    groupId,
    date,
    memberRecovery: sanitizePayload(memberRecovery)
  };
  const res = await httpRecovery.post("/update-member", payload);
  return res.data;
};

export const getRecoveryByDate = async (groupId, date) => {
  const params = { groupId, date };
  const res = await httpRecovery.get("/by-date", { params });
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

export const updateRecoveryPhoto = async (groupId, date, groupPhoto) => {
  const payload = {
    groupId,
    date,
    groupPhoto
  };
  const res = await httpRecovery.post("/update-photo", payload);
  return res.data;
};

export const getPreviousRecoveryData = async (groupId, memberId, date) => {
  const params = { groupId, memberId, date };
  const res = await httpRecovery.get("/previous-data", { params });
  return res.data;
};

