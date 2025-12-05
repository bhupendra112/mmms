// src/services/adminService.js
import http from "../api/http";

// returns axios response.data on success, throws error object on failure
export const registerAdminService = async(payload) => {
    try {
        const res = await http.post("/register", payload);
        return res.data; // success object from server
    } catch (err) {
        // err is the object thrown by interceptor: { message, status, data }
        throw err;
    }
};

export const loginAdminService = async(payload) => {
    try {
        const res = await http.post("/login", payload);
        return res.data;
    } catch (err) {
        throw err;
    }
};