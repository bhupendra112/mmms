import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    token: localStorage.getItem("supervisorToken") || null,
    supervisor: JSON.parse(localStorage.getItem("supervisorData") || "null"),
    isAuthenticated: !!localStorage.getItem("supervisorToken"),
};

const supervisorAuthSlice = createSlice({
    name: "supervisorAuth",
    initialState,
    reducers: {
        setSupervisorCredentials: (state, action) => {
            const { token, supervisor } = action.payload;
            state.token = token;
            state.supervisor = supervisor;
            state.isAuthenticated = true;

            localStorage.setItem("supervisorToken", token);
            localStorage.setItem("supervisorData", JSON.stringify(supervisor));
        },
        logoutSupervisor: (state) => {
            state.token = null;
            state.supervisor = null;
            state.isAuthenticated = false;

            localStorage.removeItem("supervisorToken");
            localStorage.removeItem("supervisorData");
        },
    },
});

export const { setSupervisorCredentials, logoutSupervisor } = supervisorAuthSlice.actions;

export const selectSupervisorToken = (state) => state.supervisorAuth.token;
export const selectSupervisor = (state) => state.supervisorAuth.supervisor;
export const selectIsSupervisorAuthenticated = (state) => state.supervisorAuth.isAuthenticated;

export default supervisorAuthSlice.reducer;
