import apiResponse from "../../utility/apiResponse.js";
import message from "../../utility/message.js";
import { BankMaster, GroupMaster } from "../../model/index.js";
import { addBankValidationSchema } from "../../validation/adminValidation.js";

export const registerGroup = async(req, res) => {
    try {
        const {
            group_name,
            group_code
        } = req.body;

        // Check if group exists
        const exists = await GroupMaster.findOne({ group_code });
        if (exists) {
            return apiResponse.error(res, message.GROUP_EXISTS, 400);
        }

        // Create new group
        const newGroup = await GroupMaster.create(req.body);

        return apiResponse.success(res, message.GROUP_REGISTERED, newGroup);

    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};


export const addBankDetail = async(req, res) => {
    try {
        // Guard: make sure req.body exists
        const { error } = addBankValidationSchema.validate(req.body);
        if (error) {
            return apiResponse.error(res, error.details[0].message, 400);
        }
        if (!req || !req.body) {
            return res.status(400).json({ success: false, message: "Missing request body" });
        }

        const payload = req.body;

        // Make sure account_no exists
        if (!payload.account_no) {
            return res.status(400).json({ success: false, message: "account_no is required" });
        }

        // Check duplicate account number
        const exists = await BankMaster.findOne({ account_no: payload.account_no });
        if (exists) {
            return res.status(400).json({ success: false, message: "Bank with this account_no already exists" });
        }

        // If group_id provided, verify it exists
        if (payload.group_id) {
            const group = await GroupMaster.findById(payload.group_id);
            if (!group) {
                return res.status(404).json({ success: false, message: "Provided group_id does not exist" });
            }
        }

        // Create bank record (store full payload as-is)
        const newBank = await BankMaster.create(payload);

        return res.status(201).json({ success: true, message: "Bank added", data: newBank });
    } catch (error) {
        console.error("addBankDetail error:", error);
        // handle Mongoose duplicate key differently if needed
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "Duplicate key error", detail: error.keyValue });
        }
        return res.status(500).json({ success: false, message: error.message });
    }
};