import httpJV from "../api/httpJV";

export const createJV = async (payload) => {
    const res = await httpJV.post("/create", payload);
    return res.data;
};

export const listJV = async (params = {}) => {
    const res = await httpJV.get("/list", { params });
    return res.data;
};

export const getJVDetail = async (entryId) => {
    const res = await httpJV.get(`/${entryId}`);
    return res.data;
};

export const getJVBalancePreview = async (params) => {
    const res = await httpJV.get("/balance-preview", { params });
    return res.data;
};
