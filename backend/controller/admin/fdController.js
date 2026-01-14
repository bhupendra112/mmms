import apiResponse from "../../utility/apiResponse.js";
import FDMaster from "../../model/FDMaster.js";
import { GroupMaster, BankMaster } from "../../model/index.js";
import Member from "../../model/Member.js";
import { createBankTransactionRecord } from "../../utility/bankTransactionHelper.js";
import { createCashTransactionRecord } from "../../utility/cashTransactionHelper.js";
import { verifyGroupAccess } from "../../utility/groupAccessHelper.js";

// Create new FD
export const createFD = async (req, res) => {
    try {
        const payload = req.body || {};

        // Validate required fields
        if (!payload.memberId || !payload.amount || !payload.time_period) {
            return apiResponse.error(res, "memberId, amount, and time_period (in years) are required", 400);
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
        const group = accessCheck.group;

        // Get FD rate from group (snapshot)
        const fdRate = group.fd_rate;
        if (!fdRate && fdRate !== 0) {
            return apiResponse.error(res, "FD rate not set for this group", 400);
        }

        // Parse date
        let fdDate = payload.date ? new Date(payload.date) : new Date();
        if (typeof payload.date === 'string' && payload.date.includes('/')) {
            const parts = payload.date.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const year = parseInt(parts[2], 10);
                fdDate = new Date(year, month, day);
            }
        }

        // Calculate maturity date
        // time_period is now in years, convert to months for storage
        const timePeriodYears = parseFloat(payload.time_period);
        if (timePeriodYears <= 0) {
            return apiResponse.error(res, "Time period must be greater than 0 years", 400);
        }
        const timePeriodMonths = Math.round(timePeriodYears * 12); // Convert years to months
        
        const maturityDate = new Date(fdDate);
        maturityDate.setMonth(maturityDate.getMonth() + timePeriodMonths);

        // Calculate interest and maturity amount
        const principal = parseFloat(payload.amount);
        if (!principal || principal <= 0) {
            return apiResponse.error(res, "FD amount must be greater than 0", 400);
        }
        const interestAmount = (principal * fdRate * timePeriodYears) / 100;
        const maturityAmount = principal + interestAmount;

        // Validate balance based on payment mode
        // Note: For cash FD, member gives cash to group, so group's cash balance will increase (no validation needed)
        // For bank FD, group pays from bank, so we need to check bank balance
        if (payload.paymentMode?.online === true && payload.bankId) {
            // Check bank balance
            const bank = await BankMaster.findById(payload.bankId);
            if (!bank) {
                return apiResponse.error(res, "Bank account not found", 404);
            }
            const balanceInfo = await BankMaster.calculateAvailableBalance(payload.bankId);
            const availableBalance = balanceInfo.availableBalance || 0;
            if (availableBalance < principal) {
                return apiResponse.error(res, `Insufficient bank balance. Available: ₹${availableBalance.toFixed(2)}, Required: ₹${principal.toFixed(2)}`, 400);
            }
        }

        // Create FD
        const fd = await FDMaster.create({
            memberId: payload.memberId,
            memberCode: member.Member_Id,
            memberName: member.Member_Nm,
            groupId: group._id,
            groupName: group.group_name,
            groupCode: group.group_code,
            amount: principal,
            time_period: timePeriodMonths,
            fd_rate_snapshot: fdRate,
            date: fdDate,
            maturityDate: maturityDate,
            interestAmount: interestAmount,
            maturityAmount: maturityAmount,
            paymentMode: payload.paymentMode || { cash: false, online: false },
            onlineRef: payload.onlineRef || null,
            bankId: payload.bankId || null,
            status: "active",
            createdBy: req.user?.id || "admin",
        });

        // Create bank transaction record if online payment with bank
        // NOTE: FD creation with bank is a CREDIT transaction - member gives money to group via bank, so bank balance increases
        if (payload.paymentMode?.online && payload.bankId) {
            console.log("[FD_CONTROLLER] Creating bank transaction for FD creation (CREDIT - will ADD to bank balance):", {
                bankId: payload.bankId,
                groupId: group._id.toString(),
                amount: principal,
                transactionType: "fd"
            });
            
            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'fdController.js:116', message: 'Creating bank transaction for FD (should be CREDIT)', data: { bankId: payload.bankId, groupId: group._id.toString(), amount: principal, transactionType: 'fd', paymentMode: 'online' }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'FD_FIX' }) }).catch(() => { });
            // #endregion
            
            const bankTxResult = await createBankTransactionRecord({
                bankId: payload.bankId,
                groupId: group._id,
                transactionType: "fd",
                amount: principal,
                date: fdDate,
                onlineRef: payload.onlineRef || null,
                receipt: payload.receipt || null,
                receiptFileName: payload.receiptFileName || null,
                description: `FD creation - Amount: ₹${principal}, Period: ${timePeriodYears} years`,
                fdId: fd._id,
                memberId: payload.memberId,
                memberCode: member.Member_Id,
                memberName: member.Member_Nm,
                createdBy: req.user?.id || "admin",
            });
            
            console.log("[FD_CONTROLLER] Bank transaction result:", bankTxResult ? "SUCCESS" : "FAILED");
            if (bankTxResult) {
                console.log("[FD_CONTROLLER] Bank transaction details:", {
                    id: bankTxResult._id?.toString(),
                    status: bankTxResult.status,
                    transactionType: bankTxResult.transactionType,
                    amount: bankTxResult.amount
                });
            }
            
            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'fdController.js:140', message: 'Bank transaction created for FD', data: { success: !!bankTxResult, bankTransactionId: bankTxResult?._id?.toString(), status: bankTxResult?.status, transactionType: bankTxResult?.transactionType }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'FD_FIX' }) }).catch(() => { });
            // #endregion
        }

        // Create cash transaction record if payment mode is Cash
        // NOTE: FD creation with cash is a CREDIT transaction - member gives cash to group, so cash balance increases
        if (payload.paymentMode?.cash) {
            console.log("[FD_CONTROLLER] Creating cash transaction for FD creation (CREDIT - will ADD cash):", {
                groupId: group._id.toString(),
                amount: principal,
                transactionType: "fd"
            });
            
            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'fdController.js:137', message: 'Creating cash transaction for FD (should be CREDIT)', data: { groupId: group._id.toString(), amount: principal, transactionType: 'fd', paymentMode: 'cash' }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'FD_FIX' }) }).catch(() => { });
            // #endregion
            
            const cashTxResult = await createCashTransactionRecord({
                groupId: group._id,
                transactionType: "fd",
                amount: principal,
                date: fdDate,
                receipt: payload.receipt || null,
                receiptFileName: payload.receiptFileName || null,
                description: `FD creation - Amount: ₹${principal}, Period: ${timePeriodYears} years`,
                fdId: fd._id,
                memberId: payload.memberId,
                memberCode: member.Member_Id,
                memberName: member.Member_Nm,
                createdBy: req.user?.id || "admin",
            });
            
            console.log("[FD_CONTROLLER] Cash transaction result:", cashTxResult ? "SUCCESS" : "FAILED");
            
            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'fdController.js:156', message: 'Cash transaction created for FD', data: { success: !!cashTxResult, cashTransactionId: cashTxResult?._id?.toString() }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'FD_FIX' }) }).catch(() => { });
            // #endregion
        }

        return apiResponse.success(res, "FD created successfully", fd);

    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Get FDs by member
