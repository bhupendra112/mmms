import mongoose from "mongoose";

const CashToBankConversionSchema = new mongoose.Schema({
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GroupMaster",
        required: true,
    },
    groupName: { type: String, required: true },
    groupCode: { type: String },

    // Conversion type
    conversionType: {
        type: String,
        enum: ["cash_to_bank", "bank_to_bank"],
        required: true,
        default: "cash_to_bank", // Default for backward compatibility
    },

    // Recovery session references (can be multiple for bulk conversion)
    recoveryIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "RecoveryMaster",
    }],
    // Keep single recoveryId for backward compatibility (optional)
    recoveryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "RecoveryMaster",
        required: false,
    },
    recoveryDate: { type: Date }, // Optional for bulk conversions

    // Conversion details
    totalCashAmount: { type: Number, required: true }, // Total amount to convert
    // Destination bank (for both cash_to_bank and bank_to_bank)
    bankId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BankMaster",
        required: function() {
            return this.conversionType === "cash_to_bank" || this.conversionType === "bank_to_bank";
        },
    },
    bankName: { type: String, required: function() {
        return this.conversionType === "cash_to_bank" || this.conversionType === "bank_to_bank";
    }},
    accountNumber: { type: String },
    // Source bank (for bank_to_bank only)
    fromBankId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BankMaster",
        required: function() {
            return this.conversionType === "bank_to_bank";
        },
    },
    fromBankName: { type: String },
    fromAccountNumber: { type: String },
    paymentImage: { type: String }, // Path to uploaded image
    onlineRef: { type: String }, // Optional reference number

    // Status tracking
    status: {
        type: String,
        enum: ["pending", "approved", "rejected", "processed"],
        default: "pending",
    },

    // Request tracking
    requestedBy: { type: String }, // User ID or "group"
    approvedBy: { type: String }, // Admin user ID
    approvedAt: { type: Date },
    processedAt: { type: Date },
    rejectionReason: { type: String },
    journalEntryId: { type: String },

    // Member-level conversion details (optional, for tracking)
    conversionDetails: [{
        memberId: { type: String },
        memberCode: { type: String },
        memberName: { type: String },
        cashAmount: { type: Number },
        bankAmount: { type: Number },
    }],

}, {
    timestamps: true,
});

// Index for efficient queries
CashToBankConversionSchema.index({ groupId: 1, status: 1 });
CashToBankConversionSchema.index({ recoveryId: 1 });
CashToBankConversionSchema.index({ recoveryIds: 1 });
CashToBankConversionSchema.index({ status: 1 });

export default mongoose.model("CashToBankConversion", CashToBankConversionSchema);

