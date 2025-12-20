import apiResponse from "../../utility/apiResponse.js";
import message from "../../utility/message.js";
import LoanMaster from "../../model/LoanMaster.js";
import { GroupMaster, BankMaster } from "../../model/index.js";

export const registerLoan = async (req, res) => {
    try {
        const payload = req.body || {};

        // Verify group exists
        let groupDoc = null;
        if (payload.groupId) {
            groupDoc = await GroupMaster.findById(payload.groupId);
        } else if (payload.groupCode) {
            groupDoc = await GroupMaster.findOne({ group_code: payload.groupCode });
        } else if (payload.groupName) {
            groupDoc = await GroupMaster.findOne({ group_name: payload.groupName });
        }

        if (!groupDoc) {
            return apiResponse.error(res, "Valid groupId/groupCode/groupName is required", 400);
        }

        // Validate bankId if paymentMode is "Bank"
        if (payload.paymentMode === "Bank") {
            if (!payload.bankId) {
                return apiResponse.error(res, "bankId is required when payment mode is Bank", 400);
            }
            // Verify bank exists and belongs to the group
            const bankDoc = await BankMaster.findById(payload.bankId);
            if (!bankDoc) {
                return apiResponse.error(res, "Invalid bankId. Bank not found", 400);
            }
            if (bankDoc.group_id && bankDoc.group_id.toString() !== groupDoc._id.toString()) {
                return apiResponse.error(res, "Bank does not belong to the specified group", 400);
            }
        }

        // Convert date string to Date object if needed
        let dateValue = payload.date;
        if (payload.date && typeof payload.date === 'string') {
            // Check if date is in DD/MM/YYYY format
            const ddmmyyyyPattern = /^(\d{2})\/(\d{2})\/(\d{4})$/;
            const match = payload.date.match(ddmmyyyyPattern);
            
            if (match) {
                // Convert DD/MM/YYYY to Date object
                const day = parseInt(match[1], 10);
                const month = parseInt(match[2], 10) - 1; // Month is 0-indexed
                const year = parseInt(match[3], 10);
                dateValue = new Date(year, month, day);
            } else {
                // Try to parse as ISO string or other formats
                dateValue = new Date(payload.date);
            }
            
            // Validate the date
            if (isNaN(dateValue.getTime())) {
                return apiResponse.error(res, `Invalid date format: ${payload.date}. Expected DD/MM/YYYY or ISO format.`, 400);
            }
        }

        // Create loan transaction
        const loan = await LoanMaster.create({
            ...payload,
            date: dateValue,
            groupId: groupDoc._id,
            groupName: payload.groupName || groupDoc.group_name,
            groupCode: payload.groupCode || groupDoc.group_code,
            status: "approved", // Admin actions are directly approved
            createdBy: req.user?.id || "admin",
        });

        return apiResponse.success(res, "Loan transaction registered successfully", loan);

    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

export const listLoans = async (req, res) => {
    try {
        const { groupId, groupCode, status, transactionType } = req.query;

        const filter = {};
        if (groupId) {
            filter.groupId = groupId;
        } else if (groupCode) {
            const group = await GroupMaster.findOne({ group_code: groupCode });
            if (group) filter.groupId = group._id;
        }
        if (status) filter.status = status;
        if (transactionType) filter.transactionType = transactionType;

        const loans = await LoanMaster.find(filter)
            .populate("groupId", "group_name group_code village")
            .sort({ createdAt: -1 })
            .lean();

        return apiResponse.success(res, "Loans fetched successfully", loans);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

export const getLoanDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const loan = await LoanMaster.findById(id)
            .populate("groupId", "group_name group_code village")
            .lean();

        if (!loan) {
            return apiResponse.error(res, "Loan not found", 404);
        }

        return apiResponse.success(res, "Loan detail fetched successfully", loan);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

