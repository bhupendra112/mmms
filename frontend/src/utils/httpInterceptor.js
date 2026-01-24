/**
 * Centralized HTTP Response Interceptor
 * Handles all error status codes consistently across all HTTP instances
 */
import { getErrorMessage, shouldRedirectToLogin } from "./errorHandler";

export const createErrorInterceptor = (isAdmin = true) => {
    return (error) => {
        const status = error?.response?.status;

        // Handle 401 Unauthorized - redirect to appropriate login
        if (status === 401) {
            // Auto-detect if we're in group context based on current route
            const isGroupRoute = window.location.pathname.startsWith("/group");
            // Also check if group token exists (more reliable than just route)
            const hasGroupToken = !!localStorage.getItem("groupToken");
            const useGroupAuth = isGroupRoute || (hasGroupToken && !isAdmin);

            // Clear tokens
            if (useGroupAuth) {
                // For group authentication, clear group tokens
                localStorage.removeItem("groupToken");
                localStorage.removeItem("groupData");
                localStorage.removeItem("activeGroupId");
                localStorage.removeItem("activeGroupCode");
                localStorage.removeItem("activeGroupCache");
                // Redirect to group login if not already there
                if (window.location.pathname !== "/login" && window.location.pathname !== "/group/login") {
                    window.location.href = "/login";
                }
            } else {
                // For admin authentication
                localStorage.removeItem("adminToken");
                localStorage.removeItem("adminData");
                // Redirect to admin login if not already there
                if (window.location.pathname !== "/login-admin") {
                    window.location.href = "/login-admin";
                }
            }
        }

        // Get user-friendly error message
        const errorMessage = getErrorMessage(error);

        // Create a new error with the friendly message
        const friendlyError = new Error(errorMessage);
        friendlyError.status = status;
        friendlyError.originalError = error;
        friendlyError.response = error?.response;

        return Promise.reject(friendlyError);
    };
};

export const createRequestInterceptor = (getToken) => {
    return (config) => {
        const token = getToken();
        if (token) {
            config.headers["Authorization"] = `Bearer ${token}`;
        }
        return config;
    };
};

