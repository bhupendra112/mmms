import { useState, useCallback } from "react";
import { handleApiError } from "../utils/apiErrorHandler";

/**
 * Custom hook for handling API calls with loading and error states
 * @param {Object} options - Configuration options
 * @param {string} options.defaultErrorMessage - Default error message
 * @param {Function} options.onSuccess - Callback on success
 * @param {Function} options.onError - Callback on error
 * @param {Function} options.on401 - Callback on 401 error
 * @returns {Object} API call utilities and state
 */
export function useApiCall(options = {}) {
    const {
        defaultErrorMessage = "An error occurred. Please try again.",
        onSuccess = null,
        onError = null,
        on401 = null,
    } = options;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const execute = useCallback(
        async (apiCall, successCallback = null) => {
            try {
                setLoading(true);
                setError(null);

                const response = await apiCall();

                // Handle response
                if (response?.success !== false) {
                    // Success
                    if (onSuccess) {
                        onSuccess(response);
                    }
                    if (successCallback) {
                        successCallback(response);
                    }
                    return { success: true, data: response?.data || response };
                } else {
                    // API returned success: false
                    const errorInfo = handleApiError(
                        { message: response.message || response.error },
                        {
                            defaultMessage: defaultErrorMessage,
                            on401,
                            onError,
                        }
                    );
                    setError(errorInfo);
                    return { success: false, error: errorInfo };
                }
            } catch (err) {
                const errorInfo = handleApiError(err, {
                    defaultMessage: defaultErrorMessage,
                    on401,
                    onError: (error, info) => {
                        if (onError) onError(error, info);
                    },
                });

                if (errorInfo.shouldShow) {
                    setError(errorInfo);
                }

                return { success: false, error: errorInfo };
            } finally {
                setLoading(false);
            }
        },
        [defaultErrorMessage, onSuccess, onError, on401]
    );

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const retry = useCallback(
        async (apiCall, successCallback = null) => {
            return execute(apiCall, successCallback);
        },
        [execute]
    );

    return {
        loading,
        error,
        execute,
        clearError,
        retry,
        setError, // Allow manual error setting if needed
    };
}

