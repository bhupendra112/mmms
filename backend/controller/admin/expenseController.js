import apiResponse from "../../utility/apiResponse.js";
import message from "../../utility/message.js";
import ExpenseMaster from "../../model/ExpenseMaster.js";
import LoanMaster from "../../model/LoanMaster.js";
import { GroupMaster, BankMaster } from "../../model/index.js";
import { createBankTransactionRecord } from "../../utility/bankTransactionHelper.js";
import { createCashTransactionRecord } from "../../utility/cashTransactionHelper.js";
import { verifyGroupAccess, verifyGroupAccessByCode, verifyGroupAccessByName, getAdminPlace } from "../../utility/groupAccessHelper.js";
import { postTransaction } from "../../service/ledgerPostingService.js";
import { findOrCreateHead, findOrCreateExpenseHead } from "../../utility/headMappingHelper.js";

export const createExpense = async (req, res) => {
    try {
        const payload = req.body || {};

        // Ensure place is populated for group tokens (from DB if not in token)
        const adminPlace = await getAdminPlace(req);

        const isGroupToken = req.user?.type === "group" || req.admin?.type === "group";
        const tokenGroupId = req.user?.id || req.admin?.id;

        let groupId = null;

        // Group panel: allow group token to create expense for their own group without requiring place
        if (isGroupToken && payload.groupId && tokenGroupId && String(payload.groupId) === String(tokenGroupId)) {
            const group = await GroupMaster.findById(payload.groupId).lean();
            if (!group) {
                return apiResponse.error(res, "Group not found", 404);
            }
            groupId = group._id;
        }

        if (!groupId && payload.groupId) {
            const accessCheck = await verifyGroupAccess(payload.groupId, adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
            }
            groupId = accessCheck.group._id;
        } else if (!groupId && payload.groupCode) {
            const accessCheck = await verifyGroupAccessByCode(payload.groupCode, adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
            }
            groupId = accessCheck.group._id;
        } else if (!groupId && payload.groupName) {
            const accessCheck = await verifyGroupAccessByName(payload.groupName, adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
            }
            groupId = accessCheck.group._id;
        }

        if (!groupId) {
            return apiResponse.error(res, "Valid groupId/groupCode/groupName is required", 400);
        }

        // Fetch group as Mongoose document instance (not lean) to use instance methods
        const groupDoc = await GroupMaster.findById(groupId);
        if (!groupDoc) {
            return apiResponse.error(res, "Group not found", 404);
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

        // Validate amount
        const expenseAmount = parseFloat(payload.amount || 0);
        if (!expenseAmount || expenseAmount <= 0) {
            return apiResponse.error(res, "Valid amount (> 0) is required", 400);
        }

        // Check if approval is required (from group panel) - used to skip balance check and defer transactions
        const requireApproval = payload.requireApproval === true || payload.source === 'group_sync';

        // Validate balance only for immediate (admin) creates; group_sync expenses are validated on approval
        if (!requireApproval) {
            if (payload.paymentMode === "Cash") {
                await groupDoc.recalculateCashBalance();
                const cashBalance = groupDoc.current_cash_balance || 0;
                if (cashBalance < expenseAmount) {
                    return apiResponse.error(res, `Insufficient cash balance. Available: ₹${cashBalance.toFixed(2)}, Required: ₹${expenseAmount.toFixed(2)}`, 400);
                }
            } else if (payload.paymentMode === "Bank" && payload.bankId) {
                const bank = await BankMaster.findById(payload.bankId);
                if (!bank) {
                    return apiResponse.error(res, "Bank account not found", 404);
                }
                const balanceInfo = await BankMaster.calculateAvailableBalance(payload.bankId);
                const availableBalance = balanceInfo.availableBalance || 0;
                if (availableBalance < expenseAmount) {
                    return apiResponse.error(res, `Insufficient bank balance. Available: ₹${availableBalance.toFixed(2)}, Required: ₹${expenseAmount.toFixed(2)}`, 400);
                }
            }
        }

        // Validate expenseType - must be provided and non-empty
        if (!payload.expenseType || typeof payload.expenseType !== 'string' || payload.expenseType.trim() === '') {
            return apiResponse.error(res, "Expense type is required", 400);
        }

        // Validate entryType - must be in allowed enum values, default to "expense" if not provided
        const allowedEntryTypes = ["income", "expense", "assets", "liability"];
        const entryType = payload.entryType || "expense";
        if (!allowedEntryTypes.includes(entryType)) {
            return apiResponse.error(res, `entryType must be one of: ${allowedEntryTypes.join(", ")}`, 400);
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

        const approvalStatus = requireApproval ? 'pending' : 'approved';

        // Create expense
        const expense = await ExpenseMaster.create({
            ...payload,
            date: dateValue,
            groupId: groupDoc._id,
            groupName: payload.groupName || groupDoc.group_name,
            groupCode: payload.groupCode || groupDoc.group_code,
            entryType: entryType,
            approvalStatus: approvalStatus,
            createdBy: req.user?.id || "admin",
        });

        // Only process transactions if approved (admin panel)
        // For pending approvals (group panel), these will be processed on approval
        if (approvalStatus === 'approved') {
            // Create bank transaction record if payment mode is Bank
            // NOTE: Expense is a DEBIT transaction - group pays money, so bank balance decreases
            if (payload.paymentMode === "Bank" && payload.bankId) {
                const bankTxResult = await createBankTransactionRecord({
                    bankId: payload.bankId,
                    groupId: groupDoc._id,
                    transactionType: "expense",
                    amount: payload.amount || 0,
                    date: dateValue,
                    description: `Expense - ${payload.expenseType}: ${payload.purpose || ""}`,
                    expenseId: expense._id,
                    createdBy: req.user?.id || "admin",
                });
            }

            // Create cash transaction record if payment mode is Cash
            // NOTE: Expense is a DEBIT transaction - group pays money, so cash balance decreases
            if (payload.paymentMode === "Cash") {
                const cashTxResult = await createCashTransactionRecord({
                    groupId: groupDoc._id,
                    transactionType: "expense",
                    amount: payload.amount || 0,
                    date: dateValue,
                    description: `Expense - ${payload.expenseType}: ${payload.purpose || ""}`,
                    expenseId: expense._id,
                    createdBy: req.user?.id || "admin",
                });
            }

            // Post ledger entry for expense
            // Determine direction based on entryType: income entries are "in", others are "out"
            const direction = entryType === "income" ? "in" : "out";

            // Use expenseType as headName, or find/create head
            const headInfo = await findOrCreateExpenseHead(groupDoc._id, payload.expenseType, entryType);

            await postTransaction({
                sourceDoc: expense,
                headName: payload.expenseType,
                headType: headInfo?.headType || "expenseMaster",
                headId: headInfo?.headId || expense._id, // Use expense._id as headId if not found
                section: entryType,
                amount: expenseAmount,
                direction: direction,
                groupId: groupDoc._id,
                memberId: undefined, // Expenses are group-level, not member-specific
                date: dateValue,
                notes: `Expense - ${payload.expenseType}: ${payload.purpose || ""}`,
                paymentMode: payload.paymentMode || "Cash",
                bankId: payload.bankId || undefined,
                referenceModel: "ExpenseMaster",
                referenceId: expense._id,
                createdBy: req.user?.id || "admin",
            });
        }
        // For pending expenses, skip processing - it will be done on approval

        const message = approvalStatus === 'pending' 
            ? "Expense created successfully and pending admin approval" 
            : "Expense created successfully";
        return apiResponse.success(res, message, expense);

    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

export const listExpenses = async (req, res) => {
    try {
        const { groupId, groupCode, fromDate, toDate, expenseType, entryType } = req.query;

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        const filter = {};
        if (groupId) {
            // Verify group access
            const accessCheck = await verifyGroupAccess(groupId, adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
            }
            filter.groupId = groupId;
        } else if (groupCode) {
            // Verify group access by code
            const accessCheck = await verifyGroupAccessByCode(groupCode, adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
            }
            filter.groupId = accessCheck.group._id;
        } else {
            // If no group specified, filter by all groups in admin's place
            const groups = await GroupMaster.find({ place: adminPlace }).select("_id").lean();
            const groupIds = groups.map(g => g._id);
            filter.groupId = { $in: groupIds };
        }
        if (expenseType) filter.expenseType = expenseType;
        if (entryType) filter.entryType = entryType;

        // Date range filter
        const dateFilter = {};
        if (fromDate || toDate) {
            if (fromDate) {
                const from = new Date(fromDate);
                from.setHours(0, 0, 0, 0);
                dateFilter.$gte = from;
            }
            if (toDate) {
                const to = new Date(toDate);
                to.setHours(23, 59, 59, 999);
                dateFilter.$lte = to;
            }
        }

        // Fetch expenses from ExpenseMaster (Stationery, Travel)
        const expenseFilter = { ...filter };
        if (Object.keys(dateFilter).length > 0) {
            expenseFilter.date = dateFilter;
        }
        const expensesFromMaster = await ExpenseMaster.find(expenseFilter)
            .populate("groupId", "group_name group_code village")
            .populate("bankId", "bank_name account_no")
            .sort({ date: -1, createdAt: -1 })
            .lean();

        // Fetch group expenses from LoanMaster (transactionType="Expense", isGroupLoan=true)
        const loanExpenseFilter = {
            transactionType: "Expense",
            isGroupLoan: true,
        };
        if (filter.groupId) {
            loanExpenseFilter.groupId = filter.groupId;
        }
        if (Object.keys(dateFilter).length > 0) {
            loanExpenseFilter.date = dateFilter;
        }
        const expensesFromLoans = await LoanMaster.find(loanExpenseFilter)
            .populate("groupId", "group_name group_code village")
            .populate("bankId", "bank_name account_no")
            .sort({ date: -1, createdAt: -1 })
            .lean();

        // Transform loan expenses to match expense format
        const transformedLoanExpenses = expensesFromLoans.map((loan) => ({
            _id: loan._id,
            id: loan._id,
            groupId: loan.groupId,
            groupName: loan.groupName,
            groupCode: loan.groupCode,
            expenseType: "Other", // Group expenses from LoanMaster are "Other" type
            amount: loan.amount,
            date: loan.date,
            paymentMode: loan.paymentMode,
            bankId: loan.bankId,
            purpose: loan.purpose,
            createdBy: loan.createdBy,
            createdAt: loan.createdAt,
            updatedAt: loan.updatedAt,
            // Mark as from LoanMaster for identification
            _fromLoanMaster: true,
        }));

        // Combine both types of expenses
        const allExpenses = [...expensesFromMaster, ...transformedLoanExpenses];

        // Sort combined list by date (newest first)
        allExpenses.sort((a, b) => {
            const dateA = new Date(a.date || a.createdAt);
            const dateB = new Date(b.date || b.createdAt);
            return dateB - dateA;
        });

        return apiResponse.success(res, "Expenses fetched successfully", allExpenses);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

export const getExpenseDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const expense = await ExpenseMaster.findById(id)
            .populate("groupId", "group_name group_code village")
            .populate("bankId", "bank_name account_no")
            .lean();

        if (!expense) {
            return apiResponse.error(res, "Expense not found", 404);
        }

        return apiResponse.success(res, "Expense detail fetched successfully", expense);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

export const updateExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const payload = req.body || {};

        const expense = await ExpenseMaster.findById(id);
        if (!expense) {
            return apiResponse.error(res, "Expense not found", 404);
        }

        // Verify group exists if groupId is being updated
        if (payload.groupId) {
            const groupDoc = await GroupMaster.findById(payload.groupId);
            if (!groupDoc) {
                return apiResponse.error(res, "Invalid groupId", 400);
            }
        }

        // Validate bankId if paymentMode is "Bank"
        const paymentMode = payload.paymentMode || expense.paymentMode;
        if (paymentMode === "Bank") {
            const bankId = payload.bankId || expense.bankId;
            if (!bankId) {
                return apiResponse.error(res, "bankId is required when payment mode is Bank", 400);
            }
            const bankDoc = await BankMaster.findById(bankId);
            if (!bankDoc) {
                return apiResponse.error(res, "Invalid bankId. Bank not found", 400);
            }
        }

        // Validate amount if provided
        if (payload.amount !== undefined && payload.amount < 0) {
            return apiResponse.error(res, "Amount must be >= 0", 400);
        }

        // Validate expenseType if provided - must be non-empty string
        if (payload.expenseType !== undefined) {
            if (typeof payload.expenseType !== 'string' || payload.expenseType.trim() === '') {
                return apiResponse.error(res, "Expense type must be a non-empty string", 400);
            }
        }

        // Validate entryType if provided - must be in allowed enum values
        if (payload.entryType !== undefined) {
            const allowedEntryTypes = ["income", "expense", "assets", "liability"];
            if (!allowedEntryTypes.includes(payload.entryType)) {
                return apiResponse.error(res, `entryType must be one of: ${allowedEntryTypes.join(", ")}`, 400);
            }
        }

        // Convert date string to Date object if needed
        if (payload.date && typeof payload.date === 'string') {
            const ddmmyyyyPattern = /^(\d{2})\/(\d{2})\/(\d{4})$/;
            const match = payload.date.match(ddmmyyyyPattern);

            if (match) {
                const day = parseInt(match[1], 10);
                const month = parseInt(match[2], 10) - 1;
                const year = parseInt(match[3], 10);
                payload.date = new Date(year, month, day);
            } else {
                payload.date = new Date(payload.date);
            }

            if (isNaN(payload.date.getTime())) {
                return apiResponse.error(res, `Invalid date format: ${payload.date}`, 400);
            }
        }

        // Update expense
        const updatedExpense = await ExpenseMaster.findByIdAndUpdate(
            id,
            { ...payload },
            { new: true, runValidators: true }
        )
            .populate("groupId", "group_name group_code village")
            .populate("bankId", "bank_name account_no")
            .lean();

        return apiResponse.success(res, "Expense updated successfully", updatedExpense);

    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

export const deleteExpense = async (req, res) => {
    try {
        const { id } = req.params;

        const expense = await ExpenseMaster.findById(id);
        if (!expense) {
            return apiResponse.error(res, "Expense not found", 404);
        }

        await ExpenseMaster.findByIdAndDelete(id);

        return apiResponse.success(res, "Expense deleted successfully", null);

    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Approve Expense (from group panel)
export const approveExpense = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return apiResponse.error(res, "Expense ID is required", 400);
        }

        const expense = await ExpenseMaster.findById(id);
        if (!expense) {
            return apiResponse.error(res, "Expense not found", 404);
        }

        if (expense.approvalStatus !== "pending") {
            return apiResponse.error(res, `Expense is already ${expense.approvalStatus}`, 400);
        }

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Verify expense's group belongs to admin's place
        const accessCheck = await verifyGroupAccess(expense.groupId, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "You don't have access to this expense's group", 403);
        }
        const groupDoc = accessCheck.group;

        // Update expense approval status
        expense.approvalStatus = "approved";
        expense.approvedBy = req.user?.id || "admin";
        expense.approvedAt = new Date();
        await expense.save();

        // Process all transactions (bank, cash, ledger entries)
        const expenseAmount = expense.amount || 0;
        const dateValue = expense.date;

        // Create bank transaction record if payment mode is Bank
        if (expense.paymentMode === "Bank" && expense.bankId) {
            await createBankTransactionRecord({
                bankId: expense.bankId,
                groupId: groupDoc._id,
                transactionType: "expense",
                amount: expenseAmount,
                date: dateValue,
                description: `Expense - ${expense.expenseType}: ${expense.purpose || ""}`,
                expenseId: expense._id,
                createdBy: req.user?.id || "admin",
            });
        }

        // Create cash transaction record if payment mode is Cash
        if (expense.paymentMode === "Cash") {
            await createCashTransactionRecord({
                groupId: groupDoc._id,
                transactionType: "expense",
                amount: expenseAmount,
                date: dateValue,
                description: `Expense - ${expense.expenseType}: ${expense.purpose || ""}`,
                expenseId: expense._id,
                createdBy: req.user?.id || "admin",
            });
        }

        // Post ledger entry for expense
        const direction = expense.entryType === "income" ? "in" : "out";
        const headInfo = await findOrCreateExpenseHead(groupDoc._id, expense.expenseType, expense.entryType);

        await postTransaction({
            sourceDoc: expense,
            headName: expense.expenseType,
            headType: headInfo?.headType || "expenseMaster",
            headId: headInfo?.headId || expense._id,
            section: expense.entryType,
            amount: expenseAmount,
            direction: direction,
            groupId: groupDoc._id,
            memberId: undefined,
            date: dateValue,
            notes: `Expense - ${expense.expenseType}: ${expense.purpose || ""}`,
            paymentMode: expense.paymentMode || "Cash",
            bankId: expense.bankId || undefined,
            referenceModel: "ExpenseMaster",
            referenceId: expense._id,
            createdBy: req.user?.id || "admin",
        });

        return apiResponse.success(res, "Expense approved successfully", expense);
    } catch (error) {
        return apiResponse.error(res, error.message || "Failed to approve expense", 500);
    }
};

// Reject Expense (from group panel)
export const rejectExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!id) {
            return apiResponse.error(res, "Expense ID is required", 400);
        }

        const expense = await ExpenseMaster.findById(id);
        if (!expense) {
            return apiResponse.error(res, "Expense not found", 404);
        }

        if (expense.approvalStatus !== "pending") {
            return apiResponse.error(res, `Expense is already ${expense.approvalStatus}`, 400);
        }

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Verify expense's group belongs to admin's place
        const accessCheck = await verifyGroupAccess(expense.groupId, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "You don't have access to this expense's group", 403);
        }

        expense.approvalStatus = "rejected";
        expense.rejectedBy = req.user?.id || "admin";
        expense.rejectedAt = new Date();
        expense.rejectionReason = reason || "No reason provided";
        await expense.save();

        return apiResponse.success(res, "Expense rejected successfully", expense);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};


