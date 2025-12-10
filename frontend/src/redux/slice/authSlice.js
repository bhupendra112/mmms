import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    token: localStorage.getItem("accessToken") || null,
    adminName: localStorage.getItem("adminName") || null,
    isAuthenticated: !!localStorage.getItem("accessToken"),
};

const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        setAuth: (state, action) => {
            state.token = action.payload.token;
            state.adminName = action.payload.adminName;
            state.isAuthenticated = true;
            // Persist in localStorage
            localStorage.setItem("accessToken", action.payload.token);
            localStorage.setItem("adminName", action.payload.adminName || "");
        },
        logout: (state) => {
            state.token = null;
            state.adminName = null;
            state.isAuthenticated = false;
            localStorage.removeItem("accessToken");
            localStorage.removeItem("adminName");
        },
    },
});

export const { setAuth, logout } = authSlice.actions;
export default authSlice.reducer;
