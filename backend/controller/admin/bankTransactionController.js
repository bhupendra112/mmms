import apiResponse from "../../utility/apiResponse.js";
import BankTransaction from "../../model/BankTransaction.js";
import BankMaster from "../../model/BankMaster.js";
import { GroupMaster } from "../../model/index.js";
import { verifyGroupAccess } from "../../utility/groupAccessHelper.js";

// Create bank transaction receipt
export const createBankTransaction = async (req, res) => {
    try {
        const payload = req.body || {};

        // Validate required fields
        if (!payload.bankId || !payload.groupId || !payload.transactionType || !payload.amount) {
            return apiResponse.error(res, "bankId, groupId, transactionType, and amount are required", 400);
        }

        // Verify bank exists
        const bank = await BankMaster.findById(payload.bankId);
        if (!bank) {
            return apiResponse.error(res, "Bank not found", 404);
        }

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;
        
        // Verify group exists and belongs to admin's place
        const accessCheck = await verifyGroupAccess(payload.groupId, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
        }
        const group = accessCheck.group;

        // Parse date
        let transactionDate = payload.date ? new Date(payload.date) : new Date();
        if (typeof payload.date === 'string' && payload.date.includes('/')) {
            const parts = payload.date.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const year = parseInt(parts[2], 10);
                transactionDate = new Date(year, month, day);
            }
        }

        // Create bank transaction
        const bankTransaction = await BankTransaction.create({
            bankId: payload.bankId,
            bankName: bank.bank_name,
            accountNo: bank.account_no,
            groupId: payload.groupId,
            groupName: group.group_name,
            groupCode: group.group_code,
            transactionType: payload.transactionType,
            amount: parseFloat(payload.amount),
            date: transactionDate,
            onlineRef: payload.onlineRef || null,
            description: payload.description || null,
            receipt: payload.receipt || null,
            receiptFileName: payload.receiptFileName || null,
            fdId: payload.fdId || null,
            recoveryId: payload.recoveryId || null,
            recoveryMemberId: payload.recoveryMemberId || null,
            loanId: payload.loanId || null,
            expenseId: payload.expenseId || null,
            paymentId: payload.paymentId || null,
            cashToBankId: payload.cashToBankId || null,
            memberId: payload.memberId || null,
            memberCode: payload.memberCode || null,
            memberName: payload.memberName || null,
            status: payload.status || "pending",
            createdBy: req.user?.id || "admin",
        });

        // Update bank balance if transaction is verified
        if (bankTransaction.status === "verified") {
            await bank.recalculateBalance();
        }

        return apiResponse.success(res, "Bank transaction receipt created successfully", bankTransaction);

    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Get all bank transactions with filters
export const getBankTransactions = async (req, res) => {
    try {
        const { bankId, groupId, transactionType, status, fromDate, toDate, memberId } = req.query;

        const filter = {};
        if (bankId) filter.bankId = bankId;
        if (groupId) filter.groupId = groupId;
        if (transactionType) filter.transactionType = transactionType;
        if (status) filter.status = status;
        if (memberId) filter.memberId = memberId;

        // Date range filter
        if (fromDate || toDate) {
            filter.date = {};
            if (fromDate) {
                const startDate = new Date(fromDate);
                startDate.setHours(0, 0, 0, 0);
                filter.date.$gte = startDate;
            }
            if (toDate) {
                const endDate = new Date(toDate);
                endDate.setHours(23, 59, 59, 999);
                filter.date.$lte = endDate;
            }
        }

        const transactions = await BankTransaction.find(filter)
            .populate("bankId", "bank_name account_no short_name")
            .populate("groupId", "group_name group_code")
            .populate("memberId", "Member_Id Member_Nm")
            .populate("fdId", "amount date")
            .populate("recoveryId", "date memberCount")
            .populate("loanId", "amount date")
            .populate("expenseId", "amount expenseType")
            .populate("paymentId", "amount paymentType")
            .sort({ date: -1, createdAt: -1 })
            .lean();

        return apiResponse.success(res, "Bank transactions fetched successfully", transactions);

    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Get bank transaction by ID
export const getBankTransactionById = async (req, res) => {
    try {
        const { id } = req.params;

        const transaction = await BankTransaction.findById(id)
            .populate("bankId")
            .populate("groupId")
            .populate("memberId")
            .populate("fdId")
            .populate("recoveryId")
            .populate("loanId")
            .populate("expenseId")
            .populate("paymentId")
            .populate("cashToBankId")
            .lean();

        if (!transaction) {
            return apiResponse.error(res, "Bank transaction not found", 404);
        }

        return apiResponse.success(res, "Bank transaction fetched successfully", transaction);

    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Update bank transaction
export const updateBankTransaction = async (req, res) => {
    try {
        const { id } = req.params;
        const payload = req.body || {};

        const transaction = await BankTransaction.findById(id);
        if (!transaction) {
            return apiResponse.error(res, "Bank transaction not found", 404);
        }

        // Track if amount or status changed (affects balance calculation)
        const previousAmount = transaction.amount;
        const previousStatus = transaction.status;
        let amountChanged = false;
        let statusChanged = false;

        // Update allowed fields
        if (payload.receipt !== undefined) transaction.receipt = payload.receipt;
        if (payload.receiptFileName !== undefined) transaction.receiptFileName = payload.receiptFileName;
        if (payload.onlineRef !== undefined) transaction.onlineRef = payload.onlineRef;
        if (payload.description !== undefined) transaction.description = payload.description;
        if (payload.amount !== undefined) {
            transaction.amount = parseFloat(payload.amount);
            amountChanged = (previousAmount !== transaction.amount);
        }
        if (payload.date !== undefined) {
            let transactionDate = new Date(payload.date);
            if (typeof payload.date === 'string' && payload.date.includes('/')) {
                const parts = payload.date.split('/');
                if (parts.length === 3) {
                    const day = parseInt(parts[0], 10);
                    const month = parseInt(parts[1], 10) - 1;
                    const year = parseInt(parts[2], 10);
                    transactionDate = new Date(year, month, day);
                }
            }
            transaction.date = transactionDate;
        }
        if (payload.status !== undefined) {
            transaction.status = payload.status;
            statusChanged = (previousStatus !== transaction.status);
        }

        await transaction.save();

        // Recalculate bank balance if amount or status changed (and transaction is/was verified)
        if ((amountChanged || statusChanged) && (transaction.status === "verified" || previousStatus === "verified")) {
            const bank = await BankMaster.findById(transaction.bankId);
            if (bank) {
                await bank.recalculateBalance();
            }
        }

        return apiResponse.success(res, "Bank transaction updated successfully", transaction);

    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Verify bank transaction
export const verifyBankTransaction = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rejectionReason } = req.body;

        if (!status || !["verified", "rejected"].includes(status)) {
            return apiResponse.error(res, "Valid status is required (verified or rejected)", 400);
        }

        const transaction = await BankTransaction.findById(id);
        if (!transaction) {
            return apiResponse.error(res, "Bank transaction not found", 404);
        }

        const previousStatus = transaction.status;
        transaction.status = status;
        if (status === "verified") {
            transaction.verifiedBy = req.user?.id || "admin";
            transaction.verifiedAt = new Date();
            transaction.rejectedBy = null;
            transaction.rejectedAt = null;
            transaction.rejectionReason = null;
        } else if (status === "rejected") {
            transaction.rejectedBy = req.user?.id || "admin";
            transaction.rejectedAt = new Date();
            transaction.rejectionReason = rejectionReason || null;
            transaction.verifiedBy = null;
            transaction.verifiedAt = null;
        }

        await transaction.save();

        // Recalculate bank balance when status changes
        // If status changed to/from verified, recalculate balance
        if (previousStatus !== status && (status === "verified" || previousStatus === "verified")) {
            const bank = await BankMaster.findById(transaction.bankId);
            if (bank) {
                await bank.recalculateBalance();
            }
        }

        return apiResponse.success(res, `Bank transaction ${status} successfully`, transaction);

    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Delete bank transaction
export const deleteBankTransaction = async (req, res) => {
    try {
        const { id } = req.params;

        const transaction = await BankTransaction.findById(id);
        if (!transaction) {
            return apiResponse.error(res, "Bank transaction not found", 404);
        }

        const bankId = transaction.bankId;
        const wasVerified = transaction.status === "verified";

        await BankTransaction.findByIdAndDelete(id);

        // Recalculate bank balance if deleted transaction was verified
        if (wasVerified) {
            const bank = await BankMaster.findById(bankId);
            if (bank) {
                await bank.recalculateBalance();
            }
        }

        return apiResponse.success(res, "Bank transaction deleted successfully", null);

    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Get bank transactions by bank
export const getBankTransactionsByBank = async (req, res) => {
    try {
        const { bankId } = req.params;
        const { fromDate, toDate } = req.query;

        const filter = { bankId };

        if (fromDate || toDate) {
            filter.date = {};
            if (fromDate) {
                const startDate = new Date(fromDate);
                startDate.setHours(0, 0, 0, 0);
                filter.date.$gte = startDate;
            }
            if (toDate) {
                const endDate = new Date(toDate);
                endDate.setHours(23, 59, 59, 999);
                filter.date.$lte = endDate;
            }
        }

        const transactions = await BankTransaction.find(filter)
            .populate("groupId", "group_name group_code")
            .populate("memberId", "Member_Id Member_Nm")
            .sort({ date: -1 })
            .lean();

        return apiResponse.success(res, "Bank transactions fetched successfully", transactions);

    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Get bank transactions by group
export const getBankTransactionsByGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { fromDate, toDate, transactionType } = req.query;

        const filter = { groupId };
        if (transactionType) filter.transactionType = transactionType;

        if (fromDate || toDate) {
            filter.date = {};
            if (fromDate) {
                const startDate = new Date(fromDate);
                startDate.setHours(0, 0, 0, 0);
                filter.date.$gte = startDate;
            }
            if (toDate) {
                const endDate = new Date(toDate);
                endDate.setHours(23, 59, 59, 999);
                filter.date.$lte = endDate;
            }
        }

        const transactions = await BankTransaction.find(filter)
            .populate("bankId", "bank_name account_no short_name")
            .populate("memberId", "Member_Id Member_Nm")
            .sort({ date: -1 })
            .lean();

        return apiResponse.success(res, "Bank transactions fetched successfully", transactions);

    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