export const getFDsByMember = async (req, res) => {
    try {
        const { memberId } = req.params;

        if (!memberId) {
            return apiResponse.error(res, "memberId is required", 400);
        }

        const fds = await FDMaster.find({ memberId })
            .populate("groupId", "group_name group_code")
            .sort({ date: -1 })
            .lean();

        return apiResponse.success(res, "FDs fetched successfully", fds);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Get FDs by group
export const getFDsByGroup = async (req, res) => {
    try {
        const { groupId } = req.params;

        if (!groupId) {
            return apiResponse.error(res, "groupId is required", 400);
        }

        const fds = await FDMaster.find({ groupId })
            .populate("memberId", "Member_Id Member_Nm")
            .sort({ date: -1 })
            .lean();

        return apiResponse.success(res, "FDs fetched successfully", fds);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Get all FDs
export const getAllFDs = async (req, res) => {
    try {
        const { status, groupId } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (groupId) filter.groupId = groupId;

        const fds = await FDMaster.find(filter)
            .populate("memberId", "Member_Id Member_Nm")
            .populate("groupId", "group_name group_code")
            .sort({ date: -1 })
            .lean();

        return apiResponse.success(res, "FDs fetched successfully", fds);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Get FD detail
export const getFDDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const fd = await FDMaster.findById(id)
            .populate("memberId")
            .populate("groupId", "group_name group_code")
            .lean();

        if (!fd) {
            return apiResponse.error(res, "FD not found", 404);
        }

        return apiResponse.success(res, "FD detail fetched successfully", fd);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Update FD status (e.g., mark as matured or closed)
export const updateFDStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status || !["active", "matured", "closed"].includes(status)) {
            return apiResponse.error(res, "Valid status is required (active, matured, closed)", 400);
        }

        const fd = await FDMaster.findById(id);
        if (!fd) {
            return apiResponse.error(res, "FD not found", 404);
        }

        fd.status = status;
        await fd.save();

        return apiResponse.success(res, "FD status updated successfully", fd);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

