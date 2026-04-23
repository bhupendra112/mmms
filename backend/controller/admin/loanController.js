import apiResponse from "../../utility/apiResponse.js";
import message from "../../utility/message.js";
import LoanMaster from "../../model/LoanMaster.js";
import { GroupMaster, BankMaster, LoanAdjustmentLog, PaymentMaster, Member } from "../../model/index.js";
import { createBankTransactionRecord } from "../../utility/bankTransactionHelper.js";
import { createCashTransactionRecord } from "../../utility/cashTransactionHelper.js";
import { verifyGroupAccess, verifyGroupAccessByCode, verifyGroupAccessByName } from "../../utility/groupAccessHelper.js";
import { postTransaction } from "../../service/ledgerPostingService.js";
import { findOrCreateHead } from "../../utility/headMappingHelper.js";
import { recalculateLoanState } from "../../service/loanRecalculationService.js";
import { assertVoucherValidForLoan } from "../../service/voucherService.js";

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
                // Convert DD/MM/YYYY to Date: store as UTC midnight so calendar day is correct in all timezones
                const day = parseInt(match[1], 10);
                const month = parseInt(match[2], 10) - 1; // Month is 0-indexed
                const year = parseInt(match[3], 10);
                dateValue = new Date(Date.UTC(year, month, day));
            } else {
                // Try to parse as ISO string (YYYY-MM-DD = UTC midnight) or other formats
                dateValue = new Date(payload.date);
            }

            // Validate the date
            if (isNaN(dateValue.getTime())) {
                return apiResponse.error(res, `Invalid date format: ${payload.date}. Expected DD/MM/YYYY or ISO format.`, 400);
            }
        }

        // Member loans (transactionType "Loan"): voucher + date required
        if (payload.transactionType === "Loan") {
            if (dateValue == null || (dateValue instanceof Date && isNaN(dateValue.getTime()))) {
                return apiResponse.error(res, "date is required for loan transactions", 400);
            }
            if (payload.voucherNumber === undefined || payload.voucherNumber === null || payload.voucherNumber === "") {
                return apiResponse.error(res, "voucherNumber is required for loan transactions", 400);
            }
            const voucherParsed = parseInt(String(payload.voucherNumber).trim(), 10);
            if (!Number.isInteger(voucherParsed)) {
                return apiResponse.error(res, "voucherNumber must be a whole number", 400);
            }
            try {
                await assertVoucherValidForLoan({ groupId: groupDoc._id, voucherNumber: voucherParsed });
            } catch (ve) {
                return apiResponse.error(res, ve.message || "Invalid voucher", 400);
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

        // Determine status based on user type and payload
        // Group/offline loans with requireApproval or source 'group_sync'
        // must remain pending even if synced with an admin token.
        const requiresApproval =
            payload.requireApproval === true || payload.source === "group_sync";
        const isAdmin = req.admin?.type !== "group" && !requiresApproval;
        const loanStatus = isAdmin ? "approved" : "pending";

        // Idempotency: for group-sync requests, avoid duplicate loans when the same request is sent twice (e.g. multi-tab or retry)
        if (requiresApproval && payload.groupId && payload.memberId && payload.amount != null && dateValue != null) {
            const idemFilter = {
                groupId: groupDoc._id,
                memberId: payload.memberId,
                amount: loanAmount,
                status: "pending",
                date: dateValue,
            };
            if (payload.voucherNumber !== undefined && payload.voucherNumber !== null && payload.voucherNumber !== "") {
                const vn = parseInt(String(payload.voucherNumber).trim(), 10);
                if (Number.isInteger(vn)) {
                    idemFilter.voucherNumber = vn;
                }
            }
            const existing = await LoanMaster.findOne(idemFilter).lean();
            if (existing) {
                return apiResponse.success(res, "Loan request already submitted; awaiting approval.", existing);
            }
        }

        // Persist normalized voucher for Loan transactions only
        let normalizedVoucher;
        if (payload.transactionType === "Loan") {
            normalizedVoucher = parseInt(String(payload.voucherNumber).trim(), 10);
        } else {
            delete loanPayload.voucherNumber;
        }

        // Create loan transaction
        let loan;
        try {
            loan = await LoanMaster.create({
                ...loanPayload,
                date: dateValue,
                groupId: groupDoc._id,
                groupName: payload.groupName || groupDoc.group_name,
                groupCode: payload.groupCode || groupDoc.group_code,
                loan_rate_snapshot: groupDoc.loan_rate || null, // Store rate snapshot
                yogdanAmount: yogdanAmount, // Store 1% Yogdan amount
                status: loanStatus,
                createdBy: req.user?.id || "admin",
                ...(payload.transactionType === "Loan"
                    ? { voucherNumber: normalizedVoucher }
                    : {}),
            });
        } catch (createErr) {
            if (createErr && createErr.code === 11000) {
                return apiResponse.error(res, "Voucher already used", 400);
            }
            throw createErr;
        }

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

            // Post ledger entry for loan distribution
            if (loan.transactionType === "Loan" && loan.amount > 0) {
                const headInfo = await findOrCreateHead(groupDoc._id, "Loan Distribute", "liability");
                await postTransaction({
                    sourceDoc: loan,
                    headName: "Loan Distribute",
                    headType: headInfo?.headType || "groupMaster",
                    headId: headInfo?.headId,
                    section: "liability",
                    amount: loan.amount,
                    direction: "out",
                    groupId: groupDoc._id,
                    memberId: loan.memberId || undefined,
                    date: dateValue,
                    notes: `Loan distribution - ${loan.purpose || ""} - Member: ${loan.memberName || loan.memberCode || ""}`,
                    paymentMode: payload.paymentMode || "Cash",
                    bankId: payload.bankId || undefined,
                    referenceModel: "LoanMaster",
                    referenceId: loan._id,
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

        // Post ledger entry for loan distribution (when approved)
        if (loan.transactionType === "Loan" && loan.amount > 0) {
            const group = await GroupMaster.findById(loan.groupId).lean();
            const headInfo = await findOrCreateHead(loan.groupId, "Loan Distribute", "liability");
            await postTransaction({
                sourceDoc: loan,
                headName: "Loan Distribute",
                headType: headInfo?.headType || "groupMaster",
                headId: headInfo?.headId,
                section: "liability",
                amount: loan.amount,
                direction: "out",
                groupId: loan.groupId,
                memberId: loan.memberId || undefined,
                date: loan.date,
                notes: `Loan distribution - ${loan.purpose || ""} - Member: ${loan.memberName || loan.memberCode || ""}`,
                paymentMode: loan.paymentMode || "Cash",
                bankId: loan.bankId || undefined,
                referenceModel: "LoanMaster",
                referenceId: loan._id,
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
        loan.set("voucherNumber", undefined);
        await loan.save();

        return apiResponse.success(res, "Loan rejected successfully", loan);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// ---------- Editable loan terms: preview & update (forward-only, no past record changes) ----------

const asOfToday = () => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
};

/**
 * Preview loan edit: old vs new total payable and adjustment status.
 * Body: { date?, amount?, time_period?, loan_rate_snapshot? }
 */
export const previewLoanEdit = async (req, res) => {
    try {
        const { id } = req.params;
        const body = req.body || {};
        if (!id) {
            return apiResponse.error(res, "Loan ID is required", 400);
        }

        const adminPlace = req.user?.place || req.admin?.place;
        const loan = await LoanMaster.findById(id).lean();
        if (!loan) {
            return apiResponse.error(res, "Loan not found", 404);
        }
        const accessCheck = await verifyGroupAccess(loan.groupId, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "Access denied", 403);
        }
        if (loan.transactionType !== "Loan" || loan.status !== "approved") {
            return apiResponse.error(res, "Only approved loans can be edited", 400);
        }

        const asOf = asOfToday();
        const oldState = await recalculateLoanState(id, asOf);
        const overrides = {};
        if (body.date != null) overrides.date = body.date;
        if (body.amount != null) overrides.amount = body.amount;
        if (body.time_period != null) overrides.time_period = body.time_period;
        if (body.loan_rate_snapshot != null) overrides.loan_rate_snapshot = body.loan_rate_snapshot;
        if (body.interestRate != null) overrides.loan_rate_snapshot = body.interestRate; // alias

        const newState = Object.keys(overrides).length > 0
            ? await recalculateLoanState(id, asOf, overrides)
            : oldState;

        const oldTotalPayable = oldState.totalDue;
        const newTotalPayable = newState.totalDue;
        const difference = Math.round((newTotalPayable - oldTotalPayable) * 100) / 100;
        let status = "no_change";
        let overpaidAmount = 0;
        let underpaidAmount = 0;
        if (newState.overpayment > 0) {
            status = "overpaid";
            overpaidAmount = newState.overpayment;
        } else if (newState.underpayment > 0) {
            status = "underpaid";
            underpaidAmount = newState.underpayment;
        }

        return apiResponse.success(res, "Preview calculated", {
            oldTotalPayable,
            newTotalPayable,
            difference,
            status,
            overpaidAmount,
            underpaidAmount,
            oldState: {
                totalDue: oldState.totalDue,
                totalPaid: oldState.totalPaid,
                overpayment: oldState.overpayment,
                underpayment: oldState.underpayment,
                outstanding: oldState.outstanding,
            },
            newState: {
                totalDue: newState.totalDue,
                totalPaid: newState.totalPaid,
                overpayment: newState.overpayment,
                underpayment: newState.underpayment,
                outstanding: newState.outstanding,
            },
        });
    } catch (error) {
        return apiResponse.error(res, error.message || "Preview failed", 500);
    }
};

/**
 * Update loan terms and apply adjustment (advance | refund | deficit | manual).
 * Body: date?, amount?, time_period?, loan_rate_snapshot?, actionTaken, manualOverride?, refundPaymentMode?, bankId?
 */
export const updateLoan = async (req, res) => {
    try {
        const { id } = req.params;
        const body = req.body || {};
        if (!id) {
            return apiResponse.error(res, "Loan ID is required", 400);
        }

        const adminPlace = req.user?.place || req.admin?.place;
        const loan = await LoanMaster.findById(id);
        if (!loan) {
            return apiResponse.error(res, "Loan not found", 404);
        }
        const accessCheck = await verifyGroupAccess(loan.groupId, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "Access denied", 403);
        }
        if (loan.transactionType !== "Loan" || loan.status !== "approved") {
            return apiResponse.error(res, "Only approved loans can be edited", 400);
        }

        const actionTaken = body.actionTaken; // advance | refund | deficit | manual
        const manualOverride = body.manualOverride || body.manualOverrideAmount != null
            ? {
                amount: body.manualOverrideAmount ?? body.manualOverride?.amount,
                type: body.manualAdjustmentType ?? body.manualOverride?.type,
                reason: body.manualAdjustmentReason ?? body.manualOverride?.reason,
            }
            : null;

        // 1) Snapshot old loan
        const oldLoanSnapshot = {
            date: loan.date,
            amount: loan.amount,
            time_period: loan.time_period,
            loan_rate_snapshot: loan.loan_rate_snapshot,
            installment_amount: loan.installment_amount,
        };

        // 2) Update editable fields (forward-only)
        if (body.date != null) loan.date = new Date(body.date);
        if (body.amount != null) {
            loan.amount = parseFloat(body.amount);
            if (loan.time_period > 0) {
                loan.installment_amount = loan.amount / loan.time_period;
            }
        }
        if (body.time_period != null) {
            const tp = parseFloat(body.time_period);
            // Store in months: if value looks like years (1–30 integer), convert; else treat as months
            loan.time_period = tp > 0 && tp <= 30 && Number.isInteger(tp) ? Math.round(tp * 12) : Math.round(tp);
            if (loan.amount != null && loan.time_period > 0) {
                loan.installment_amount = loan.amount / loan.time_period;
            }
        }
        if (body.loan_rate_snapshot != null) loan.loan_rate_snapshot = parseFloat(body.loan_rate_snapshot);
        if (body.interestRate != null) loan.loan_rate_snapshot = parseFloat(body.interestRate);

        await loan.save();

        const newLoanSnapshot = {
            date: loan.date,
            amount: loan.amount,
            time_period: loan.time_period,
            loan_rate_snapshot: loan.loan_rate_snapshot,
            installment_amount: loan.installment_amount,
        };

        // 3) Recalculate after update
        const asOf = asOfToday();
        const systemRecalculation = await recalculateLoanState(id, asOf);

        let refundPaymentId = null;
        let memberCredit = 0;
        let deficitAmount = 0;
        let effectiveAction = actionTaken;

        if (manualOverride && manualOverride.amount != null && manualOverride.type) {
            effectiveAction = "manual";
            const amt = Math.abs(parseFloat(manualOverride.amount)) || 0;
            if (manualOverride.type === "overpaid") {
                memberCredit = amt;
            } else if (manualOverride.type === "underpaid") {
                deficitAmount = amt;
            }
        } else if (systemRecalculation.overpayment > 0) {
            if (actionTaken === "advance") {
                memberCredit = systemRecalculation.overpayment;
                effectiveAction = "advance";
            } else if (actionTaken === "refund") {
                const refundAmt = systemRecalculation.overpayment;
                const paymentMode = body.refundPaymentMode || loan.paymentMode || "Cash";
                const bankId = body.bankId || loan.bankId;
                if (paymentMode === "Bank" && !bankId) {
                    return apiResponse.error(res, "bankId required for Bank refund", 400);
                }
                const member = await Member.findById(loan.memberId).lean();
                const paymentData = {
                    memberId: member?._id || loan.memberId,
                    memberCode: loan.memberCode || member?.Member_Id,
                    memberName: loan.memberName || member?.memberName,
                    groupId: loan.groupId,
                    groupName: loan.groupName,
                    groupCode: loan.groupCode,
                    paymentType: "loan_refund",
                    amount: refundAmt,
                    paymentMode,
                    bankId: paymentMode === "Bank" ? bankId : undefined,
                    status: "completed",
                    paymentDate: new Date(),
                    remarks: `Loan overpayment refund - Loan edit adjustment`,
                    createdBy: req.user?.id || "admin",
                    completedBy: req.user?.id || "admin",
                    completedAt: new Date(),
                };
                const payment = await PaymentMaster.create(paymentData);
                refundPaymentId = payment._id;

                if (paymentMode === "Cash") {
                    await createCashTransactionRecord({
                        groupId: loan.groupId,
                        transactionType: "payment",
                        amount: refundAmt,
                        date: new Date(),
                        description: "Loan Refund (overpayment)",
                        paymentId: payment._id,
                        memberId: loan.memberId,
                        memberCode: loan.memberCode,
                        memberName: loan.memberName,
                        createdBy: req.user?.id || "admin",
                    });
                } else {
                    await createBankTransactionRecord({
                        bankId,
                        groupId: loan.groupId,
                        transactionType: "payment",
                        amount: refundAmt,
                        date: new Date(),
                        description: "Loan Refund (overpayment)",
                        paymentId: payment._id,
                        memberId: loan.memberId,
                        memberCode: loan.memberCode,
                        memberName: loan.memberName,
                        createdBy: req.user?.id || "admin",
                        status: "verified",
                    });
                }
                const headInfo = await findOrCreateHead(loan.groupId, "Loan Refund", "liability");
                await postTransaction({
                    sourceDoc: payment,
                    headName: "Loan Refund",
                    headType: headInfo?.headType || "groupMaster",
                    headId: headInfo?.headId,
                    section: "liability",
                    amount: refundAmt,
                    direction: "out",
                    groupId: loan.groupId,
                    memberId: loan.memberId || undefined,
                    date: new Date(),
                    notes: `Loan refund - ${loan.memberName || loan.memberCode || ""}`,
                    paymentMode,
                    bankId: paymentMode === "Bank" ? bankId : undefined,
                    referenceModel: "PaymentMaster",
                    referenceId: payment._id,
                    createdBy: req.user?.id || "admin",
                });
            }
        } else if (systemRecalculation.underpayment > 0) {
            if (actionTaken === "deficit" || !actionTaken) {
                deficitAmount = systemRecalculation.underpayment;
                effectiveAction = "deficit";
            }
        }

        const adjustmentLog = await LoanAdjustmentLog.create({
            loanId: loan._id,
            groupId: loan.groupId,
            memberId: loan.memberId,
            memberCode: loan.memberCode,
            memberName: loan.memberName,
            oldLoanSnapshot,
            newLoanSnapshot,
            systemRecalculation: {
                recalculatedPrincipalDue: systemRecalculation.recalculatedPrincipalDue,
                recalculatedInterestDue: systemRecalculation.recalculatedInterestDue,
                totalDue: systemRecalculation.totalDue,
                totalPaid: systemRecalculation.totalPaid,
                overpayment: systemRecalculation.overpayment,
                underpayment: systemRecalculation.underpayment,
                outstanding: systemRecalculation.outstanding,
                principalPaid: systemRecalculation.principalPaid,
                interestPaid: systemRecalculation.interestPaid,
            },
            manualOverride: manualOverride && (manualOverride.amount != null || manualOverride.reason)
                ? {
                    amount: manualOverride.amount,
                    type: manualOverride.type,
                    reason: manualOverride.reason,
                }
                : undefined,
            actionTaken: effectiveAction,
            refundPaymentId: refundPaymentId || undefined,
            memberCredit,
            deficitAmount,
            createdBy: req.user?.id || "admin",
        });

        return apiResponse.success(res, "Loan updated and adjustment applied", {
            loan: loan.toObject ? loan.toObject() : loan,
            adjustmentLog: adjustmentLog.toObject ? adjustmentLog.toObject() : adjustmentLog,
            systemRecalculation,
        });
    } catch (error) {
        return apiResponse.error(res, error.message || "Update failed", 500);
    }
};

