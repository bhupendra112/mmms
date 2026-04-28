import mongoose from "mongoose";

const LoanMasterSchema = new mongoose.Schema({
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GroupMaster",
        required: true,
    },
    groupName: { type: String, required: true },
    groupCode: { type: String },

    // Member details (null for group loans)
    memberId: { type: String },
    memberCode: { type: String },
    memberName: { type: String },

    // Loan details
    hasAssets: { type: Boolean, default: false },
    isGroupLoan: { type: Boolean, default: false },
    transactionType: { type: String, required: true }, // Loan, Saving, FD, Deposit, Expense, Other
    paymentMode: { type: String, required: true }, // Cash, Bank
    bankId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BankMaster",
        required: false, // Optional - only required when paymentMode is "Bank"
    },
    purpose: { type: String },
    /** Set for member loans; optional for legacy documents */
    voucherNumber: { type: Number },
    journalEntryId: { type: String },
    amount: { type: Number, required: true },
    time_period: { type: Number }, // Loan duration in months (stored internally, but accepted in years from frontend)
    installment_amount: { type: Number }, // Monthly installment amount
    loan_rate_snapshot: { type: Number }, // Snapshot of loan_rate from group at time of loan creation
    yogdanAmount: { type: Number, default: 0 }, // 1% of loan amount - to be collected in recovery
    yogdanCollected: { type: Boolean, default: false }, // Track if yogdan has been collected for this loan
    bachanPathraPhoto: { type: String }, // base64 or URL
    date: { type: Date, required: true },

    // Status (pending for group requests, approved/rejected by admin)
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    createdBy: { type: String }, // Admin user ID, "admin", or group user ID
    approvedBy: { type: String }, // Admin who approved (if from group panel)
    approvedAt: { type: Date },
    rejectedBy: { type: String },
    rejectedAt: { type: Date },
    rejectionReason: { type: String },

}, {
    timestamps: true,
});

LoanMasterSchema.index(
    { groupId: 1, voucherNumber: 1 },
    {
        unique: true,
        partialFilterExpression: {
            voucherNumber: { $exists: true, $type: "number" },
        },
    }
);

export default mongoose.model("LoanMaster", LoanMasterSchema);

