import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  token: localStorage.getItem("adminToken") || null,
  admin: JSON.parse(localStorage.getItem("adminData") || "null"),
  isAuthenticated: !!localStorage.getItem("adminToken"),
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { token, admin } = action.payload;
      state.token = token;
      state.admin = admin;
      state.isAuthenticated = true;
      
      // Persist to localStorage
      localStorage.setItem("adminToken", token);
      localStorage.setItem("adminData", JSON.stringify(admin));
    },
    updateAdmin: (state, action) => {
      state.admin = { ...state.admin, ...action.payload };
      localStorage.setItem("adminData", JSON.stringify(state.admin));
    },
    logout: (state) => {
      state.token = null;
      state.admin = null;
      state.isAuthenticated = false;
      
      // Clear localStorage
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminData");
    },
  },
});

export const { setCredentials, updateAdmin, logout } = authSlice.actions;

// Selectors
export const selectToken = (state) => state.auth.token;
export const selectAdmin = (state) => state.auth.admin;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;

export default authSlice.reducer;

