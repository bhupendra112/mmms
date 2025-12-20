import httpDataManagement from "../api/httpDataManagement";

export const exportAllData = async (format = "json") => {
    try {
        const res = await httpDataManagement.get(`/export?format=${format}`);
        return res.data;
    } catch (err) {
        throw err;
    }
};

export const importData = async (data, options = {}) => {
    try {
        const res = await httpDataManagement.post("/import", { data, options });
        return res.data;
    } catch (err) {
        throw err;
    }
};

export const createBackup = async () => {
    try {
        const res = await httpDataManagement.get("/backup", {
            responseType: "blob", // For file download
        });
        return res.data;
    } catch (err) {
        throw err;
    }
};

export const deleteAllData = async (collections = [], confirm = "DELETE_ALL_DATA") => {
    try {
        const res = await httpDataManagement.post("/delete-all", { collections, confirm });
        return res.data;
    } catch (err) {
        throw err;
    }
};

export const getDataStatistics = async () => {
    try {
        const res = await httpDataManagement.get("/statistics");
        return res.data;
    } catch (err) {
        throw err;
    }
};

export const getDashboardStatistics = async () => {
    try {
        const res = await httpDataManagement.get("/dashboard-stats");
        return res.data;
    } catch (err) {
        throw err;
    }
};

