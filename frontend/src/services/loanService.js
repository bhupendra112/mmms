import httpLoan from "../api/httpLoan";

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

export const registerLoan = async (data) => {
  const payload = sanitizePayload(data);
  const res = await httpLoan.post("/register-loan", payload);
  return res.data;
};

export const getLoans = async (groupId = null) => {
  const params = groupId ? { groupId } : {};
  const res = await httpLoan.get("/list", { params });
  return res.data;
};

export const getLoanDetail = async (id) => {
  const res = await httpLoan.get(`/detail/${id}`);
  return res.data;
};

