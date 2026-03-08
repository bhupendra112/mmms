import mongoose from "mongoose";

/**
 * Audit log for loan term edits and adjustments.
 * Never modifies past RecoveryMaster or ledger; forward-only adjustments.
 */
const LoanAdjustmentLogSchema = new mongoose.Schema({
    loanId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "LoanMaster",
        required: true,
    },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "GroupMaster" },
    memberId: { type: String, required: true },
    memberCode: { type: String },
    memberName: { type: String },

    /** Snapshot of loan before edit (date, amount, time_period, loan_rate_snapshot, installment_amount, etc.) */
    oldLoanSnapshot: { type: mongoose.Schema.Types.Mixed, required: true },

    /** Snapshot of loan after edit */
    newLoanSnapshot: { type: mongoose.Schema.Types.Mixed, required: true },

    /** Result of recalculateLoanState after update */
    systemRecalculation: {
        recalculatedPrincipalDue: { type: Number, default: 0 },
        recalculatedInterestDue: { type: Number, default: 0 },
        totalDue: { type: Number, default: 0 },
        totalPaid: { type: Number, default: 0 },
        overpayment: { type: Number, default: 0 },
        underpayment: { type: Number, default: 0 },
        outstanding: { type: Number, default: 0 },
        principalPaid: { type: Number, default: 0 },
        interestPaid: { type: Number, default: 0 },
    },

    /** When admin overrides system result */
    manualOverride: {
        amount: { type: Number },
        type: { type: String, enum: ["overpaid", "underpaid"] },
        reason: { type: String },
    },

    /** advance | refund | deficit | manual */
    actionTaken: {
        type: String,
        enum: ["advance", "refund", "deficit", "manual"],
        required: true,
    },

    /** When actionTaken is refund, reference to PaymentMaster */
    refundPaymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PaymentMaster",
    },

    /** Member credit (advance) to subtract from future demand - stored for demand sync */
    memberCredit: { type: Number, default: 0 },

    /** Deficit to add to future demand */
    deficitAmount: { type: Number, default: 0 },

    createdBy: { type: String, default: "admin" },
}, {
    timestamps: true,
});

LoanAdjustmentLogSchema.index({ loanId: 1 });
LoanAdjustmentLogSchema.index({ groupId: 1, memberId: 1 });
LoanAdjustmentLogSchema.index({ memberId: 1, createdAt: -1 });
LoanAdjustmentLogSchema.index({ loanId: 1, createdAt: -1 });

export default mongoose.model("LoanAdjustmentLog", LoanAdjustmentLogSchema);
