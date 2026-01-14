import apiResponse from "../../utility/apiResponse.js";
import PaymentMaster from "../../model/PaymentMaster.js";
import FDMaster from "../../model/FDMaster.js";
import Member from "../../model/Member.js";
import { GroupMaster, BankMaster } from "../../model/index.js";
import RecoveryMaster from "../../model/RecoveryMaster.js";
import { createCashTransactionRecord } from "../../utility/cashTransactionHelper.js";
import { verifyGroupAccess } from "../../utility/groupAccessHelper.js";

// Get matured FDs
export const getMaturedFDs = async (req, res) => {
    try {
        const { groupId, memberId } = req.query;

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;
        
        const filter = {
            status: "active",
            maturityDate: { $lte: new Date() }, // Matured FDs
        };

        if (groupId) {
            // Verify group access
            const accessCheck = await verifyGroupAccess(groupId, adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
            }
            filter.groupId = groupId;
        } else {
            // If no group specified, filter by all groups in admin's place
            const groups = await GroupMaster.find({ place: adminPlace }).select("_id").lean();
            const groupIds = groups.map(g => g._id);
            filter.groupId = { $in: groupIds };
        }
        if (memberId) {
            filter.memberId = memberId;
        }

        const maturedFDs = await FDMaster.find(filter)
            .populate("memberId", "Member_Id Member_Nm")
            .populate("groupId", "group_name group_code")
            .sort({ maturityDate: 1 })
            .lean();

        return apiResponse.success(res, "Matured FDs fetched successfully", maturedFDs);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Get member's available savings balance
export const getMemberSavings = async (req, res) => {
    try {
        const { memberId } = req.params;

        if (!memberId) {
            return apiResponse.error(res, "memberId is required", 400);
        }

        const member = await Member.findById(memberId);
        if (!member) {
            return apiResponse.error(res, "Member not found", 404);
        }

        // Get opening savings
        const openingSaving = member.openingSaving || 0;

        // Calculate total savings from recoveries
        const groupId = member.group || member.Group_Name;
        let totalRecoverySavings = 0;

        if (groupId) {
            const recoveries = await RecoveryMaster.find({
                groupId: groupId,
                "recoveries.memberId": memberId.toString(),
            }).lean();

            recoveries.forEach(recovery => {
                if (recovery.recoveries && Array.isArray(recovery.recoveries)) {
                    recovery.recoveries.forEach(rec => {
                        if (rec.memberId === memberId.toString() || rec.memberId === memberId) {
                            totalRecoverySavings += parseFloat(rec.amounts?.saving || 0);
                        }
                    });
                }
            });
        }

        // Calculate total available savings
        const totalSavings = openingSaving + totalRecoverySavings;

        // Get total withdrawals (payments of type saving_withdrawal)
        const withdrawals = await PaymentMaster.find({
            memberId: memberId,
            paymentType: "saving_withdrawal",
            status: { $in: ["approved", "completed"] },
        }).lean();

        const totalWithdrawn = withdrawals.reduce((sum, payment) => sum + (payment.amount || 0), 0);

        const availableSavings = Math.max(0, totalSavings - totalWithdrawn);

        return apiResponse.success(res, "Member savings fetched successfully", {
            memberId: member._id,
            memberCode: member.Member_Id,
            memberName: member.Member_Nm,
            openingSaving,
            totalRecoverySavings,
            totalSavings,
            totalWithdrawn,
            availableSavings,
        });
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Create payment
export const createPayment = async (req, res) => {
    try {
        const payload = req.body || {};
        console.log(payload);
        // Validate required fields
        if (!payload.memberId || !payload.paymentType || !payload.amount) {
            return apiResponse.error(res, "memberId, paymentType, and amount are required", 400);
        }

        // Payment mode validation
        const paymentMode = payload.paymentMode || "Bank"; // Default to Bank for backward compatibility
        if (paymentMode === "Bank" && !payload.bankId) {
            return apiResponse.error(res, "bankId is required when paymentMode is Bank", 400);
        }

        // Verify member exists
        const member = await Member.findById(payload.memberId);
        if (!member) {
            return apiResponse.error(res, "Member not found", 404);
        }

        // Get group from member or payload
        const groupId = payload.groupId || member.group;
        if (!groupId) {
            return apiResponse.error(res, "Group ID is required", 400);
        }

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;
        
        // Verify group exists and belongs to admin's place
        const accessCheck = await verifyGroupAccess(groupId, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
        }
        // Fetch group as Mongoose document (not lean) to use instance methods like recalculateCashBalance
        const group = await GroupMaster.findById(groupId);
        if (!group) {
            return apiResponse.error(res, "Group not found", 404);
        }

        // Verify bank exists and belongs to group (only if payment mode is Bank)
        let bank = null;
        if (paymentMode === "Bank") {
            bank = await BankMaster.findById(payload.bankId);
            if (!bank) {
                return apiResponse.error(res, "Bank not found", 404);
            }

            if (bank.group_id && bank.group_id.toString() !== groupId.toString()) {
                return apiResponse.error(res, "Bank does not belong to the specified group", 400);
            }
        }

        // Validate balance based on payment mode
        const paymentAmount = parseFloat(payload.amount);
        console.log("[PAYMENT_CREATE] Payment validation - Payment Amount:", paymentAmount, "Payment Mode:", paymentMode);

        if (paymentMode === "Cash") {
            // Check cash balance
            await group.recalculateCashBalance();
            const cashBalance = group.current_cash_balance || 0;
            console.log("[PAYMENT_CREATE] Cash Payment - Current Cash Balance:", cashBalance, "Required Amount:", paymentAmount);
            if (cashBalance < paymentAmount) {
                console.log("[PAYMENT_CREATE] Cash Payment - INSUFFICIENT BALANCE");
                return apiResponse.error(res, `Insufficient cash balance. Available: ₹${cashBalance.toFixed(2)}, Required: ₹${paymentAmount.toFixed(2)}`, 400);
            }
            console.log("[PAYMENT_CREATE] Cash Payment - Balance sufficient");
        } else if (paymentMode === "Bank" && bank) {
            // Check bank balance
            console.log("[PAYMENT_CREATE] Bank Payment - Bank ID:", bank._id.toString(), "Bank Name:", bank.bank_name);
            console.log("[PAYMENT_CREATE] Bank Payment - Current Balance (before calculation):", bank.current_balance || 0);
            const balanceInfo = await BankMaster.calculateAvailableBalance(payload.bankId);
            const availableBalance = balanceInfo.availableBalance || 0;
            console.log("[PAYMENT_CREATE] Bank Payment - Available Balance:", availableBalance, "Current Balance:", balanceInfo.currentBalance, "Pending Debits:", balanceInfo.pendingDebits, "Pending Credits:", balanceInfo.pendingCredits);
            console.log("[PAYMENT_CREATE] Bank Payment - Required Amount:", paymentAmount);
            if (availableBalance < paymentAmount) {
                console.log("[PAYMENT_CREATE] Bank Payment - INSUFFICIENT BALANCE");
                return apiResponse.error(res, `Insufficient bank balance. Available: ₹${availableBalance.toFixed(2)}, Required: ₹${paymentAmount.toFixed(2)}`, 400);
            }
            console.log("[PAYMENT_CREATE] Bank Payment - Balance sufficient");
        }

        // Validate payment type specific requirements
        if (payload.paymentType === "fd_maturity") {
            if (!payload.fdId) {
                return apiResponse.error(res, "fdId is required for FD maturity payment", 400);
            }

            // Verify FD exists and belongs to member
            const fd = await FDMaster.findById(payload.fdId);
            if (!fd) {
                return apiResponse.error(res, "FD not found", 404);
            }

            if (fd.memberId.toString() !== payload.memberId.toString()) {
                return apiResponse.error(res, "FD does not belong to the specified member", 400);
            }

            if (fd.status !== "active") {
                return apiResponse.error(res, "FD is not active", 400);
            }

            if (fd.maturityDate > new Date()) {
                return apiResponse.error(res, "FD has not matured yet", 400);
            }

            // Check if FD already has a payment
            const existingPayment = await PaymentMaster.findOne({
                fdId: payload.fdId,
                status: { $in: ["pending", "approved", "completed"] },
            });

            if (existingPayment) {
                return apiResponse.error(res, "Payment already exists for this FD", 400);
            }
        } else if (payload.paymentType === "saving_withdrawal") {
            // Verify member has sufficient savings
            const savingsData = await getMemberSavingsData(payload.memberId);
            if (savingsData.availableSavings < payload.amount) {
                return apiResponse.error(res, `Insufficient savings. Available: ₹${savingsData.availableSavings}`, 400);
            }
        }

        // Determine status based on user type
        // Check if the user is a group (type === "group") or an admin
        // Group payments must go through approval workflow (pending status)
        // Admin payments are immediately approved

        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'paymentController.js:225', message: 'Auth check - req.admin', data: { reqAdmin: req.admin, reqUser: req.user, type: req.admin?.type }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(() => { });
        // #endregion

        const isAdmin = req.admin?.type !== "group";
        const status = isAdmin ? "approved" : "pending";

        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'paymentController.js:231', message: 'Status determination', data: { isAdmin: isAdmin, status: status, type: req.admin?.type }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(() => { });
        // #endregion

        // Parse payment date
        let paymentDate = payload.paymentDate ? new Date(payload.paymentDate) : new Date();
        if (typeof payload.paymentDate === 'string' && payload.paymentDate.includes('/')) {
            const parts = payload.paymentDate.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const year = parseInt(parts[2], 10);
                paymentDate = new Date(year, month, day);
            }
        }

        // Create payment
        const payment = await PaymentMaster.create({
            memberId: payload.memberId,
            memberCode: member.Member_Id,
            memberName: member.Member_Nm,
            groupId: group._id,
            groupName: group.group_name,
            groupCode: group.group_code,
            paymentType: payload.paymentType,
            amount: parseFloat(payload.amount),
            paymentMode: paymentMode,
            bankId: paymentMode === "Bank" && bank ? bank._id : null,
            bankName: paymentMode === "Bank" && bank ? bank.bank_name : null,
            accountNo: paymentMode === "Bank" && bank ? bank.account_no : null,
            fdId: payload.fdId || null,
            status: status,
            paymentDate: paymentDate,
            createdBy: req.user?.id || "admin",
            remarks: payload.remarks || null,
        });

        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'paymentController.js:260', message: 'Payment created', data: { paymentId: payment._id.toString(), status: payment.status, isAdmin: isAdmin, type: req.admin?.type }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(() => { });
        // #endregion

        // Update bank current_balance when bank payment is created (for admin, payment is approved immediately)
        if (paymentMode === "Bank" && bank && isAdmin) {
            console.log("[PAYMENT_CREATE] Updating bank current_balance for bank payment");
            console.log("[PAYMENT_CREATE] Bank Details - ID:", bank._id.toString(), "Name:", bank.bank_name, "Account No:", bank.account_no);
            const balanceBefore = bank.current_balance || 0;
            console.log("[PAYMENT_CREATE] Bank Balance OLD (before update):", balanceBefore);
            console.log("[PAYMENT_CREATE] Payment Amount to deduct:", paymentAmount);
            bank.current_balance = Math.max(0, balanceBefore - paymentAmount);
            const balanceAfter = bank.current_balance;
            console.log("[PAYMENT_CREATE] Bank Balance NEW (after update):", balanceAfter);
            console.log("[PAYMENT_CREATE] Balance Change:", balanceAfter - balanceBefore, "(expected:", -paymentAmount, ")");
            await bank.save();
            console.log("[PAYMENT_CREATE] Bank balance saved successfully");

            // Verify the saved balance
            const savedBank = await BankMaster.findById(bank._id);
            console.log("[PAYMENT_CREATE] Bank Balance VERIFIED (after save):", savedBank.current_balance);

            // Create bank transaction record immediately for admin payments (so calculateCurrentBalance sees it)
            // This ensures the balance calculation in getGroupBanks returns the correct value
            // Mark as "verified" since admin payments are immediately approved
            try {
                const { createBankTransactionRecord } = await import("../../utility/bankTransactionHelper.js");
                await createBankTransactionRecord({
                    bankId: bank._id,
                    groupId: group._id,
                    transactionType: "payment",
                    amount: paymentAmount,
                    date: paymentDate,
                    description: `Payment - ${payment.paymentType}: ${member.Member_Nm} (${member.Member_Id})`,
                    paymentId: payment._id,
                    memberId: payment.memberId,
                    memberCode: payment.memberCode,
                    memberName: payment.memberName,
                    createdBy: req.user?.id || "admin",
                    status: "verified", // Admin payments are immediately verified
                });
                console.log("[PAYMENT_CREATE] Bank transaction record created (verified) for immediate balance calculation");
            } catch (error) {
                console.error("[PAYMENT_CREATE] Error creating bank transaction record:", error);
                // Don't fail the payment creation if transaction record creation fails
            }
        }

        // Update cash balance when cash payment is created (for admin, payment is approved immediately)
        if (paymentMode === "Cash" && isAdmin) {
            console.log("[PAYMENT_CREATE] Updating cash balance for cash payment");
            await group.recalculateCashBalance();
            const cashBalanceBefore = group.current_cash_balance || 0;
            console.log("[PAYMENT_CREATE] Cash Balance OLD (before update):", cashBalanceBefore);
            console.log("[PAYMENT_CREATE] Payment Amount to deduct:", paymentAmount);
            group.current_cash_balance = Math.max(0, cashBalanceBefore - paymentAmount);
            const cashBalanceAfter = group.current_cash_balance;
            console.log("[PAYMENT_CREATE] Cash Balance NEW (after update):", cashBalanceAfter);
            console.log("[PAYMENT_CREATE] Cash Balance Change:", cashBalanceAfter - cashBalanceBefore, "(expected:", -paymentAmount, ")");
            await group.save();
            console.log("[PAYMENT_CREATE] Cash balance saved successfully");

            // Verify the saved balance
            const savedGroup = await GroupMaster.findById(group._id);
            console.log("[PAYMENT_CREATE] Cash Balance VERIFIED (after save):", savedGroup.current_cash_balance);
        }

        // If group panel, create approval request
        if (!isAdmin) {
            // You may want to create an approval request here
            // For now, payment is created with pending status
        }

        return apiResponse.success(res, isAdmin ? "Payment created successfully" : "Payment request created successfully", payment);

    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Helper function to get member savings data
const getMemberSavingsData = async (memberId) => {
    const member = await Member.findById(memberId);
    if (!member) {
        return { availableSavings: 0 };
    }

    const openingSaving = member.openingSaving || 0;
    const groupId = member.group || member.Group_Name;
    let totalRecoverySavings = 0;

    if (groupId) {
        const recoveries = await RecoveryMaster.find({
            groupId: groupId,
            "recoveries.memberId": memberId.toString(),
        }).lean();

        recoveries.forEach(recovery => {
            if (recovery.recoveries && Array.isArray(recovery.recoveries)) {
                recovery.recoveries.forEach(rec => {
                    if (rec.memberId === memberId.toString() || rec.memberId === memberId) {
                        totalRecoverySavings += parseFloat(rec.amounts?.saving || 0);
                    }
                });
            }
        });
    }

    const totalSavings = openingSaving + totalRecoverySavings;

    const withdrawals = await PaymentMaster.find({
        memberId: memberId,
        paymentType: "saving_withdrawal",
        status: { $in: ["approved", "completed"] },
    }).lean();

    const totalWithdrawn = withdrawals.reduce((sum, payment) => sum + (payment.amount || 0), 0);

    return {
        availableSavings: Math.max(0, totalSavings - totalWithdrawn),
        totalSavings,
        totalWithdrawn,
    };
};

// Get payments list
export const getPayments = async (req, res) => {
    try {
        const { groupId, memberId, paymentType, status, fromDate, toDate } = req.query;

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
        } else {
            // If no group specified, filter by all groups in admin's place
            const groups = await GroupMaster.find({ place: adminPlace }).select("_id").lean();
            const groupIds = groups.map(g => g._id);
            filter.groupId = { $in: groupIds };
        }
        if (memberId) filter.memberId = memberId;
        if (paymentType) filter.paymentType = paymentType;
        if (status) filter.status = status;

        if (fromDate || toDate) {
            filter.paymentDate = {};
            if (fromDate) {
                const startDate = new Date(fromDate);
                startDate.setHours(0, 0, 0, 0);
                filter.paymentDate.$gte = startDate;
            }
            if (toDate) {
                const endDate = new Date(toDate);
                endDate.setHours(23, 59, 59, 999);
                filter.paymentDate.$lte = endDate;
            }
        }

        const payments = await PaymentMaster.find(filter)
            .populate("memberId", "Member_Id Member_Nm")
            .populate("groupId", "group_name group_code")
            .populate("bankId", "bank_name account_no")
            .populate("fdId", "amount maturityDate maturityAmount")
            .sort({ paymentDate: -1, createdAt: -1 })
            .lean();

        return apiResponse.success(res, "Payments fetched successfully", payments);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Approve payment
export const approvePayment = async (req, res) => {
    try {
        const { id } = req.params;

        const payment = await PaymentMaster.findById(id);
        if (!payment) {
            return apiResponse.error(res, "Payment not found", 404);
        }

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;
        
        // Verify payment's group belongs to admin's place
        if (payment.groupId) {
            const accessCheck = await verifyGroupAccess(payment.groupId, adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(res, accessCheck.error || "You don't have access to this payment's group", 403);
            }
        }

        if (payment.status !== "pending") {
            return apiResponse.error(res, `Payment is already ${payment.status}`, 400);
        }

        payment.status = "approved";
        payment.approvedBy = req.user?.id || "admin";
        payment.approvedAt = new Date();
        await payment.save();

        return apiResponse.success(res, "Payment approved successfully", payment);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Reject payment
export const rejectPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const payment = await PaymentMaster.findById(id);
        if (!payment) {
            return apiResponse.error(res, "Payment not found", 404);
        }

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;
        
        // Verify payment's group belongs to admin's place
        if (payment.groupId) {
            const accessCheck = await verifyGroupAccess(payment.groupId, adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(res, accessCheck.error || "You don't have access to this payment's group", 403);
            }
        }

        if (payment.status !== "pending") {
            return apiResponse.error(res, `Payment is already ${payment.status}`, 400);
        }

        payment.status = "rejected";
        payment.rejectedBy = req.user?.id || "admin";
        payment.rejectedAt = new Date();
        payment.rejectionReason = reason || "No reason provided";
        await payment.save();

        return apiResponse.success(res, "Payment rejected successfully", payment);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Complete payment (updates member balance)
export const completePayment = async (req, res) => {
    try {
        const { id } = req.params;

        const payment = await PaymentMaster.findById(id);
        if (!payment) {
            return apiResponse.error(res, "Payment not found", 404);
        }

        if (payment.status !== "approved") {
            return apiResponse.error(res, "Payment must be approved before completion", 400);
        }

        // Update payment status
        payment.status = "completed";
        payment.completedBy = req.user?.id || "admin";
        payment.completedAt = new Date();
        await payment.save();

        // Create transaction record based on payment mode
        if (payment.paymentMode === "Cash") {
            // Create cash transaction record for cash payment
            await createCashTransactionRecord({
                groupId: payment.groupId,
                transactionType: "payment",
                amount: payment.amount,
                date: payment.paymentDate,
                description: `Payment - ${payment.paymentType}: ${payment.memberName} (${payment.memberCode})`,
                paymentId: payment._id,
                memberId: payment.memberId,
                memberCode: payment.memberCode,
                memberName: payment.memberName,
                createdBy: req.user?.id || "admin",
            });
        } else {
            // Create bank transaction record for bank payment
            const { createBankTransactionRecord } = await import("../../utility/bankTransactionHelper.js");
            await createBankTransactionRecord({
                bankId: payment.bankId,
                groupId: payment.groupId,
                transactionType: "payment",
                amount: payment.amount,
                date: payment.paymentDate,
                description: `Payment - ${payment.paymentType}: ${payment.memberName} (${payment.memberCode})`,
                paymentId: payment._id,
                memberId: payment.memberId,
                memberCode: payment.memberCode,
                memberName: payment.memberName,
                createdBy: req.user?.id || "admin",
            });
        }

        // Update member balance based on payment type
        if (payment.paymentType === "fd_maturity" && payment.fdId) {
            // Update FD status to closed
            await FDMaster.findByIdAndUpdate(payment.fdId, {
                status: "closed",
                paymentId: payment._id,
            });
        } else if (payment.paymentType === "saving_withdrawal") {
            // For savings withdrawal, we track it via PaymentMaster
            // The available balance is calculated by subtracting completed payments
            // No need to update Member model directly
        }

        return apiResponse.success(res, "Payment completed successfully", payment);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Get payment detail
export const getPaymentDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const payment = await PaymentMaster.findById(id)
            .populate("memberId")
            .populate("groupId", "group_name group_code")
            .populate("bankId", "bank_name account_no branch_name ifsc")
            .populate("fdId")
            .lean();

        if (!payment) {
            return apiResponse.error(res, "Payment not found", 404);
        }

        return apiResponse.success(res, "Payment detail fetched successfully", payment);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

