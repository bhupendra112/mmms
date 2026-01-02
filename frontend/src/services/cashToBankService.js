import httpCashToBank from "../api/httpCashToBank.js";

// Create conversion request
export const createConversion = async (data) => {
    const formData = new FormData();
    
    // Add all fields to FormData
    Object.keys(data).forEach((key) => {
        if (key !== "paymentImage" && data[key] !== undefined && data[key] !== null) {
            formData.append(key, data[key]);
        }
    });
    
    // Add file if present
    if (data.paymentImage && data.paymentImage instanceof File) {
        formData.append("paymentImage", data.paymentImage);
    }
    
    const res = await httpCashToBank.post("/create", formData, {
        headers: {
            "Content-Type": "multipart/form-data",
        },
    });
    return res.data;
};

// Get conversions with filters
export const getConversions = async (groupId = null, filters = {}) => {
    const params = { ...filters };
    if (groupId) params.groupId = groupId;
    const res = await httpCashToBank.get("/list", { params });
    return res.data;
};

// Get pending conversions
export const getPendingConversions = async () => {
    const res = await httpCashToBank.get("/pending");
    return res.data;
};

// Approve conversion
export const approveConversion = async (id) => {
    const res = await httpCashToBank.post(`/approve/${id}`);
    return res.data;
};

// Reject conversion
export const rejectConversion = async (id, rejectionReason) => {
    const res = await httpCashToBank.post(`/reject/${id}`, { rejectionReason });
    return res.data;
};

// Process conversion
export const processConversion = async (id) => {
    const res = await httpCashToBank.post(`/process/${id}`);
    return res.data;
};

// Get conversion detail
export const getConversionDetail = async (id) => {
    const res = await httpCashToBank.get(`/detail/${id}`);
    return res.data;
};

