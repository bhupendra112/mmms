import httpPayment from "../api/httpPayment";

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

export const createPayment = async (data) => {
  const payload = sanitizePayload(data);
  const res = await httpPayment.post("/create", payload);
  return res.data;
};

export const getMaturedFDs = async (params = {}) => {
  const res = await httpPayment.get("/matured-fds", { params });
  return res.data;
};

export const getMemberSavings = async (memberId) => {
  const res = await httpPayment.get(`/member-savings/${memberId}`);
  return res.data;
};

export const getPayments = async (params = {}) => {
  const res = await httpPayment.get("/list", { params });
  return res.data;
};

export const getPaymentDetail = async (id) => {
  const res = await httpPayment.get(`/detail/${id}`);
  return res.data;
};

export const approvePayment = async (id) => {
  const res = await httpPayment.put(`/approve/${id}`);
  return res.data;
};

export const rejectPayment = async (id, reason) => {
  const res = await httpPayment.put(`/reject/${id}`, { reason });
  return res.data;
};

export const completePayment = async (id) => {
  const res = await httpPayment.put(`/complete/${id}`);
  return res.data;
};

