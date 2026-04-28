import apiResponse from "../../utility/apiResponse.js";
import mongoose from "mongoose";
import CashToBankConversion from "../../model/CashToBankConversion.js";
import RecoveryMaster from "../../model/RecoveryMaster.js";
import { GroupMaster } from "../../model/index.js";
import BankMaster from "../../model/BankMaster.js";
import { createBankTransactionRecord } from "../../utility/bankTransactionHelper.js";
import { createCashTransactionRecord } from "../../utility/cashTransactionHelper.js";
import { postJournal } from "../../service/journalPostingService.js";
import { getCashBankTransferLines } from "../../utility/accountHeadMap.js";

// Create conversion request - supports cash_to_bank and bank_to_bank conversions
export const createConversion = async (req, res) => {
    try {
        const { groupId, bankId, fromBankId, onlineRef, isAdmin, amount, conversionType = "cash_to_bank" } = req.body;
        // Payment image path - multer saves to uploads/members
        const paymentImage = req.file ? `/uploads/members/${req.file.filename}` : null;

        // Validate conversion type
        if (!["cash_to_bank", "bank_to_bank"].includes(conversionType)) {
            return apiResponse.error(res, "Invalid conversion type. Must be 'cash_to_bank' or 'bank_to_bank'", 400);
        }

        // Validate required fields
        if (!groupId) {
            return apiResponse.error(res, "groupId is required", 400);
        }

        if (conversionType === "cash_to_bank" && !bankId) {
            return apiResponse.error(res, "bankId (destination bank) is required for cash_to_bank conversion", 400);
        }

        if (conversionType === "bank_to_bank") {
            if (!fromBankId || !bankId) {
                return apiResponse.error(res, "fromBankId (source bank) and bankId (destination bank) are required for bank_to_bank conversion", 400);
            }
            if (fromBankId === bankId) {
                return apiResponse.error(res, "Source bank and destination bank cannot be the same", 400);
            }
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

        // Verify destination bank exists and belongs to group
        const toBank = await BankMaster.findById(bankId);
        if (!toBank) {
            return apiResponse.error(res, "Destination bank account not found", 404);
        }

        // Check if destination bank belongs to group
        const toBankBelongsToGroup = toBank.group_id?.toString() === groupId ||
            (group.bankmasters && group.bankmasters.some(b => b.toString() === bankId));

        if (!toBankBelongsToGroup) {
            return apiResponse.error(res, "Destination bank account does not belong to this group", 400);
        }

        let fromBank = null;
        if (conversionType === "bank_to_bank") {
            // Verify source bank exists and belongs to group
            fromBank = await BankMaster.findById(fromBankId);
            if (!fromBank) {
                return apiResponse.error(res, "Source bank account not found", 404);
            }

            // Check if source bank belongs to group
            const fromBankBelongsToGroup = fromBank.group_id?.toString() === groupId ||
                (group.bankmasters && group.bankmasters.some(b => b.toString() === fromBankId));

            if (!fromBankBelongsToGroup) {
                return apiResponse.error(res, "Source bank account does not belong to this group", 400);
            }

            // Validate source bank balance
            await fromBank.recalculateBalance();
            const sourceBankBalance = fromBank.current_balance || 0;
            if (sourceBankBalance < conversionAmount) {
                return apiResponse.error(res, `Insufficient source bank balance. Available: ₹${sourceBankBalance.toFixed(2)}, Required: ₹${conversionAmount.toFixed(2)}`, 400);
            }
        }

        // Check if there's already a pending or approved conversion for this group
        const existingConversion = await CashToBankConversion.findOne({
            groupId: groupId,
            status: { $in: ["pending", "approved"] }
        });

        if (existingConversion) {
            return apiResponse.error(res, "A conversion request already exists for this group. Please process or reject the existing request first.", 400);
        }

        // Validate cash balance for cash_to_bank
        if (conversionType === "cash_to_bank") {
            await group.recalculateCashBalance();
            const cashBalance = group.current_cash_balance || 0;
            if (cashBalance < conversionAmount) {
                return apiResponse.error(res, `Insufficient cash balance. Available: ₹${cashBalance.toFixed(2)}, Required: ₹${conversionAmount.toFixed(2)}`, 400);
            }
        }

        // Always set to pending - admin approvals go through approval management
        const status = "pending";
        const requestedBy = isAdmin === true ? (req.user?.id || "admin") : "group";

        // Create conversion record
        const conversionData = {
            groupId: group._id,
            groupName: group.group_name,
            groupCode: group.group_code,
            conversionType,
            recoveryIds: [], // Empty - not tied to specific recoveries
            recoveryId: null, // Not tied to specific recovery
            recoveryDate: new Date(), // Use current date
            totalCashAmount: conversionAmount,
            bankId: toBank._id,
            bankName: toBank.bank_name,
            accountNumber: toBank.account_no,
            paymentImage,
            onlineRef: onlineRef || null,
            status,
            requestedBy,
            conversionDetails: [], // Empty - not tracking specific member conversions
        };

        // Add source bank details for bank_to_bank
        if (conversionType === "bank_to_bank" && fromBank) {
            conversionData.fromBankId = fromBank._id;
            conversionData.fromBankName = fromBank.bank_name;
            conversionData.fromAccountNumber = fromBank.account_no;
        }

        const conversion = await CashToBankConversion.create(conversionData);

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
            .populate("fromBankId", "bank_name account_no branch_name ifsc")
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
            .populate("fromBankId", "bank_name account_no branch_name ifsc")
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

    const conversionType = conversion.conversionType || "cash_to_bank";

    if (conversionType === "cash_to_bank") {
        // Cash to Bank: Debit cash, Credit destination bank
        if (transactionAmount > 0 && conversion.bankId) {
            // Create bank transaction (credit - money coming into bank)
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
    } else if (conversionType === "bank_to_bank") {
        // Bank to Bank: Debit source bank, Credit destination bank
        if (transactionAmount > 0 && conversion.fromBankId && conversion.bankId) {
            // Create debit transaction on source bank (money going out)
            await createBankTransactionRecord({
                bankId: conversion.fromBankId,
                groupId: conversion.groupId,
                transactionType: "bank_to_bank",
                amount: transactionAmount,
                date: conversion.createdAt || new Date(),
                onlineRef: conversion.onlineRef || null,
                receipt: conversion.paymentImage || null,
                description: `Bank to Bank Transfer - From ${conversion.fromBankName} to ${conversion.bankName} - Amount: ₹${transactionAmount}`,
                cashToBankId: conversion._id,
                createdBy: processedBy || "admin",
                status: "verified",
                isDebit: true, // This is a debit transaction (money going out)
            });

            // Create credit transaction on destination bank (money coming in)
            await createBankTransactionRecord({
                bankId: conversion.bankId,
                groupId: conversion.groupId,
                transactionType: "bank_to_bank",
                amount: transactionAmount,
                date: conversion.createdAt || new Date(),
                onlineRef: conversion.onlineRef || null,
                receipt: conversion.paymentImage || null,
                description: `Bank to Bank Transfer - From ${conversion.fromBankName} to ${conversion.bankName} - Amount: ₹${transactionAmount}`,
                cashToBankId: conversion._id,
                createdBy: processedBy || "admin",
                status: "verified",
                isDebit: false, // This is a credit transaction (money coming in)
            });
        }
    }

    const journalSession = await mongoose.startSession();
    try {
        await journalSession.withTransaction(async () => {
            const { entryId } = await postJournal({
                groupId: conversion.groupId,
                date: conversion.createdAt || new Date(),
                sourceType: "CASH_BANK",
                sourceId: conversion._id,
                lines: getCashBankTransferLines({
                    amount: transactionAmount,
                    conversionType,
                    sourceBankId: conversion.fromBankId || undefined,
                    destinationBankId: conversion.bankId || undefined,
                    notes: `Conversion ${conversionType}`,
                }),
                createdBy: processedBy || "admin",
                session: journalSession,
            });
            conversion.journalEntryId = entryId;
            conversion.status = "processed";
            conversion.processedAt = new Date();
            await conversion.save({ session: journalSession });
        });
    } finally {
        await journalSession.endSession();
    }

    // Update conversion status
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
            .populate("fromBankId")
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

