import mongoose from "mongoose";

const CashTransactionSchema = new mongoose.Schema({
    // Group reference
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GroupMaster",
        required: true,
    },
    groupName: { type: String, required: true },
    groupCode: { type: String },

    // Transaction type
    transactionType: {
        type: String,
        enum: [
            "fd",              // FD creation (cash payment)
            "recovery",        // Recovery/Saving collection (cash receipt)
            "loan",            // Loan providing (cash payment)
            "expense",         // Expense payment (cash payment)
            "payment",         // Payment (FD maturity, saving withdrawal) (cash payment)
            "bank_to_cash",    // Bank to cash conversion (cash receipt)
            "other"            // Other cash transactions
        ],
        required: true,
    },

    // Transaction details
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true, default: Date.now },
    description: { type: String }, // Additional description/remarks

    // Receipt/Screenshot
    receipt: { type: String }, // base64 or URL path to receipt image
    receiptFileName: { type: String }, // Original filename if uploaded

    // References to related transactions (optional, for linking)
    // Only one of these will be populated based on transactionType
    fdId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "FDMaster",
    },
    recoveryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "RecoveryMaster",
    },
    recoveryMemberId: { type: String }, // Member ID from recovery if specific member
    loanId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "LoanMaster",
    },
    expenseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ExpenseMaster",
    },
    paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PaymentMaster",
    },
    cashToBankId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CashToBankConversion",
    },

    // Member details (if applicable)
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Member",
    },
    memberCode: { type: String },
    memberName: { type: String },

    // Status
    status: {
        type: String,
        enum: ["pending", "verified", "rejected"],
        default: "verified", // Cash transactions are typically verified immediately
    },

    // Created by
    createdBy: { type: String }, // Admin user ID or "admin"

    // Verification
    verifiedBy: { type: String },
    verifiedAt: { type: Date },
    rejectedBy: { type: String },
    rejectedAt: { type: Date },
    rejectionReason: { type: String },

}, {
    timestamps: true,
});

// Indexes for efficient queries
CashTransactionSchema.index({ groupId: 1, date: -1 });
CashTransactionSchema.index({ transactionType: 1, date: -1 });
CashTransactionSchema.index({ fdId: 1 });
CashTransactionSchema.index({ recoveryId: 1 });
CashTransactionSchema.index({ loanId: 1 });
CashTransactionSchema.index({ expenseId: 1 });
CashTransactionSchema.index({ paymentId: 1 });
CashTransactionSchema.index({ memberId: 1 });
CashTransactionSchema.index({ status: 1 });

export default mongoose.model("CashTransaction", CashTransactionSchema);

