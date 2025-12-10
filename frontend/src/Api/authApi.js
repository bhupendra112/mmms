import { ApiUrl } from "../redux/api_url";
import { Instance } from "../redux/instance";

// returns the axios response
export const adminLoginApi = async (payload) => {
    try {
        console.log("LOGIN API PAYLOAD 👉", payload);
        const res = await Instance("POST", ApiUrl.ADMIN_USER_LOGIN_API, payload, null, false);
        console.log("LOGIN API FULL RESPONSE 👉", res);
        return res; // caller will use res.data
    } catch (error) {
        console.error("LOGIN API ERROR 👉", error?.response?.data || error);
        throw error;
    }
};
