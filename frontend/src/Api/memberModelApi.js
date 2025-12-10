import { ApiUrl } from "../redux/api_url";
import { apiCall } from "./apiService";

export const registerMember = async (data) => {
    return await apiCall({
        method: "POST",
        url: ApiUrl.REGISTER_MEMBER_API,
        data,
    });
};

export const exportFullMember = async () => {
    return await apiCall({
        method: "GET",
        url: ApiUrl.EXPORT_FULL_MEMBER_API,
    });
};
