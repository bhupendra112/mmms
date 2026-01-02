import mongoose from "mongoose";

const BankTransactionSchema = new mongoose.Schema({
    // Bank reference
    bankId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BankMaster",
        required: true,
    },
    bankName: { type: String, required: true },
    accountNo: { type: String, required: true },

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
            "fd",              // FD creation
            "recovery",        // Recovery/Saving collection
            "loan",            // Loan providing
            "expense",         // Expense payment
            "payment",         // Payment (FD maturity, saving withdrawal)
            "cash_to_bank",    // Cash to bank conversion
            "other"            // Other bank transactions
        ],
        required: true,
    },

    // Transaction details
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true, default: Date.now },
    onlineRef: { type: String }, // Online payment reference number
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
        default: "pending",
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
BankTransactionSchema.index({ bankId: 1, date: -1 });
BankTransactionSchema.index({ groupId: 1, date: -1 });
BankTransactionSchema.index({ transactionType: 1, date: -1 });
BankTransactionSchema.index({ fdId: 1 });
BankTransactionSchema.index({ recoveryId: 1 });
BankTransactionSchema.index({ loanId: 1 });
BankTransactionSchema.index({ expenseId: 1 });
BankTransactionSchema.index({ paymentId: 1 });
BankTransactionSchema.index({ memberId: 1 });
BankTransactionSchema.index({ status: 1 });

export default mongoose.model("BankTransaction", BankTransactionSchema);

