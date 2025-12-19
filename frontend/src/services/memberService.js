import httpMember from "../api/httpMember";

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

export const registerMember = async (data) => {
  const payload = sanitizePayload(data);
  const res = await httpMember.post("/register-member", payload);
  return res.data;
};

export const getMembersByGroup = async (groupId) => {
  const res = await httpMember.get(`/by-group/${groupId}`);
  return res.data;
};

export const getMembers = async (groupId) => {
  const res = await httpMember.get("/list", { params: groupId ? { group_id: groupId } : {} });
  return res.data;
};

export const getMemberDetail = async (id) => {
  const res = await httpMember.get(`/detail/${id}`);
  return res.data;
};


