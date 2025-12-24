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
  // Check if data is FormData (for file uploads)
  if (data instanceof FormData) {
    // For FormData, let axios handle the Content-Type automatically
    const res = await httpMember.post("/register-member", data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  }
  
  // For regular JSON data, sanitize and send
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

export const exportMemberLedger = async (filters = {}) => {
  const params = {};
  if (filters.memberId) params.memberId = filters.memberId;
  if (filters.groupId) params.groupId = filters.groupId;
  if (filters.fromDate) params.fromDate = filters.fromDate;
  if (filters.toDate) params.toDate = filters.toDate;
  
  const res = await httpMember.get("/export-ledger", { params });
  return res.data;
};

