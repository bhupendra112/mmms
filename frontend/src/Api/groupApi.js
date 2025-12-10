import { ApiUrl } from "../redux/api_url";
import { apiCall } from "./apiService";

export const allGroup = async () => {
    return await apiCall({
        method: "GET",
        url: ApiUrl.GET_GROUP_DETAIL_API,
    });
};

export const addGroup = async (data) => {
    return await apiCall({
        method: "POST",
        url: ApiUrl.REGISTER_GROUP_API,
        data,
    });
};

export const addBank = async (data) => {
    return await apiCall({
        method: "POST",
        url: ApiUrl.ADD_BANK_GROUP_API,
        data,
    });
};
