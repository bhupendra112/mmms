import http from "../api/http";

// Create bank transaction receipt
export const createBankTransaction = async (data) => {
    const response = await http.post("/admin/bank-transaction", data);
    return response.data;
};

// Get all bank transactions with filters
export const getBankTransactions = async (params = {}) => {
    const response = await http.get("/admin/bank-transaction", { params });
    return response.data;
};

// Get bank transaction by ID
export const getBankTransactionById = async (id) => {
    const response = await http.get(`/admin/bank-transaction/${id}`);
    return response.data;
};

// Update bank transaction
export const updateBankTransaction = async (id, data) => {
    const response = await http.put(`/admin/bank-transaction/${id}`, data);
    return response.data;
};

// Verify/Reject bank transaction
export const verifyBankTransaction = async (id, status, rejectionReason = null) => {
    const response = await http.patch(`/admin/bank-transaction/${id}/verify`, {
        status,
        rejectionReason,
    });
    return response.data;
};

// Delete bank transaction
export const deleteBankTransaction = async (id) => {
    const response = await http.delete(`/admin/bank-transaction/${id}`);
    return response.data;
};

// Get bank transactions by bank ID
export const getBankTransactionsByBank = async (bankId, params = {}) => {
    const response = await http.get(`/admin/bank-transaction/bank/${bankId}`, { params });
    return response.data;
};

// Get bank transactions by group ID
export const getBankTransactionsByGroup = async (groupId, params = {}) => {
    const response = await http.get(`/admin/bank-transaction/group/${groupId}`, { params });
    return response.data;
};

