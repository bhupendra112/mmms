import apiResponse from "../../utility/apiResponse.js";
import CashToBankConversion from "../../model/CashToBankConversion.js";
import RecoveryMaster from "../../model/RecoveryMaster.js";
import { GroupMaster } from "../../model/index.js";
import BankMaster from "../../model/BankMaster.js";
import { createBankTransactionRecord } from "../../utility/bankTransactionHelper.js";
import { createCashTransactionRecord } from "../../utility/cashTransactionHelper.js";

// Create conversion request - converts ALL cash payments from ALL recovery sessions for a group
export const createConversion = async (req, res) => {
    try {
        const { groupId, bankId, onlineRef, isAdmin, amount } = req.body;
        // Payment image path - multer saves to uploads/members
        const paymentImage = req.file ? `/uploads/members/${req.file.filename}` : null;

        // Validate required fields
        if (!groupId || !bankId) {
            return apiResponse.error(res, "groupId and bankId are required", 400);
        }

        // Validate amount
        const conversionAmount = parseFloat(amount);
        if (!amount || isNaN(conversionAmount) || conversionAmount <= 0) {
            return apiResponse.error(res, "Amount must be greater than 0", 400);
        }

        // Validate payment image is provided
        if (!paymentImage) {
            return apiResponse.error(res, "Payment screenshot/image is required", 400);
        }

        // Verify group exists
        const group = await GroupMaster.findById(groupId);
        if (!group) {
            return apiResponse.error(res, "Group not found", 404);
        }

        // Verify bank exists and belongs to group
        const bank = await BankMaster.findById(bankId);
        if (!bank) {
            return apiResponse.error(res, "Bank account not found", 404);
        }

        // Check if bank belongs to group (either through group_id or bankmasters array)
        const bankBelongsToGroup = bank.group_id?.toString() === groupId ||
            (group.bankmasters && group.bankmasters.some(b => b.toString() === bankId));

        if (!bankBelongsToGroup) {
            return apiResponse.error(res, "Bank account does not belong to this group", 400);
        }

        // Check if there's already a pending or approved conversion for this group
        const existingConversion = await CashToBankConversion.findOne({
            groupId: groupId,
            status: { $in: ["pending", "approved"] }
        });

        if (existingConversion) {
            return apiResponse.error(res, "A conversion request already exists for this group. Please process or reject the existing request first.", 400);
        }

        // Validate cash balance
        await group.recalculateCashBalance();
        const cashBalance = group.current_cash_balance || 0;
        if (cashBalance < conversionAmount) {
            return apiResponse.error(res, `Insufficient cash balance. Available: ₹${cashBalance.toFixed(2)}, Required: ₹${conversionAmount.toFixed(2)}`, 400);
        }

        // Always set to pending - admin approvals go through approval management
        const status = "pending";
        const requestedBy = isAdmin === true ? (req.user?.id || "admin") : "group";

        // Create conversion record
        const conversion = await CashToBankConversion.create({
            groupId: group._id,
            groupName: group.group_name,
            groupCode: group.group_code,
            recoveryIds: [], // Empty - not tied to specific recoveries
            recoveryId: null, // Not tied to specific recovery
            recoveryDate: new Date(), // Use current date
            totalCashAmount: conversionAmount,
            bankId: bank._id,
            bankName: bank.bank_name,
            accountNumber: bank.account_no,
            paymentImage,
            onlineRef: onlineRef || null,
            status,
            requestedBy,
            conversionDetails: [], // Empty - not tracking specific member conversions
        });

        // No auto-processing - all conversions go through approval workflow
        return apiResponse.success(res, "Conversion request created successfully. Pending admin approval.", conversion);

    } catch (error) {
        console.error("Error creating conversion:", error);
        return apiResponse.error(res, error.message, 500);
    }
};

// List conversions with filters
export const listConversions = async (req, res) => {
    try {
        const { groupId, status, fromDate, toDate } = req.query;

        const filter = {};
        if (groupId) filter.groupId = groupId;
        if (status) filter.status = status;

        if (fromDate || toDate) {
            filter.recoveryDate = {};
            if (fromDate) filter.recoveryDate.$gte = new Date(fromDate);
            if (toDate) filter.recoveryDate.$lte = new Date(toDate);
        }

        const conversions = await CashToBankConversion.find(filter)
            .populate("recoveryId", "date memberCount")
            .populate("recoveryIds", "date memberCount")
            .populate("bankId", "bank_name account_no branch_name ifsc")
            .sort({ createdAt: -1 });

        return apiResponse.success(res, "Conversions retrieved successfully", conversions);

    } catch (error) {
        console.error("Error listing conversions:", error);
        return apiResponse.error(res, error.message, 500);
    }
};

