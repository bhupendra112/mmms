import apiResponse from "../../utility/apiResponse.js";
import PaymentMaster from "../../model/PaymentMaster.js";
import FDMaster from "../../model/FDMaster.js";
import Member from "../../model/Member.js";
import { GroupMaster, BankMaster } from "../../model/index.js";
import RecoveryMaster from "../../model/RecoveryMaster.js";

// Get matured FDs
export const getMaturedFDs = async (req, res) => {
    try {
        const { groupId, memberId } = req.query;
        
        const filter = {
            status: "active",
            maturityDate: { $lte: new Date() }, // Matured FDs
        };
        
        if (groupId) {
            filter.groupId = groupId;
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
        
        // Validate required fields
        if (!payload.memberId || !payload.paymentType || !payload.amount || !payload.bankId) {
            return apiResponse.error(res, "memberId, paymentType, amount, and bankId are required", 400);
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
        
        // Verify group exists
        const group = await GroupMaster.findById(groupId);
        if (!group) {
            return apiResponse.error(res, "Group not found", 404);
        }
        
        // Verify bank exists and belongs to group
        const bank = await BankMaster.findById(payload.bankId);
        if (!bank) {
            return apiResponse.error(res, "Bank not found", 404);
        }
        
        if (bank.group_id && bank.group_id.toString() !== groupId.toString()) {
            return apiResponse.error(res, "Bank does not belong to the specified group", 400);
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
        // If createdBy is admin or starts with "admin", set to approved
        // Otherwise, set to pending for approval
        const isAdmin = req.user?.id && !req.user.id.startsWith("group_");
        const status = isAdmin ? "approved" : "pending";
        
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
            bankId: bank._id,
            bankName: bank.bank_name,
            accountNo: bank.account_no,
            fdId: payload.fdId || null,
            status: status,
            paymentDate: paymentDate,
            createdBy: req.user?.id || "admin",
            remarks: payload.remarks || null,
        });
        
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
        
        const filter = {};
        if (groupId) filter.groupId = groupId;
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

