import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import groupAuthReducer from "./groupAuthSlice";
import supervisorAuthReducer from "./supervisorAuthSlice";

export const store = configureStore({
    reducer: {
        auth: authReducer,
        groupAuth: groupAuthReducer,
        supervisorAuth: supervisorAuthReducer,
    },
});

