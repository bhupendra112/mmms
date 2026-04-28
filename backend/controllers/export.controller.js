import apiResponse from "../utility/apiResponse.js";
import { exportToExcel } from "../utils/excelExport.js";
import {
    getBankMasterData,
    getGroupMasterData,
    getShgMemberMasterData,
} from "../services/export.service.js";

export const exportBankMaster = async (req, res) => {
    try {
        const { rows, headers } = await getBankMasterData();
        await exportToExcel(res, rows, "BankMaster", "bank_master.xlsx", headers);
    } catch (error) {
        return apiResponse.error(res, error.message || "Failed to export bank master", 500);
    }
};

export const exportGroupMaster = async (req, res) => {
    try {
        const { rows, headers } = await getGroupMasterData();
        await exportToExcel(res, rows, "GroupMaster", "group_master.xlsx", headers);
    } catch (error) {
        return apiResponse.error(res, error.message || "Failed to export group master", 500);
    }
};

export const exportShgMemberMaster = async (req, res) => {
    try {
        const { rows, headers } = await getShgMemberMasterData();
        await exportToExcel(res, rows, "SHGMemberMaster", "shg_member_master.xlsx", headers);
    } catch (error) {
        return apiResponse.error(res, error.message || "Failed to export SHG member master", 500);
    }
};
