import httpVoucher from "../api/httpVoucher";

export const getVoucherRange = async (groupId) => {
    const res = await httpVoucher.get("/range", { params: { groupId } });
    return res.data;
};

export const saveVoucherRange = async (payload) => {
    const res = await httpVoucher.put("/range", payload);
    return res.data;
};

export const suggestNextVoucherNumber = async (groupId) => {
    const res = await httpVoucher.get("/suggest", { params: { groupId } });
    return res.data;
};

export const lookupLoanByVoucher = async (groupId, voucherNumber) => {
    const res = await httpVoucher.get("/lookup", {
        params: { groupId, voucherNumber },
    });
    return res.data;
};

export const getUsedVouchers = async (groupId, search = "") => {
    const res = await httpVoucher.get("/list-used", {
        params: { groupId, search },
    });
    return res.data;
};
