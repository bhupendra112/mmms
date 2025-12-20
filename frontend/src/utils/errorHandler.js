/**
 * Centralized Error Handler for API Responses
 * Handles all HTTP status codes and provides user-friendly error messages
 */

export const getErrorMessage = (error) => {
    // If error is already a string, return it
    if (typeof error === "string") {
        return error;
    }

    // If error has a response with status
    if (error?.response) {
        const status = error.response.status;
        const data = error.response.data;
        const message = data?.message || data?.error || "";

        switch (status) {
            case 400:
                return message || "Invalid request. Please check your input and try again.";
            case 401:
                return "Your session has expired. Please log in again.";
            case 403:
                return message || "You don't have permission to perform this action.";
            case 404:
                return message || "The requested resource was not found.";
            case 409:
                return message || "A conflict occurred. This resource may already exist.";
            case 422:
                return message || "Validation error. Please check your input.";
            case 429:
                return "Too many requests. Please try again later.";
            case 500:
                return message || "Internal server error. Please try again later or contact support.";
            case 502:
                return "Bad gateway. The server is temporarily unavailable.";
            case 503:
                return "Service unavailable. The server is temporarily down for maintenance.";
            case 504:
                return "Gateway timeout. The server took too long to respond.";
            default:
                return message || `An error occurred (${status}). Please try again.`;
        }
    }

    // Network errors
    if (error?.code === "ECONNABORTED" || error?.message?.includes("timeout")) {
        return "Request timeout. Please check your internet connection and try again.";
    }

    if (error?.code === "ERR_NETWORK" || error?.message?.includes("Network Error")) {
        return "Network error. Please check your internet connection and try again.";
    }

    // Default error message
    return error?.message || "An unexpected error occurred. Please try again.";
};

export const getErrorTitle = (error) => {
    if (error?.response) {
        const status = error.response.status;

        switch (status) {
            case 400:
                return "Bad Request";
            case 401:
                return "Unauthorized";
            case 403:
                return "Forbidden";
            case 404:
                return "Not Found";
            case 409:
                return "Conflict";
            case 422:
                return "Validation Error";
            case 429:
                return "Too Many Requests";
            case 500:
                return "Server Error";
            case 502:
                return "Bad Gateway";
            case 503:
                return "Service Unavailable";
            case 504:
                return "Gateway Timeout";
            default:
                return "Error";
        }
    }

    if (error?.code === "ECONNABORTED" || error?.message?.includes("timeout")) {
        return "Timeout";
    }

    if (error?.code === "ERR_NETWORK" || error?.message?.includes("Network Error")) {
        return "Network Error";
    }

    return "Error";
};

export const getErrorType = (error) => {
    if (error?.response) {
        const status = error.response.status;

        if (status >= 400 && status < 500) {
            return "client"; // Client error
        } else if (status >= 500) {
            return "server"; // Server error
        }
    }

    if (error?.code === "ECONNABORTED" || error?.code === "ERR_NETWORK") {
        return "network"; // Network error
    }

    return "unknown";
};

export const shouldRedirectToLogin = (error) => {
    return error?.response?.status === 401;
};

export const shouldShowError = (error) => {
    // Don't show errors for 401 (handled by redirect)
    // Don't show errors for cancelled requests
    if (error?.response?.status === 401) {
        return false;
    }
    return true;
};

