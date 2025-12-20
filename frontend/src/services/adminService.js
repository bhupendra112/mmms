// src/services/adminService.js
import http from "../api/http";

// returns axios response.data on success, throws error object on failure
export const registerAdminService = async (payload) => {
    try {
        const res = await http.post("/register", payload);
        return res.data; // success object from server
    } catch (err) {
        // err is the object thrown by interceptor: { message, status, data }
        throw err;
    }
};

export const loginAdminService = async (payload) => {
    try {
        const res = await http.post("/login", payload);
        return res.data;
    } catch (err) {
        throw err;
    }
};

export const getAdminProfile = async () => {
    try {
        const res = await http.get("/profile");
        return res.data;
    } catch (err) {
        throw err;
    }
};

export const updateAdminProfile = async (payload) => {
    try {
        const res = await http.put("/profile", payload);
        return res.data;
    } catch (err) {
        throw err;
    }
};

export const changePassword = async (payload) => {
    try {
        const res = await http.post("/change-password", payload);
        return res.data;
    } catch (err) {
        throw err;
    }
};

export const getAdminSettings = async () => {
    try {
        const res = await http.get("/settings");
        return res.data;
    } catch (err) {
        throw err;
    }
};

export const updateAdminSettings = async (payload) => {
    try {
        const res = await http.put("/settings", payload);
        return res.data;
    } catch (err) {
        throw err;
    }
};