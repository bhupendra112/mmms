import http from "../api/http";

export const getCashAmount = async (groupId) => {
    const response = await http.get(`/admin/cash-amount/${groupId}`);
    return response.data;
}
