// src/Api/authApi.js
import { ApiUrl } from "../redux/api_url";
import { apiCall } from "./apiService";

export const adminLoginApi = async (payload) => {
    return await apiCall({
        method: "POST",
        url: ApiUrl.ADMIN_USER_LOGIN_API,
        data: payload,
        auth: false, // login does not require token
    });
};
