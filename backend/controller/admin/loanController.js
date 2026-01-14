import apiResponse from "../../utility/apiResponse.js";
import message from "../../utility/message.js";
import LoanMaster from "../../model/LoanMaster.js";
import { GroupMaster, BankMaster } from "../../model/index.js";
import { createBankTransactionRecord } from "../../utility/bankTransactionHelper.js";
import { createCashTransactionRecord } from "../../utility/cashTransactionHelper.js";
import { verifyGroupAccess, verifyGroupAccessByCode, verifyGroupAccessByName } from "../../utility/groupAccessHelper.js";

export const registerLoan = async (req, res) => {
    try {
        const payload = req.body || {};

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;
        
        // Verify group exists and belongs to admin's place
        let groupDoc = null;
        if (payload.groupId) {
            const accessCheck = await verifyGroupAccess(payload.groupId, adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
            }
            groupDoc = accessCheck.group;
        } else if (payload.groupCode) {
            const accessCheck = await verifyGroupAccessByCode(payload.groupCode, adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
            }
            groupDoc = accessCheck.group;
        } else if (payload.groupName) {
            const accessCheck = await verifyGroupAccessByName(payload.groupName, adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
            }
            groupDoc = accessCheck.group;
        }

        if (!groupDoc) {
            return apiResponse.error(res, "Valid groupId/groupCode/groupName is required", 400);
        }

        // Validate loan amount
        const loanAmount = parseFloat(payload.amount || 0);
        if (!loanAmount || loanAmount <= 0) {
            return apiResponse.error(res, "Loan amount must be greater than 0", 400);
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
            
            // Check bank balance
            const balanceInfo = await BankMaster.calculateAvailableBalance(payload.bankId);
            const availableBalance = balanceInfo.availableBalance || 0;
            if (availableBalance < loanAmount) {
                return apiResponse.error(res, `Insufficient bank balance. Available: ₹${availableBalance.toFixed(2)}, Required: ₹${loanAmount.toFixed(2)}`, 400);
            }
        } else if (payload.paymentMode === "Cash") {
            // Check cash balance
            // Recalculate to get current cash balance
            // Refetch as Mongoose document (not lean) to access instance methods
            const groupDocInstance = await GroupMaster.findById(groupDoc._id);
            if (!groupDocInstance) {
                return apiResponse.error(res, "Group not found", 404);
            }
            await groupDocInstance.recalculateCashBalance();
            const cashBalance = groupDocInstance.current_cash_balance || 0;
            if (cashBalance < loanAmount) {
                return apiResponse.error(res, `Insufficient cash balance. Available: ₹${cashBalance.toFixed(2)}, Required: ₹${loanAmount.toFixed(2)}`, 400);
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

        // Convert time_period from years to months if provided
        const loanPayload = { ...payload };
        if (loanPayload.time_period !== undefined && loanPayload.time_period !== null) {
            const timePeriodYears = parseFloat(loanPayload.time_period);
            if (timePeriodYears > 0) {
                loanPayload.time_period = Math.round(timePeriodYears * 12); // Convert years to months
            }
        }

        // Calculate installment_amount if time_period and amount are provided
        if (loanPayload.time_period && loanPayload.amount) {
            const months = loanPayload.time_period;
            const amount = parseFloat(loanPayload.amount);
            if (months > 0 && amount > 0) {
                loanPayload.installment_amount = amount / months;
            }
        }

        // Calculate Yogdan (1% of loan amount) for member loans only
        let yogdanAmount = 0;
        if (loanPayload.transactionType === "Loan" && loanPayload.memberId && loanPayload.amount) {
            const loanAmount = parseFloat(loanPayload.amount);
            yogdanAmount = Math.round((loanAmount * 0.01) * 100) / 100; // 1% of loan amount, rounded to 2 decimals
        }

        // Determine status based on user type
        // Check if the user is a group (type === "group") or an admin
        // Group loans must go through approval workflow (pending status)
        // Admin loans are immediately approved
        const isAdmin = req.admin?.type !== "group";
        const loanStatus = isAdmin ? "approved" : "pending";

        // Create loan transaction
        const loan = await LoanMaster.create({
            ...loanPayload,
            date: dateValue,
            groupId: groupDoc._id,
            groupName: payload.groupName || groupDoc.group_name,
            groupCode: payload.groupCode || groupDoc.group_code,
            loan_rate_snapshot: groupDoc.loan_rate || null, // Store rate snapshot
            yogdanAmount: yogdanAmount, // Store 1% Yogdan amount
            status: loanStatus,
            createdBy: req.user?.id || "admin",
        });

        // Only create transaction records and update balances if admin (loan is approved)
        // For group loans, transactions will be created when admin approves
        if (isAdmin) {
            // Create bank transaction record if payment mode is Bank
            if (payload.paymentMode === "Bank" && payload.bankId) {
                await createBankTransactionRecord({
                    bankId: payload.bankId,
                    groupId: groupDoc._id,
                    transactionType: "loan",
                    amount: payload.amount || 0,
                    date: dateValue,
                    description: `Loan ${payload.transactionType} - ${payload.purpose || ""}`,
                    loanId: loan._id,
                    memberId: payload.memberId || null,
                    memberCode: payload.memberCode || null,
                    memberName: payload.memberName || null,
                    createdBy: req.user?.id || "admin",
                });
            }

            // Create cash transaction record if payment mode is Cash
            if (payload.paymentMode === "Cash") {
                await createCashTransactionRecord({
                    groupId: groupDoc._id,
                    transactionType: "loan",
                    amount: payload.amount || 0,
                    date: dateValue,
                    description: `Loan ${payload.transactionType} - ${payload.purpose || ""}`,
                    loanId: loan._id,
                    memberId: payload.memberId || null,
                    memberCode: payload.memberCode || null,
                    memberName: payload.memberName || null,
                    createdBy: req.user?.id || "admin",
                });
            }
        }

        const successMessage = isAdmin 
            ? "Loan transaction registered successfully" 
            : "Loan request created successfully! Waiting for admin approval.";
        
        return apiResponse.success(res, successMessage, loan);

    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

export const listLoans = async (req, res) => {
    try {
        const { groupId, groupCode, status, transactionType } = req.query;

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

// Approve loan
export const approveLoan = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return apiResponse.error(res, "Loan ID is required", 400);
        }

        const loan = await LoanMaster.findById(id);
        if (!loan) {
            return apiResponse.error(res, "Loan not found", 404);
        }

        if (loan.status !== "pending") {
            return apiResponse.error(res, `Loan is already ${loan.status}`, 400);
        }

        // Get group document
        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;
        
        // Verify loan's group belongs to admin's place
        const accessCheck = await verifyGroupAccess(loan.groupId, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "You don't have access to this loan's group", 403);
        }
        
        const group = accessCheck.group;

        // Validate balance before approving
        const loanAmount = parseFloat(loan.amount || 0);
        if (loan.paymentMode === "Bank" && loan.bankId) {
            const balanceInfo = await BankMaster.calculateAvailableBalance(loan.bankId);
            const availableBalance = balanceInfo.availableBalance || 0;
            if (availableBalance < loanAmount) {
                return apiResponse.error(res, `Insufficient bank balance. Available: ₹${availableBalance.toFixed(2)}, Required: ₹${loanAmount.toFixed(2)}`, 400);
            }
        } else if (loan.paymentMode === "Cash") {
            // Refetch as Mongoose document (not lean) to access instance methods
            const groupInstance = await GroupMaster.findById(group._id);
            if (!groupInstance) {
                return apiResponse.error(res, "Group not found", 404);
            }
            await groupInstance.recalculateCashBalance();
            const cashBalance = groupInstance.current_cash_balance || 0;
            if (cashBalance < loanAmount) {
                return apiResponse.error(res, `Insufficient cash balance. Available: ₹${cashBalance.toFixed(2)}, Required: ₹${loanAmount.toFixed(2)}`, 400);
            }
        }

        // Update loan status
        loan.status = "approved";
        loan.approvedBy = req.user?.id || "admin";
        loan.approvedAt = new Date();
        await loan.save();

        // Create bank transaction record if payment mode is Bank
        if (loan.paymentMode === "Bank" && loan.bankId) {
            await createBankTransactionRecord({
                bankId: loan.bankId,
                groupId: loan.groupId,
                transactionType: "loan",
                amount: loan.amount || 0,
                date: loan.date,
                description: `Loan ${loan.transactionType} - ${loan.purpose || ""}`,
                loanId: loan._id,
                memberId: loan.memberId || null,
                memberCode: loan.memberCode || null,
                memberName: loan.memberName || null,
                createdBy: req.user?.id || "admin",
                status: "verified", // Admin approved loans are immediately verified
            });
        }

        // Create cash transaction record if payment mode is Cash
        if (loan.paymentMode === "Cash") {
            await createCashTransactionRecord({
                groupId: loan.groupId,
                transactionType: "loan",
                amount: loan.amount || 0,
                date: loan.date,
                description: `Loan ${loan.transactionType} - ${loan.purpose || ""}`,
                loanId: loan._id,
                memberId: loan.memberId || null,
                memberCode: loan.memberCode || null,
                memberName: loan.memberName || null,
                createdBy: req.user?.id || "admin",
            });
        }

        return apiResponse.success(res, "Loan approved successfully", loan);
    } catch (error) {
        return apiResponse.error(res, error.message || "Failed to approve loan", 500);
    }
};

// Reject loan
export const rejectLoan = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!id) {
            return apiResponse.error(res, "Loan ID is required", 400);
        }

        const loan = await LoanMaster.findById(id);
        if (!loan) {
            return apiResponse.error(res, "Loan not found", 404);
        }

        if (loan.status !== "pending") {
            return apiResponse.error(res, `Loan is already ${loan.status}`, 400);
        }

        loan.status = "rejected";
        loan.rejectedBy = req.user?.id || "admin";
        loan.rejectedAt = new Date();
        loan.rejectionReason = reason || "No reason provided";
        await loan.save();

        return apiResponse.success(res, "Loan rejected successfully", loan);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