// Get pending conversions
export const getPendingConversions = async (req, res) => {
    try {
        const conversions = await CashToBankConversion.find({ status: "pending" })
            .populate("recoveryId", "date memberCount")
            .populate("recoveryIds", "date memberCount")
            .populate("bankId", "bank_name account_no branch_name ifsc")
            .populate("groupId", "group_name group_code")
            .sort({ createdAt: -1 });

        return apiResponse.success(res, "Pending conversions retrieved successfully", conversions);

    } catch (error) {
        console.error("Error getting pending conversions:", error);
        return apiResponse.error(res, error.message, 500);
    }
};

// Approve conversion
export const approveConversion = async (req, res) => {
    try {
        const { id } = req.params;
        const approvedBy = req.user?.id || "admin";

        const conversion = await CashToBankConversion.findById(id);
        if (!conversion) {
            return apiResponse.error(res, "Conversion not found", 404);
        }

        if (conversion.status !== "pending") {
            return apiResponse.error(res, `Conversion is already ${conversion.status}`, 400);
        }

        conversion.status = "approved";
        conversion.approvedBy = approvedBy;
        conversion.approvedAt = new Date();
        await conversion.save();

        // Process the conversion
        await processConversionInternal(conversion._id, approvedBy);
        const updatedConversion = await CashToBankConversion.findById(conversion._id);

        return apiResponse.success(res, "Conversion approved and processed successfully", updatedConversion);

    } catch (error) {
        console.error("Error approving conversion:", error);
        return apiResponse.error(res, error.message, 500);
    }
};

// Reject conversion
export const rejectConversion = async (req, res) => {
    try {
        const { id } = req.params;
        const { rejectionReason } = req.body;
        const rejectedBy = req.user?.id || "admin";

        const conversion = await CashToBankConversion.findById(id);
        if (!conversion) {
            return apiResponse.error(res, "Conversion not found", 404);
        }

        if (conversion.status !== "pending") {
            return apiResponse.error(res, `Conversion is already ${conversion.status}`, 400);
        }

        conversion.status = "rejected";
        conversion.approvedBy = rejectedBy;
        conversion.approvedAt = new Date();
        conversion.rejectionReason = rejectionReason || "No reason provided";
        await conversion.save();

        return apiResponse.success(res, "Conversion rejected successfully", conversion);

    } catch (error) {
        console.error("Error rejecting conversion:", error);
        return apiResponse.error(res, error.message, 500);
    }
};

// Process conversion (internal function) - processes the conversion amount
const processConversionInternal = async (conversionId, processedBy) => {
    const conversion = await CashToBankConversion.findById(conversionId);
    if (!conversion) {
        throw new Error("Conversion not found");
    }

    if (conversion.status !== "approved") {
        throw new Error(`Conversion must be approved before processing. Current status: ${conversion.status}`);
    }

    // Use the conversion amount directly (not tied to recoveries)
    const transactionAmount = conversion.totalCashAmount || 0;

    if (transactionAmount <= 0) {
        throw new Error("Invalid conversion amount");
    }

    // Create bank transaction for cash to bank conversion
    if (transactionAmount > 0 && conversion.bankId) {
        await createBankTransactionRecord({
            bankId: conversion.bankId,
            groupId: conversion.groupId,
            transactionType: "cash_to_bank",
            amount: transactionAmount,
            date: conversion.createdAt || new Date(),
            onlineRef: conversion.onlineRef || null,
            receipt: conversion.paymentImage || null,
            description: `Cash to Bank Conversion - Amount: ₹${transactionAmount}`,
            cashToBankId: conversion._id,
            createdBy: processedBy || "admin",
            status: "verified", // Set to verified since conversion is already approved
        });

        // Create cash transaction to debit cash (cash going out)
        // Note: We'll use "other" type for cash_to_bank as it's a debit
        await createCashTransactionRecord({
            groupId: conversion.groupId,
            transactionType: "other", // Debit transaction (cash going out)
            amount: transactionAmount,
            date: conversion.createdAt || new Date(),
            description: `Cash to Bank Conversion - Amount: ₹${transactionAmount}`,
            cashToBankId: conversion._id,
            createdBy: processedBy || "admin",
        });
    }

    // Update conversion status
    conversion.status = "processed";
    conversion.processedAt = new Date();
    await conversion.save();

    return conversion;
};

// Process conversion (public endpoint)
export const processConversion = async (req, res) => {
    try {
        const { id } = req.params;
        const processedBy = req.user?.id || "admin";

        const conversion = await processConversionInternal(id, processedBy);
        return apiResponse.success(res, "Conversion processed successfully", conversion);

    } catch (error) {
        console.error("Error processing conversion:", error);
        return apiResponse.error(res, error.message, 500);
    }
};

// Get conversion detail
export const getConversionDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const conversion = await CashToBankConversion.findById(id)
            .populate("recoveryId")
            .populate("recoveryIds")
            .populate("bankId")
            .populate("groupId", "group_name group_code");

        if (!conversion) {
            return apiResponse.error(res, "Conversion not found", 404);
        }

        return apiResponse.success(res, "Conversion detail retrieved successfully", conversion);

    } catch (error) {
        console.error("Error getting conversion detail:", error);
        return apiResponse.error(res, error.message, 500);
    }
};

