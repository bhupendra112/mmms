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
            const pathname = window.location.pathname || "";
            const isSupervisorRoute = pathname.startsWith("/supervisor");
            const hasSupervisorToken = !!localStorage.getItem("supervisorToken");
            const isGroupRoute = pathname.startsWith("/group");
            const hasGroupToken = !!localStorage.getItem("groupToken");
            const useGroupAuth = isGroupRoute || (hasGroupToken && !isAdmin);
            const useSupervisorAuth = isSupervisorRoute || hasSupervisorToken;

            if (useSupervisorAuth) {
                localStorage.removeItem("supervisorToken");
                localStorage.removeItem("supervisorData");
                if (pathname !== "/supervisor/login") {
                    window.location.href = "/supervisor/login";
                }
            } else if (useGroupAuth) {
                localStorage.removeItem("groupToken");
                localStorage.removeItem("groupData");
                localStorage.removeItem("activeGroupId");
                localStorage.removeItem("activeGroupCode");
                localStorage.removeItem("activeGroupCache");
                if (pathname !== "/login" && pathname !== "/group/login") {
                    window.location.href = "/group/login";
                }
            } else {
                localStorage.removeItem("adminToken");
                localStorage.removeItem("adminData");
                if (pathname !== "/login-admin") {
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

