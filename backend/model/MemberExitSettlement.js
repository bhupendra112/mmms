import mongoose from "mongoose";

const MemberExitSettlementSchema = new mongoose.Schema(
    {
        memberId: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
        groupId: { type: mongoose.Schema.Types.ObjectId, ref: "GroupMaster", required: true },
        heads: { type: Object, required: true },
        totalPayoutToMember: { type: Number, required: true, default: 0 },
        totalDuesFromMember: { type: Number, required: true, default: 0 },
        netAmount: { type: Number, required: true },
        direction: { type: String, enum: ["MEMBER_PAYS", "GROUP_PAYS", "SETTLED"], required: true },
        paymentMode: {
            type: String,
            enum: ["ONLINE", "OFFLINE", "NONE", "Cash", "Bank"],
            default: "NONE",
        },
        paymentReference: { type: String, default: "" },
        paymentDate: { type: Date },
        paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "PaymentMaster" },
        notes: { type: String, default: "" },
        createdBy: { type: String, default: "system" },
    },
    { timestamps: true }
);

MemberExitSettlementSchema.index({ memberId: 1, groupId: 1 });

export default mongoose.model("MemberExitSettlement", MemberExitSettlementSchema);