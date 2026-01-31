import mongoose from "mongoose";

const GroupLedgerSchema = new mongoose.Schema({
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GroupMaster",
        required: true,
    },
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Member",
        required: false, // Optional - only for member-specific transactions
    },

    // Head classification
    headType: {
        type: String,
        enum: ["groupMaster", "expenseMaster"],
        required: true,
    },
    headId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true, // References GroupMaster.charges._id or ExpenseMaster._id
    },
    headName: {
        type: String,
        required: true, // Normalized head name for backward compatibility and mapping
    },

    // Accounting section
    section: {
        type: String,
        enum: ["income", "expense", "assets", "liability"],
        required: true,
    },

    // Transaction direction
    direction: {
        type: String,
        enum: ["in", "out"],
        required: true, // "in" = inflow/receipt, "out" = outflow/payment
    },

    // Transaction details
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    date: {
        type: Date,
        required: true,
    },
    notes: {
        type: String,
        default: "",
    },

    // Reference to source document
    referenceModel: {
        type: String,
        required: true, // e.g., "RecoveryMaster", "LoanMaster", "FDMaster", "PaymentMaster", "ExpenseMaster"
    },
    referenceId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true, // ID of source document
    },

    // Payment details
    paymentMode: {
        type: String,
        enum: ["Cash", "Bank"],
        required: false,
    },
    bankId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BankMaster",
        required: false,
    },

    // Audit
    createdBy: {
        type: String,
        default: "system",
    },
}, {
    timestamps: true,
});

// Indexes for efficient queries
GroupLedgerSchema.index({ groupId: 1, date: 1 });
GroupLedgerSchema.index({ groupId: 1, headId: 1 });
GroupLedgerSchema.index({ memberId: 1, date: 1 });
GroupLedgerSchema.index({ referenceModel: 1, referenceId: 1 }); // For deduplication
GroupLedgerSchema.index({ section: 1, date: 1 });
GroupLedgerSchema.index({ groupId: 1, section: 1, date: 1 }); // For financial reports

// Unique index only for non-RecoveryMaster (one entry per reference). RecoveryMaster has multiple entries per recovery.
GroupLedgerSchema.index(
    { referenceModel: 1, referenceId: 1 },
    { unique: true, sparse: true, partialFilterExpression: { referenceModel: { $ne: "RecoveryMaster" } } }
);

export default mongoose.model("GroupLedger", GroupLedgerSchema);
