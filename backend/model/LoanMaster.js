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
    amount: { type: Number, required: true },
    time_period: { type: Number }, // Loan duration in months
    installment_amount: { type: Number }, // Monthly installment amount
    loan_rate_snapshot: { type: Number }, // Snapshot of loan_rate from group at time of loan creation
    bachanPathraPhoto: { type: String }, // base64 or URL
    date: { type: Date, required: true },

    // Status (for admin direct storage, always approved)
    status: { type: String, enum: ["approved", "rejected"], default: "approved" },
    createdBy: { type: String }, // Admin user ID or "admin"

}, {
    timestamps: true,
});

export default mongoose.model("LoanMaster", LoanMasterSchema);

