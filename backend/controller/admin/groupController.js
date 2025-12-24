import apiResponse from "../../utility/apiResponse.js";
import message from "../../utility/message.js";
import { BankMaster, GroupMaster, Member, LoanMaster, RecoveryMaster } from "../../model/index.js";
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

// ------------------------------------------------------------------
// GET: BANK DETAIL BY ID WITH TRANSACTIONS
// ------------------------------------------------------------------
export const getBankDetail = async (req, res) => {
    try {
        const { bankId } = req.params;
        if (!bankId) {
            return apiResponse.error(res, "Bank id is required", 400);
        }

        // Get bank details
        const bank = await BankMaster.findById(bankId).lean();
        if (!bank) {
            return apiResponse.error(res, "Bank not found", 404);
        }

        // Get group ID if available
        const groupId = bank.group_id;

        // Get transactions related to this bank (filter by bankId - show all transactions with this bankId, regardless of payment mode)
        let transactions = [];
        if (groupId) {
            // Get all loans/transactions for this group that are associated with this specific bank
            // Include both Cash and Bank payment modes if bankId is set
            const loanTransactions = await LoanMaster.find({
                groupId: groupId,
                bankId: bankId,
                status: "approved"
            }).sort({ date: -1, createdAt: -1 }).lean();

            // Get all recoveries for this group that are online payments
            const recoveryTransactions = await RecoveryMaster.find({
                groupId: groupId,
                status: "approved",
                "totals.totalOnline": { $gt: 0 }
            }).sort({ date: -1, createdAt: -1 }).lean();

            // Format loan transactions
            transactions = loanTransactions.map(tx => ({
                id: tx._id,
                type: "Loan",
                transactionType: tx.transactionType,
                date: tx.date,
                amount: tx.amount,
                paymentMode: tx.paymentMode,
                purpose: tx.purpose,
                memberName: tx.memberName || "Group Loan",
                memberCode: tx.memberCode || "",
                isGroupLoan: tx.isGroupLoan,
                createdAt: tx.createdAt
            }));

            // Format recovery transactions
            recoveryTransactions.forEach(rec => {
                rec.recoveries.forEach(memberRec => {
                    if (memberRec.paymentMode && memberRec.paymentMode.online && memberRec.total > 0) {
                        transactions.push({
                            id: `${rec._id}_${memberRec.memberId}`,
                            type: "Recovery",
                            transactionType: "Recovery",
                            date: rec.date,
                            amount: memberRec.total,
                            paymentMode: "Bank",
                            purpose: "Recovery",
                            memberName: memberRec.memberName,
                            memberCode: memberRec.memberCode,
                            isGroupLoan: false,
                            createdAt: rec.createdAt
                        });
                    }
                });
            });

            // Sort all transactions by date (newest first)
            transactions.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
        }

        return apiResponse.success(res, "Bank detail fetched successfully", {
            bank,
            transactions,
            transactionCount: transactions.length
        });
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// ------------------------------------------------------------------
// PUT: UPDATE GROUP
// ------------------------------------------------------------------
export const updateGroup = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return apiResponse.error(res, "Group id is required", 400);
        }

        const group = await GroupMaster.findById(id);
        if (!group) {
            return apiResponse.error(res, "Group not found", 404);
        }

        // If group_code is being updated, check for duplicates
        if (req.body.group_code && req.body.group_code !== group.group_code) {
            const exists = await GroupMaster.findOne({ group_code: req.body.group_code });
            if (exists) {
                return apiResponse.error(res, "Group code already exists", 400);
            }
        }

        // Update group
        const updatedGroup = await GroupMaster.findByIdAndUpdate(
            id,
            { $set: req.body },
            { new: true, runValidators: true }
        ).populate("bankmaster").populate("bankmasters").lean();

        return apiResponse.success(res, "Group updated successfully", updatedGroup);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// ------------------------------------------------------------------
// PUT: UPDATE BANK DETAIL
// ------------------------------------------------------------------
export const updateBankDetail = async (req, res) => {
    try {
        const { bankId } = req.params;
        if (!bankId) {
            return apiResponse.error(res, "Bank id is required", 400);
        }

        const bank = await BankMaster.findById(bankId);
        if (!bank) {
            return apiResponse.error(res, "Bank not found", 404);
        }

        // If account_no is being updated, check for duplicates
        if (req.body.account_no && req.body.account_no !== bank.account_no) {
            const exists = await BankMaster.findOne({ account_no: req.body.account_no });
            if (exists) {
                return apiResponse.error(res, "Account number already exists", 400);
            }
        }

        // Update bank
        const updatedBank = await BankMaster.findByIdAndUpdate(
            bankId,
            { $set: req.body },
            { new: true, runValidators: true }
        ).lean();

        // If group_id changed, update group references
        if (req.body.group_id && req.body.group_id !== bank.group_id?.toString()) {
            // Remove from old group
            if (bank.group_id) {
                await GroupMaster.findByIdAndUpdate(
                    bank.group_id,
                    {
                        $pull: { bankmasters: bankId },
                        $unset: { bankmaster: bank.group_id === bankId ? "" : undefined }
                    }
                );
            }
            // Add to new group
            await GroupMaster.findByIdAndUpdate(
                req.body.group_id,
                {
                    $addToSet: { bankmasters: bankId },
                    $set: { bankmaster: bankId } // Set as primary
                }
            );
        }

        return apiResponse.success(res, "Bank updated successfully", updatedBank);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};