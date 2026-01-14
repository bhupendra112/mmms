import mongoose from "mongoose";

const MemberRevenueDemandSchema = new mongoose.Schema({
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Member",
        required: true,
    },
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GroupMaster",
        required: true,
    },
    revenueType: {
        type: String,
        enum: ["membership_fees_shg", "membership_fees_group", "yogdan"],
        required: true,
    },
    amount: {
        type: Number,
        required: true,
        default: 0,
    },
    demandDate: {
        type: Date,
        required: true,
    },
    paidDate: {
        type: Date,
        default: null,
    },
    paidAmount: {
        type: Number,
        default: 0,
    },
    isPaid: {
        type: Boolean,
        default: false,
    },
    isAnnualDemand: {
        type: Boolean,
        default: false, // false for new member registration, true for April annual demand
    },
    year: {
        type: String, // Financial year format: "2024-25" (April to April)
        required: true,
    },
    notes: {
        type: String,
        default: "",
    },
    // Reference to recovery session where payment was made
    recoveryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "RecoveryMaster",
        default: null,
    },
    // Reference to loan if this is yogdan
    loanId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "LoanMaster",
        default: null,
    },
}, {
    timestamps: true,
});

// Index for efficient queries
MemberRevenueDemandSchema.index({ memberId: 1, groupId: 1, revenueType: 1, year: 1 });
MemberRevenueDemandSchema.index({ memberId: 1, isPaid: 1 });
MemberRevenueDemandSchema.index({ groupId: 1, year: 1, isPaid: 1 });

export default mongoose.model("MemberRevenueDemand", MemberRevenueDemandSchema);
