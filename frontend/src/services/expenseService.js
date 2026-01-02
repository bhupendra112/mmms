import httpExpense from "../api/httpExpense";

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

export const createExpense = async (data) => {
  const payload = sanitizePayload(data);
  const res = await httpExpense.post("/", payload);
  return res.data;
};

export const getExpenses = async (filters = {}) => {
  const params = {};
  if (filters.groupId) params.groupId = filters.groupId;
  if (filters.groupCode) params.groupCode = filters.groupCode;
  if (filters.fromDate) params.fromDate = filters.fromDate;
  if (filters.toDate) params.toDate = filters.toDate;
  if (filters.expenseType) params.expenseType = filters.expenseType;

  const res = await httpExpense.get("/", { params });
  return res.data;
};

export const getExpenseDetail = async (id) => {
  const res = await httpExpense.get(`/${id}`);
  return res.data;
};

export const updateExpense = async (id, data) => {
  const payload = sanitizePayload(data);
  const res = await httpExpense.put(`/${id}`, payload);
  return res.data;
};

export const deleteExpense = async (id) => {
  const res = await httpExpense.delete(`/${id}`);
  return res.data;
};

