import React, { createContext, useContext, useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { setCredentials, updateAdmin, logout as logoutAction } from "../store/authSlice";
import { selectAdmin, selectIsAuthenticated, selectToken } from "../store/authSlice";

const AdminContext = createContext();

export const useAdmin = () => {
    const context = useContext(AdminContext);
    if (!context) {
        return {
            admin: null,
            isAuthenticated: false,
            isLoading: true,
            login: async () => { },
            logout: () => { },
            refreshProfile: async () => { },
        };
    }
    return context;
};

export const AdminProvider = ({ children }) => {
    const dispatch = useDispatch();
    const admin = useSelector(selectAdmin);
    const token = useSelector(selectToken);
    const isAuthenticated = useSelector(selectIsAuthenticated);
    const [isInitialized, setIsInitialized] = useState(false);

    // Initialize from localStorage on mount
    useEffect(() => {
        const storedToken = localStorage.getItem("adminToken");
        const storedAdmin = localStorage.getItem("adminData");

        if (storedToken && storedAdmin) {
            try {
                const adminData = JSON.parse(storedAdmin);
                // Restore Redux state from localStorage
                dispatch(setCredentials({ token: storedToken, admin: adminData }));
            } catch (e) {
                console.error("Failed to parse admin data:", e);
                localStorage.removeItem("adminToken");
                localStorage.removeItem("adminData");
            }
        }
        setIsInitialized(true);
    }, [dispatch]);

    const login = async (token, adminData) => {
        dispatch(setCredentials({ token, admin: adminData }));
    };

    const logout = () => {
        dispatch(logoutAction());
        // Redirect to login page
        window.location.href = "/login-admin";
    };

    const refreshProfile = async (updatedAdmin) => {
        if (updatedAdmin) {
            dispatch(updateAdmin(updatedAdmin));
        }
    };

    const value = {
        admin,
        isAuthenticated: isInitialized ? isAuthenticated : false,
        isLoading: !isInitialized,
        login,
        logout,
        refreshProfile,
    };

    return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};

