/**
 * Enhanced API Error Handler
 * Provides comprehensive error handling for all API calls
 */

import { getErrorMessage, getErrorTitle, getErrorType, shouldRedirectToLogin } from "./errorHandler";

/**
 * Handle API errors and return user-friendly error information
 * @param {Error} error - The error object from API call
 * @param {Object} options - Additional options
 * @param {string} options.defaultMessage - Default error message if none found
 * @param {Function} options.on401 - Callback for 401 errors (before redirect)
 * @param {Function} options.onError - Callback for any error
 * @returns {Object} Error information object
 */
export const handleApiError = (error, options = {}) => {
    const {
        defaultMessage = "An error occurred. Please try again.",
        on401 = null,
        onError = null,
    } = options;

    // Check for 401 and handle redirect
    if (shouldRedirectToLogin(error)) {
        if (on401) {
            on401(error);
        }
        // Redirect is handled by httpInterceptor, but we can return early
        return {
            message: "Your session has expired. Redirecting to login...",
            title: "Session Expired",
            type: "auth",
            shouldShow: false, // Don't show error as redirect handles it
        };
    }

    // Get error details
    const message = getErrorMessage(error) || defaultMessage;
    const title = getErrorTitle(error);
    const type = getErrorType(error);

    // Call error callback if provided
    if (onError) {
        onError(error, { message, title, type });
    }

    return {
        message,
        title,
        type,
        shouldShow: true,
        originalError: error,
    };
};

/**
 * Extract error message from various error formats
 * @param {*} error - Error in any format
 * @returns {string} Error message
 */
export const extractErrorMessage = (error) => {
    if (!error) return "An unknown error occurred.";

    // String error
    if (typeof error === "string") {
        return error;
    }

    // Error object with message
    if (error?.message) {
        return error.message;
    }

    // API response error
    if (error?.response?.data) {
        const data = error.response.data;
        return data?.message || data?.error || data?.msg || "An error occurred.";
    }

    // Default
    return "An unexpected error occurred. Please try again.";
};

/**
 * Check if error is a network error
 */
export const isNetworkError = (error) => {
    return (
        error?.code === "ERR_NETWORK" ||
        error?.code === "ECONNABORTED" ||
        error?.message?.includes("Network Error") ||
        error?.message?.includes("timeout")
    );
};

/**
 * Check if error is a server error (5xx)
 */
export const isServerError = (error) => {
    const status = error?.response?.status;
    return status >= 500 && status < 600;
};

/**
 * Check if error is a client error (4xx)
 */
export const isClientError = (error) => {
    const status = error?.response?.status;
    return status >= 400 && status < 500;
};

/**
 * Get retry suggestion based on error type
 */
export const getRetrySuggestion = (error) => {
    if (isNetworkError(error)) {
        return "Check your internet connection and try again.";
    }
    if (isServerError(error)) {
        return "The server is experiencing issues. Please try again in a few moments.";
    }
    if (error?.response?.status === 429) {
        return "Too many requests. Please wait a moment before trying again.";
    }
    return "Please try again.";
};

