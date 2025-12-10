import axios from "axios";
import { ApiUrl } from "./api_url";

export const Instance = async (method, URL, params = null, file = null, authRequired = true) => {
    try {
        const headers = {};
        if (authRequired) {
            const token = localStorage.getItem("accessToken") || localStorage.getItem("adminToken");
            if (token) headers.Authorization = `Bearer ${token}`;
        }

        const isFullUrl = URL.startsWith("http");
        const finalUrl = isFullUrl ? URL : `${ApiUrl.BASE}${URL}`;

        const config = {
            method: method.toLowerCase(),
            url: finalUrl,
            headers: {
                ...headers,
                "Content-Type": file === "file" ? "multipart/form-data" : "application/json",
            },
        };

        if (method.toUpperCase() === "GET" && params) config.params = params;
        else if (method.toUpperCase() !== "GET") config.data = params;

        return await axios(config);
    } catch (error) {
        console.error("API ERROR:", error?.response?.data || error.message);
        throw error;
    }
};
