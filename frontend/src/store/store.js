import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import groupAuthReducer from "./groupAuthSlice";

export const store = configureStore({
    reducer: {
        auth: authReducer,
        groupAuth: groupAuthReducer,
    },
});

