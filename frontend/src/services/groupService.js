import http from "../api/http";

// -------------------------------------------------------------
// CREATE GROUP MASTER
// -------------------------------------------------------------
export const createGroup = async(data) => {
    try {
        const res = await http.post("/register-group", data);
        return res.data;
    } catch (err) {
        throw err.response ? err.response.data : err;
    }
};

// -------------------------------------------------------------
// CREATE BANK MASTER (linked with group_id)
// -------------------------------------------------------------
export const createBank = async(data) => {
    try {
        const res = await http.post("/add-bank", data);
        return res.data;
    } catch (err) {
        throw err.response ? err.response.data : err;
    }
};