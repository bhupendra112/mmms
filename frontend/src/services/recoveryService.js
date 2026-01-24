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

export const registerRecovery = async (data, testMode = false) => {
  const payload = sanitizePayload(data);
  if (testMode) {
    payload.testMode = true;
  }
  const params = testMode ? { testMode: 'true' } : {};
  const res = await httpRecovery.post("/register-recovery", payload, { params });
  console.log("registerRecovery res", res.data);
  return res.data;
};

export const updateMemberRecovery = async (groupId, date, memberRecovery, testMode = false) => {
  const payload = {
    groupId,
    date,
    memberRecovery: sanitizePayload(memberRecovery)
  };
  if (testMode) {
    payload.testMode = true;
  }
  const params = testMode ? { testMode: 'true' } : {};
  const res = await httpRecovery.post("/update-member", payload, { params });
  return res.data;
};

export const getRecoveryByDate = async (groupId, date, testMode = false) => {
  const params = { groupId, date };
  if (testMode) {
    params.testMode = 'true';
  }
  const res = await httpRecovery.get("/by-date", { params });
  console.log("getRecoveryByDate res", res.data)
  return res.data;
};

export const getRecoveries = async (groupId = null, testMode = false) => {
  const params = groupId ? { groupId } : {};
  if (testMode) {
    params.testMode = 'true';
  }
  const res = await httpRecovery.get("/list", { params });
  return res.data;
};

export const getRecoveryDetail = async (id, testMode = false) => {
  const params = testMode ? { testMode: 'true' } : {};
  const res = await httpRecovery.get(`/detail/${id}`, { params });
  console.log(" getRecoveryDetail res : ", res.data)
  return res.data;
};

export const updateRecoveryPhoto = async (groupId, date, groupPhoto, cashDenominations = null, testMode = false) => {
  const payload = {
    groupId,
    date,
    groupPhoto
  };
  if (cashDenominations) {
    payload.cashDenominations = cashDenominations;
  }
  if (testMode) {
    payload.testMode = true;
  }
  const params = testMode ? { testMode: 'true' } : {};
  const res = await httpRecovery.post("/update-photo", payload, { params });
  return res.data;
};

export const getPreviousRecoveryData = async (groupId, memberId, date, testMode = false) => {
  const params = { groupId, memberId, date };
  if (testMode) {
    params.testMode = 'true';
  }
  const res = await httpRecovery.get("/previous-data", { params });
  return res.data;
};

export const getDemandDetails = async (groupId, memberId, date, testMode = false) => {
  const params = { groupId, memberId, date };
  if (testMode) {
    params.testMode = 'true';
  }
  const res = await httpRecovery.get("/demand-details", { params });
  console.log("demand details : ", res.data)
  return res.data;
};

export const getMemberLoanTotals = async (groupId, memberId, testMode = false) => {
  const params = { groupId, memberId };
  if (testMode) {
    params.testMode = 'true';
  }
  const res = await httpRecovery.get("/loan-totals", { params });
  return res.data;
};

export const getMemberRevenueRemaining = async (groupId, memberId, testMode = false) => {
  const params = { groupId, memberId };
  if (testMode) {
    params.testMode = 'true';
  }
  const res = await httpRecovery.get("/revenue-remaining", { params });
  console.log("revainue detail : ", res.data)
  return res.data;
};

export const getGroupRecoveryDetails = async (groupId, filters = {}, testMode = false) => {
  const params = { groupId };
  if (filters.fromDate) params.fromDate = filters.fromDate;
  if (filters.toDate) params.toDate = filters.toDate;
  if (testMode) {
    params.testMode = 'true';
  }
  const res = await httpRecovery.get("/group-details", { params });
  return res.data;
};

export const exportRecoveryPDF = async (groupId, date) => {
  const params = { groupId, date };
  const res = await httpRecovery.get("/export-pdf", {
    params,
    responseType: 'blob' // Important: expect binary data
  });
  return res.data; // Returns blob
};

export const getMemberRecoveryStatus = async (memberId, groupId, date) => {
  const params = { groupId, date };
  const res = await httpRecovery.get(`/status/${memberId}`, { params });
  return res.data;
};
