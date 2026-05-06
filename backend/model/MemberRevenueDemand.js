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
        enum: ["membership_fees_shg", "membership_fees_group", "yogdan", "penalty"],
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
        default: false,
    },
    year: {
        type: String,
        required: true,
    },
    notes: {
        type: String,
        default: "",
    },
    recoveryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "RecoveryMaster",
        default: null,
    },
    loanId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "LoanMaster",
        default: null,
    },
    meetingKey: {
        type: String,
        default: undefined,
    },
}, {
    timestamps: true,
});

MemberRevenueDemandSchema.index({ memberId: 1, groupId: 1, revenueType: 1, year: 1 });
MemberRevenueDemandSchema.index({ memberId: 1, isPaid: 1 });
MemberRevenueDemandSchema.index({ groupId: 1, year: 1, isPaid: 1 });

MemberRevenueDemandSchema.index(
    { memberId: 1, groupId: 1, revenueType: 1, demandDate: 1 },
    {
        unique: true,
        partialFilterExpression: { revenueType: "penalty" },
    }
);
MemberRevenueDemandSchema.index(
    { memberId: 1, groupId: 1, revenueType: 1, year: 1, isAnnualDemand: 1 },
    {
        unique: true,
        partialFilterExpression: { isAnnualDemand: true },
    }
);
MemberRevenueDemandSchema.index(
    { memberId: 1, groupId: 1, revenueType: 1, isAnnualDemand: 1 },
    {
        unique: true,
        partialFilterExpression: { isAnnualDemand: false },
    }
);

export default mongoose.model("MemberRevenueDemand", MemberRevenueDemandSchema);
