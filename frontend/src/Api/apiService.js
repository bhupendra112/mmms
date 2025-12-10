import { Instance } from "../redux/instance";
import { ApiUrl } from "../redux/api_url";

// Centralized API call handler
export const apiCall = async ({ method, url, data = null, auth = true }) => {
    try {
        const res = await Instance(method, url, data, undefined, auth);
        return res.data; // Return only data
    } catch (error) {
        // Global error handling
        const status = error?.status || error?.response?.status;
        const message =
            error?.data?.message ||
            error?.response?.data?.message ||
            error?.message ||
            "Something went wrong";

        switch (status) {
            case 400:
                alert("Bad Request: " + message);
                break;
            case 401:
                alert("Unauthorized: Please login again.");
                // Optional redirect: window.location.href = "/login";
                break;
            case 403:
                alert("Forbidden: " + message);
                break;
            case 404:
                alert("Not Found: " + message);
                break;
            case 409:
                alert("Conflict: " + message);
                break;
            case 500:
                alert("Server Error: " + message);
                break;
            default:
                if (message) alert(message);
                break;
        }

        // throw to allow component-specific handling if needed
        throw error;
    }
};
