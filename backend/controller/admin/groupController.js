import apiResponse from "../../utility/apiResponse.js";
import message from "../../utility/message.js";
import { BankMaster, GroupMaster, Member } from "../../model/index.js";
import { addBankValidationSchema } from "../../validation/adminValidation.js";

export const registerGroup = async (req, res) => {
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


export const addBankDetail = async (req, res) => {
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

        // Link bankmaster(s) to group if group_id provided
        if (payload.group_id) {
            await GroupMaster.findByIdAndUpdate(
                payload.group_id,
                {
                    $set: { bankmaster: newBank._id }, // keep last bank as "primary" (backward compat)
                    $addToSet: { bankmasters: newBank._id }, // store multiple
                },
                { new: true }
            );
        }

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

// ------------------------------------------------------------------
// GET: BANK LIST BY GROUP
// ------------------------------------------------------------------
export const listBanksByGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        if (!groupId) return apiResponse.error(res, "groupId is required", 400);

        const group = await GroupMaster.findById(groupId).lean();
        if (!group) return apiResponse.error(res, "Group not found", 404);

        const banks = await BankMaster.find({ group_id: groupId }).sort({ createdAt: -1 }).lean();
        return apiResponse.success(res, "Banks fetched successfully", banks);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// ------------------------------------------------------------------
// GET: LIST GROUPS
// ------------------------------------------------------------------
export const listGroups = async (req, res) => {
    try {
        const groups = await GroupMaster.find({})
            .sort({ createdAt: -1 })
            .lean();
        return apiResponse.success(res, "Groups fetched successfully", groups);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// ------------------------------------------------------------------
// GET: GROUP DETAIL BY ID
// ------------------------------------------------------------------
export const getGroupDetail = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return apiResponse.error(res, "Group id is required", 400);
        }

        let group = await GroupMaster.findById(id).populate("bankmaster").populate("bankmasters").lean();
        if (!group) {
            return apiResponse.error(res, "Group not found", 404);
        }

        // Always include all banks for this group
        const banks = await BankMaster.find({ group_id: group._id }).sort({ createdAt: -1 }).lean();

        // Fallback: if old single bankmaster not linked, use newest bank
        if (!group.bankmaster && banks.length > 0) {
            group = { ...group, bankmaster: banks[0] };
        }

        const memberCount = await Member.countDocuments({ group: group._id });
        return apiResponse.success(res, "Group detail fetched successfully", { ...group, banks, memberCount });
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// ------------------------------------------------------------------
// GET: GROUP DETAIL BY CODE
// ------------------------------------------------------------------
export const getGroupByCode = async (req, res) => {
    try {
        const { group_code } = req.params;
        if (!group_code) {
            return apiResponse.error(res, "group_code is required", 400);
        }

        let group = await GroupMaster.findOne({ group_code }).populate("bankmaster").populate("bankmasters").lean();
        if (!group) {
            return apiResponse.error(res, "Group not found", 404);
        }

        const banks = await BankMaster.find({ group_id: group._id }).sort({ createdAt: -1 }).lean();

        if (!group.bankmaster && banks.length > 0) {
            group = { ...group, bankmaster: banks[0] };
        }

        const memberCount = await Member.countDocuments({ group: group._id });
        return apiResponse.success(res, "Group detail fetched successfully", { ...group, banks, memberCount });
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};