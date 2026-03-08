import mongoose from "mongoose";

const PaymentMasterSchema = new mongoose.Schema({
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Member",
        required: true,
    },
    memberCode: { type: String, required: true },
    memberName: { type: String, required: true },

    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GroupMaster",
        required: true,
    },
    groupName: { type: String, required: true },
    groupCode: { type: String },

    // Payment details
    paymentType: {
        type: String,
        enum: [
            "fd_maturity",
            "saving_withdrawal",
            // Member exit flows
            "member_exit_payout",
            "member_exit_recovery",
            // Loan edit: overpayment refund
            "loan_refund",
        ],
        required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    paymentMode: {
        type: String,
        enum: ["Cash", "Bank"],
        default: "Bank", // Default to Bank for backward compatibility
    },

    // Bank details (optional - only required when paymentMode is Bank)
    bankId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BankMaster",
        required: false, // Optional - only required when paymentMode is "Bank"
    },
    bankName: { type: String, required: false }, // Optional
    accountNo: { type: String, required: false }, // Optional

    // FD reference (if FD payment)
    fdId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "FDMaster",
    },

    // Status and workflow
    status: {
        type: String,
        enum: ["pending", "approved", "rejected", "completed"],
        default: "pending",
    },

    // Dates
    paymentDate: { type: Date, required: true, default: Date.now },

    // Approval workflow
    createdBy: { type: String }, // Admin user ID, "admin", or group user ID
    approvedBy: { type: String }, // Admin who approved (if from group panel)
    approvedAt: { type: Date },
    rejectedBy: { type: String },
    rejectedAt: { type: Date },
    rejectionReason: { type: String },

    // Completion
    completedBy: { type: String },
    completedAt: { type: Date },

    // Additional info
    remarks: { type: String },

}, {
    timestamps: true,
});

// Indexes for efficient queries
PaymentMasterSchema.index({ memberId: 1, status: 1 });
PaymentMasterSchema.index({ groupId: 1, status: 1 });
PaymentMasterSchema.index({ paymentType: 1, status: 1 });
PaymentMasterSchema.index({ fdId: 1 });
PaymentMasterSchema.index({ paymentDate: 1 });

export default mongoose.model("PaymentMaster", PaymentMasterSchema);

