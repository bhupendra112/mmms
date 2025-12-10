import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";

export default function ProtectedRoute() {
    const isAuthenticated = useSelector(
        (state) => state.auth.isAuthenticated
    );

    // 🚫 No token → redirect to login
    if (!isAuthenticated) {
        return <Navigate to="/login-admin" replace />;
    }

    // ✅ Token exists → allow route
    return <Outlet />;
}
