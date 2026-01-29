import apiResponse from "../../utility/apiResponse.js";
import message from "../../utility/message.js";
import { BankMaster, GroupMaster, Member, LoanMaster, RecoveryMaster, PaymentMaster } from "../../model/index.js";
import BankTransaction from "../../model/BankTransaction.js";
import CashTransaction from "../../model/CashTransaction.js";
import { addBankValidationSchema, updateGroupSchema, updateBankValidationSchema } from "../../validation/adminValidation.js";
import { verifyGroupAccess, verifyGroupAccessByCode, getAdminPlace } from "../../utility/groupAccessHelper.js";

export const registerGroup = async (req, res) => {
    try {
        const {
            group_name,
            group_code,
            village,
            cluster_name,
            cluster_code
        } = req.body;

        // Get admin's place from token
        const adminPlace = await getAdminPlace(req);

        if (!adminPlace) {
            return apiResponse.error(res, "Admin place not found. Please ensure you are logged in.", 400);
        }

        // Check if group exists with same code in same village/cluster
        // Uniqueness is based on group_code + village (or cluster_name/cluster_code if village is not provided)
        const query = { group_code };
        if (village) {
            query.village = village;
        } else if (cluster_code) {
            query.cluster_code = cluster_code;
        } else if (cluster_name) {
            query.cluster_name = cluster_name;
        }

        const exists = await GroupMaster.findOne(query);
        if (exists) {
            const location = village || cluster_name || 'this location';
            return apiResponse.error(res, `Group with code "${group_code}" already exists in ${location}`, 400);
        }

        // Add admin's place to group data
        const groupData = {
            ...req.body,
            place: adminPlace // Associate group with admin's place
        };

        // Create new group
        const newGroup = await GroupMaster.create(groupData);

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
        // Initialize current_balance: CC uses cc_limit; Saving/FD use opening_balance
        if (payload.current_balance === undefined) {
            if (payload.account_type === "CC" && payload.cc_limit !== undefined) {
                payload.current_balance = payload.cc_limit || 0;
                console.log("[addBankDetail] CC account: current_balance set from cc_limit", { cc_limit: payload.cc_limit, current_balance: payload.current_balance });
            } else if (payload.opening_balance !== undefined) {
                payload.current_balance = payload.opening_balance || 0;
                console.log("[addBankDetail] Saving/FD account: current_balance set from opening_balance", { opening_balance: payload.opening_balance, current_balance: payload.current_balance });
            } else {
                console.log("[addBankDetail] current_balance left undefined (using model default)", { account_type: payload.account_type });
            }
        }
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

        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'groupController.js:132', message: 'listBanksByGroup - ENTRY', data: { groupId, userType: req.user?.type, adminType: req.admin?.type }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H8' }) }).catch(() => { });
        // #endregion

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Verify group access
        const accessCheck = await verifyGroupAccess(groupId, adminPlace);
        if (!accessCheck.valid) {
            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'groupController.js:142', message: 'listBanksByGroup - ACCESS DENIED', data: { groupId, error: accessCheck.error }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H8' }) }).catch(() => { });
            // #endregion
            return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
        }

        const group = accessCheck.group;

        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'groupController.js:153', message: 'listBanksByGroup - GROUP DOCUMENT', data: { groupId, groupName: group?.group_name, groupCode: group?.group_code, hasBankmasters: !!group?.bankmasters, bankmastersType: typeof group?.bankmasters, bankmastersIsArray: Array.isArray(group?.bankmasters), bankmastersLength: group?.bankmasters?.length || 0, bankmastersRaw: group?.bankmasters, hasBankmaster: !!group?.bankmaster, bankmasterRaw: group?.bankmaster }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H8' }) }).catch(() => { });
        // #endregion

        // Get banks for the group - check both BankMaster.group_id AND GroupMaster.bankmasters array
        const mongoose = (await import("mongoose")).default;
        const groupObjectId = mongoose.Types.ObjectId.isValid(groupId) ? new mongoose.Types.ObjectId(groupId) : groupId;

        // Get bank IDs from group's bankmasters array (if any)
        const bankIdsFromGroup = [];
        if (group.bankmasters && Array.isArray(group.bankmasters) && group.bankmasters.length > 0) {
            bankIdsFromGroup.push(...group.bankmasters.map(id => id.toString()));
        }
        // Also check the deprecated bankmaster field
        if (group.bankmaster) {
            bankIdsFromGroup.push(group.bankmaster.toString());
        }

        // Build query: check group_id field OR bank is in group's bankmasters array
        const queryConditions = [
            { group_id: groupObjectId },
            { group_id: groupId },
            { groupId: groupObjectId },
            { groupId: groupId }
        ];

        // If group has bankmasters array, also query by _id
        if (bankIdsFromGroup.length > 0) {
            const bankObjectIds = bankIdsFromGroup
                .filter(id => mongoose.Types.ObjectId.isValid(id))
                .map(id => new mongoose.Types.ObjectId(id));
            if (bankObjectIds.length > 0) {
                queryConditions.push({ _id: { $in: bankObjectIds } });
            }
        }

        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'groupController.js:155', message: 'listBanksByGroup - QUERY CONDITIONS', data: { groupId, groupObjectId: groupObjectId.toString(), bankIdsFromGroup, queryConditionCount: queryConditions.length, hasBankmastersArray: group.bankmasters?.length > 0, bankmastersCount: group.bankmasters?.length || 0 }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H8' }) }).catch(() => { });
        // #endregion

        let banks = await BankMaster.find({
            $or: queryConditions
        }).sort({ createdAt: -1 }).lean();

        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'groupController.js:195', message: 'listBanksByGroup - BANKS QUERIED (PRIMARY)', data: { groupId, groupObjectId: groupObjectId.toString(), bankCount: banks.length, bankIds: banks.map(b => b._id?.toString()), foundViaGroupId: banks.filter(b => b.group_id?.toString() === groupObjectId.toString()).length, foundViaBankmasters: banks.filter(b => bankIdsFromGroup.includes(b._id?.toString())).length }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H8' }) }).catch(() => { });
        // #endregion

        // Fallback: If no banks found via primary methods, check banks used in transactions for this group
        if (banks.length === 0) {
            // Find unique bank IDs from BankTransaction, PaymentMaster, ExpenseMaster, LoanMaster, and FDMaster for this group
            const bankTransactions = await BankTransaction.find({ groupId: groupObjectId })
                .select('bankId')
                .lean();
            const payments = await PaymentMaster.find({ groupId: groupObjectId })
                .select('bankId paymentMode')
                .lean();
            const ExpenseMaster = (await import("../../model/ExpenseMaster.js")).default;
            const expenses = await ExpenseMaster.find({ groupId: groupObjectId })
                .select('bankId paymentMode')
                .lean();
            const loans = await LoanMaster.find({ groupId: groupObjectId })
                .select('bankId paymentMode')
                .lean();
            const FDMaster = (await import("../../model/FDMaster.js")).default;
            const fds = await FDMaster.find({ groupId: groupObjectId })
                .select('bankId')
                .lean();

            // #region agent log - Detailed inspection
            const paymentSamples = payments.slice(0, 3).map(p => ({ id: p._id?.toString(), paymentMode: p.paymentMode, bankId: p.bankId?.toString(), hasBankId: !!p.bankId }));
            const loanSamples = loans.slice(0, 3).map(l => ({ id: l._id?.toString(), paymentMode: l.paymentMode, bankId: l.bankId?.toString(), hasBankId: !!l.bankId }));
            const fdSamples = fds.slice(0, 3).map(f => ({ id: f._id?.toString(), bankId: f.bankId?.toString(), hasBankId: !!f.bankId }));
            fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'groupController.js:224', message: 'listBanksByGroup - FALLBACK DETAILED INSPECTION', data: { groupId, transactionCount: bankTransactions.length, paymentCount: payments.length, paymentSamples, loanCount: loans.length, loanSamples, fdCount: fds.length, fdSamples, expenseCount: expenses.length }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H8' }) }).catch(() => { });
            // #endregion

            const transactionBankIds = [...new Set([
                ...bankTransactions.map(t => t.bankId?.toString()).filter(Boolean),
                ...payments.filter(p => p.paymentMode === 'Bank').map(p => p.bankId?.toString()).filter(Boolean),
                ...expenses.filter(e => e.paymentMode === 'Bank').map(e => e.bankId?.toString()).filter(Boolean),
                ...loans.filter(l => l.paymentMode === 'Bank').map(l => l.bankId?.toString()).filter(Boolean),
                ...fds.map(f => f.bankId?.toString()).filter(Boolean)
            ])];

            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'groupController.js:235', message: 'listBanksByGroup - FALLBACK CHECK', data: { groupId, transactionBankIds, transactionCount: bankTransactions.length, paymentCount: payments.length, expenseCount: expenses.length, loanCount: loans.length, fdCount: fds.length, paymentBankCount: payments.filter(p => p.paymentMode === 'Bank' && p.bankId).length, expenseBankCount: expenses.filter(e => e.paymentMode === 'Bank' && e.bankId).length, loanBankCount: loans.filter(l => l.paymentMode === 'Bank' && l.bankId).length }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H8' }) }).catch(() => { });
            // #endregion

            if (transactionBankIds.length > 0) {
                const fallbackBankObjectIds = transactionBankIds
                    .filter(id => mongoose.Types.ObjectId.isValid(id))
                    .map(id => new mongoose.Types.ObjectId(id));

                if (fallbackBankObjectIds.length > 0) {
                    banks = await BankMaster.find({
                        _id: { $in: fallbackBankObjectIds }
                    }).sort({ createdAt: -1 }).lean();

                    // #region agent log
                    fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'groupController.js:220', message: 'listBanksByGroup - BANKS FOUND VIA FALLBACK', data: { groupId, bankCount: banks.length, bankIds: banks.map(b => b._id?.toString()) }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H8' }) }).catch(() => { });
                    // #endregion
                }
            }
        }

        // Calculate current balance and available balance for each bank
        for (const bank of banks) {
            try {
                const currentBalance = await BankMaster.calculateCurrentBalance(bank._id);
                bank.current_balance = currentBalance;

                // Calculate available balance (current - pending debits + pending credits)
                const balanceInfo = await BankMaster.calculateAvailableBalance(bank._id);
                bank.available_balance = balanceInfo.availableBalance;
                bank.pending_debits = balanceInfo.pendingDebits;
                bank.pending_credits = balanceInfo.pendingCredits;
            } catch (error) {
                console.error(`Error calculating balance for bank ${bank._id}:`, error);
                const fallback = (bank.account_type === "CC" && (bank.cc_limit !== undefined && bank.cc_limit !== null))
                    ? (bank.cc_limit || 0)
                    : (bank.opening_balance || 0);
                bank.current_balance = fallback;
                bank.available_balance = fallback;
                bank.pending_debits = 0;
                bank.pending_credits = 0;
            }
        }

        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'groupController.js:174', message: 'listBanksByGroup - RESPONSE', data: { groupId, bankCount: banks.length, banks: banks.map(b => ({ id: b._id?.toString(), name: b.bank_name, accountNo: b.account_no, current_balance: b.current_balance, available_balance: b.available_balance })) }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H8' }) }).catch(() => { });
        // #endregion

        return apiResponse.success(res, "Banks fetched successfully", banks);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// ------------------------------------------------------------------
// GET: LIST ALL UNIQUE CLUSTERS (name and code)
// ------------------------------------------------------------------
export const listClusters = async (req, res) => {
    try {
        const adminPlace = req.user?.place || req.admin?.place;
        const query = {};
        if (adminPlace) {
            query.place = adminPlace;
        }

        const clusters = await GroupMaster.aggregate([
            { $match: query },
            {
                $group: {
                    _id: {
                        name: "$cluster_name",
                        code: "$cluster_code"
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    cluster_name: "$_id.name",
                    cluster_code: "$_id.code"
                }
            },
            { $sort: { cluster_name: 1 } }
        ]);

        return apiResponse.success(res, "Clusters fetched successfully", clusters);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// ------------------------------------------------------------------
// GET: LIST GROUPS
// ------------------------------------------------------------------
export const listGroups = async (req, res) => {
    try {
        // Get admin's place from token (stored in req.user or req.admin)
        const adminPlace = req.user?.place || req.admin?.place;

        // Build query - filter by place if admin has a place
        const query = {};
        if (adminPlace) {
            query.place = adminPlace;
        }

        const groups = await GroupMaster.find(query)
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

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Verify group access
        const accessCheck = await verifyGroupAccess(id, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
        }

        let group = await GroupMaster.findById(id).populate("bankmaster").populate("bankmasters").lean();

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
        const { village, cluster_name } = req.query; // Optional filters to disambiguate

        if (!group_code) {
            return apiResponse.error(res, "group_code is required", 400);
        }

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Verify group access by code
        const accessCheck = await verifyGroupAccessByCode(group_code, adminPlace, village, cluster_name);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
        }

        let group = await GroupMaster.findById(accessCheck.group._id).populate("bankmaster").populate("bankmasters").lean();

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

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Get bank details
        const bank = await BankMaster.findById(bankId).lean();
        if (!bank) {
            return apiResponse.error(res, "Bank not found", 404);
        }

        // Verify bank's associated group belongs to admin's place
        if (bank.group_id) {
            const accessCheck = await verifyGroupAccess(bank.group_id, adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(res, accessCheck.error || "You don't have access to this bank's group", 403);
            }
        }

        // Calculate current balance and available balance
        try {
            const currentBalance = await BankMaster.calculateCurrentBalance(bankId);
            bank.current_balance = currentBalance;

            // Calculate available balance (current - pending debits + pending credits)
            const balanceInfo = await BankMaster.calculateAvailableBalance(bankId);
            bank.available_balance = balanceInfo.availableBalance;
            bank.pending_debits = balanceInfo.pendingDebits;
            bank.pending_credits = balanceInfo.pendingCredits;
        } catch (error) {
            console.error(`Error calculating balance for bank ${bankId}:`, error);
            const fallback = (bank.account_type === "CC" && (bank.cc_limit !== undefined && bank.cc_limit !== null))
                ? (bank.cc_limit || 0)
                : (bank.opening_balance || 0);
            bank.current_balance = fallback;
            bank.available_balance = fallback;
            bank.pending_debits = 0;
            bank.pending_credits = 0;
        }

        // Get transactions from BankTransaction model for this bank
        const bankTransactions = await BankTransaction.find({
            bankId: bankId
        })
            .sort({ date: -1, createdAt: -1 })
            .lean();

        // Format transactions and categorize as incoming/outgoing
        const transactions = bankTransactions.map(tx => {
            // Determine if transaction is credit (incoming) or debit (outgoing)
            // Credits: recovery (money collected from members), fd (FD created - member gives money to group), cash_to_bank (cash deposited)
            // Debits: loan (money given to members), expense (expense paid), payment (FD maturity/saving withdrawal - group gives money to members)
            const isCredit = tx.transactionType === "recovery" ||
                tx.transactionType === "fd" ||
                tx.transactionType === "cash_to_bank";

            return {
                _id: tx._id,
                id: tx._id.toString(),
                date: tx.date,
                transactionType: tx.transactionType,
                amount: tx.amount,
                description: tx.description,
                onlineRef: tx.onlineRef,
                memberName: tx.memberName || "-",
                memberCode: tx.memberCode || "",
                status: tx.status,
                isCredit: isCredit,
                direction: isCredit ? "incoming" : "outgoing",
                createdAt: tx.createdAt,
                receipt: tx.receipt,
                receiptFileName: tx.receiptFileName
            };
        });

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
// GET: CASH TRANSACTIONS FOR A GROUP
// ------------------------------------------------------------------
export const getCashTransactions = async (req, res) => {
    try {
        const { groupId } = req.params;
        if (!groupId) {
            return apiResponse.error(res, "groupId is required", 400);
        }

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Verify group access
        const accessCheck = await verifyGroupAccess(groupId, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
        }

        const group = await GroupMaster.findById(groupId);

        // Get current cash balance
        await group.recalculateCashBalance();
        const currentCashBalance = group.current_cash_balance || 0;

        // Get all cash transactions for this group
        const cashTransactions = await CashTransaction.find({
            groupId: groupId
        })
            .sort({ date: -1, createdAt: -1 })
            .lean();

        // Format transactions and categorize as incoming/outgoing
        const transactions = cashTransactions.map(tx => {
            // Determine if transaction is credit (incoming) or debit (outgoing)
            // Credits: recovery (money collected from members), fd (FD created - member gives money to group), bank_to_cash (bank converted to cash)
            // Debits: loan (money given to members), expense (expense paid), payment (FD maturity/saving withdrawal - group gives money to members), other (cash to bank)
            const isCredit = tx.transactionType === "recovery" ||
                tx.transactionType === "fd" ||
                tx.transactionType === "bank_to_cash";

            return {
                _id: tx._id,
                id: tx._id.toString(),
                date: tx.date,
                transactionType: tx.transactionType,
                amount: tx.amount,
                description: tx.description,
                memberName: tx.memberName || "-",
                memberCode: tx.memberCode || "",
                status: tx.status,
                isCredit: isCredit,
                direction: isCredit ? "incoming" : "outgoing",
                createdAt: tx.createdAt,
                receipt: tx.receipt,
                receiptFileName: tx.receiptFileName
            };
        });

        return apiResponse.success(res, "Cash transactions fetched successfully", {
            currentCashBalance,
            transactions,
            transactionCount: transactions.length
        });
    } catch (error) {
        console.error("Error fetching cash transactions:", error);
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

        // Validate request body
        const { error } = updateGroupSchema.validate(req.body);
        if (error) {
            return apiResponse.error(res, error.details[0].message, 400);
        }

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Verify group access
        const accessCheck = await verifyGroupAccess(id, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
        }

        const group = await GroupMaster.findById(id);

        // If group_code is being updated, check for duplicates in same village/cluster
        if (req.body.group_code && req.body.group_code !== group.group_code) {
            const village = req.body.village !== undefined ? req.body.village : group.village;
            const cluster_name = req.body.cluster_name !== undefined ? req.body.cluster_name : group.cluster_name;
            const cluster_code = req.body.cluster_code !== undefined ? req.body.cluster_code : group.cluster_code;

            const query = {
                group_code: req.body.group_code,
                _id: { $ne: id }
            };

            if (village) {
                query.village = village;
            } else if (cluster_code) {
                query.cluster_code = cluster_code;
            } else if (cluster_name) {
                query.cluster_name = cluster_name;
            }

            const exists = await GroupMaster.findOne(query);
            if (exists) {
                const location = village || cluster_name || 'this location';
                return apiResponse.error(res, `Group code "${req.body.group_code}" already exists in ${location}`, 400);
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

        // Validate request body
        const { error } = updateBankValidationSchema.validate(req.body);
        if (error) {
            return apiResponse.error(res, error.details[0].message, 400);
        }

        const bank = await BankMaster.findById(bankId);
        if (!bank) {
            return apiResponse.error(res, "Bank not found", 404);
        }

        // If account_no is being updated, check for duplicates
        if (req.body.account_no && req.body.account_no !== bank.account_no) {
            const exists = await BankMaster.findOne({ account_no: req.body.account_no, _id: { $ne: bankId } });
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
        const oldGroupId = bank.group_id?.toString();
        const newGroupId = req.body.group_id?.toString();

        if (newGroupId && newGroupId !== oldGroupId) {
            // Remove from old group if it exists
            if (oldGroupId) {
                const oldGroup = await GroupMaster.findById(oldGroupId);
                if (oldGroup) {
                    // If this bank was the primary bankmaster, unset it
                    const updateQuery = {
                        $pull: { bankmasters: bankId }
                    };
                    if (oldGroup.bankmaster && oldGroup.bankmaster.toString() === bankId) {
                        updateQuery.$unset = { bankmaster: "" };
                    }
                    await GroupMaster.findByIdAndUpdate(oldGroupId, updateQuery);
                }
            }
            // Add to new group
            await GroupMaster.findByIdAndUpdate(
                newGroupId,
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

// Charge Management Endpoints

// Add a new charge to a group
export const addGroupCharge = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { name, amount, type, startDate, frequency, isActive, entryType } = req.body;

        if (!groupId) {
            return apiResponse.error(res, "groupId is required", 400);
        }

        if (!name || !amount || !type || !startDate) {
            return apiResponse.error(res, "name, amount, type, and startDate are required", 400);
        }

        if (type === "recurring" && !frequency) {
            return apiResponse.error(res, "frequency is required for recurring charges", 400);
        }

        if (!["one-time", "recurring"].includes(type)) {
            return apiResponse.error(res, "type must be 'one-time' or 'recurring'", 400);
        }

        if (type === "recurring" && !["yearly", "monthly"].includes(frequency)) {
            return apiResponse.error(res, "frequency must be 'yearly' or 'monthly' for recurring charges", 400);
        }

        // Validate entryType - must be in allowed enum values, default to "expense" if not provided
        const allowedEntryTypes = ["income", "expense", "assets", "liability"];
        const chargeEntryType = entryType || "expense";
        if (!allowedEntryTypes.includes(chargeEntryType)) {
            return apiResponse.error(res, `entryType must be one of: ${allowedEntryTypes.join(", ")}`, 400);
        }

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Verify group access
        const accessCheck = await verifyGroupAccess(groupId, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
        }

        const group = await GroupMaster.findById(groupId);

        const newCharge = {
            name,
            amount: parseFloat(amount),
            type,
            startDate: new Date(startDate),
            frequency: type === "recurring" ? frequency : undefined,
            isActive: isActive !== undefined ? isActive : true,
            entryType: chargeEntryType,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        if (!group.charges) {
            group.charges = [];
        }

        group.charges.push(newCharge);
        await group.save();

        return apiResponse.success(res, "Charge added successfully", group.charges[group.charges.length - 1]);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Update a charge in a group
export const updateGroupCharge = async (req, res) => {
    try {
        const { groupId, chargeId } = req.params;
        const { name, amount, type, startDate, frequency, isActive, entryType } = req.body;

        if (!groupId || !chargeId) {
            return apiResponse.error(res, "groupId and chargeId are required", 400);
        }

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Verify group access
        const accessCheck = await verifyGroupAccess(groupId, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
        }

        const group = await GroupMaster.findById(groupId);

        if (!group.charges || group.charges.length === 0) {
            return apiResponse.error(res, "No charges found for this group", 404);
        }

        const chargeIndex = group.charges.findIndex(c => c._id.toString() === chargeId);
        if (chargeIndex === -1) {
            return apiResponse.error(res, "Charge not found", 404);
        }

        const charge = group.charges[chargeIndex];

        // Update fields if provided
        if (name !== undefined) charge.name = name;
        if (amount !== undefined) charge.amount = parseFloat(amount);
        if (type !== undefined) {
            if (!["one-time", "recurring"].includes(type)) {
                return apiResponse.error(res, "type must be 'one-time' or 'recurring'", 400);
            }
            charge.type = type;
        }
        if (startDate !== undefined) charge.startDate = new Date(startDate);
        if (frequency !== undefined) {
            if (charge.type === "recurring" && !["yearly", "monthly"].includes(frequency)) {
                return apiResponse.error(res, "frequency must be 'yearly' or 'monthly' for recurring charges", 400);
            }
            charge.frequency = charge.type === "recurring" ? frequency : undefined;
        }
        if (isActive !== undefined) charge.isActive = isActive;

        // Validate and update entryType if provided
        if (entryType !== undefined) {
            const allowedEntryTypes = ["income", "expense", "assets", "liability"];
            if (!allowedEntryTypes.includes(entryType)) {
                return apiResponse.error(res, `entryType must be one of: ${allowedEntryTypes.join(", ")}`, 400);
            }
            charge.entryType = entryType;
        }

        charge.updatedAt = new Date();

        await group.save();

        return apiResponse.success(res, "Charge updated successfully", charge);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Delete a charge from a group
export const deleteGroupCharge = async (req, res) => {
    try {
        const { groupId, chargeId } = req.params;

        if (!groupId || !chargeId) {
            return apiResponse.error(res, "groupId and chargeId are required", 400);
        }

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Verify group access
        const accessCheck = await verifyGroupAccess(groupId, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
        }

        const group = await GroupMaster.findById(groupId);

        if (!group.charges || group.charges.length === 0) {
            return apiResponse.error(res, "No charges found for this group", 404);
        }

        const chargeIndex = group.charges.findIndex(c => c._id.toString() === chargeId);
        if (chargeIndex === -1) {
            return apiResponse.error(res, "Charge not found", 404);
        }

        group.charges.splice(chargeIndex, 1);
        await group.save();

        return apiResponse.success(res, "Charge deleted successfully", { chargeId });
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Get all charges for a group
export const getGroupCharges = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { entryType } = req.query;

        if (!groupId) {
            return apiResponse.error(res, "groupId is required", 400);
        }

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Verify group access
        const accessCheck = await verifyGroupAccess(groupId, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
        }

        const group = await GroupMaster.findById(groupId).select("charges");

        let charges = group.charges || [];

        // Filter by entryType if provided
        if (entryType) {
            charges = charges.filter(charge => charge.entryType === entryType);
        }

        return apiResponse.success(res, "Charges fetched successfully", charges);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};