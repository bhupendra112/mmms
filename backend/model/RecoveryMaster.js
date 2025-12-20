import mongoose from "mongoose";

const RecoveryMasterSchema = new mongoose.Schema({
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GroupMaster",
        required: true,
    },
    groupName: { type: String, required: true },
    groupCode: { type: String },
    
    // Recovery session details
    date: { type: Date, required: true },
    memberCount: { type: Number, default: 0 },
    groupPhoto: { type: String }, // base64 or URL
    
    // Individual member recoveries
    recoveries: [{
        memberId: { type: String, required: true },
        memberCode: { type: String, required: true },
        memberName: { type: String, required: true },
        attendance: { type: String, enum: ["present", "absent"], default: "present" },
        recoveryByOther: { type: Boolean, default: false },
        otherMemberId: { type: String },
        amounts: {
            saving: { type: Number, default: 0 },
            loan: { type: Number, default: 0 },
            fd: { type: Number, default: 0 },
            interest: { type: Number, default: 0 },
            yogdan: { type: Number, default: 0 }, // Yogdan tracking
            other: { type: Number, default: 0 },
        },
        paymentMode: {
            cash: { type: Boolean, default: false },
            online: { type: Boolean, default: false },
        },
        onlineRef: { type: String },
        screenshot: { type: String }, // base64 or URL
        total: { type: Number, default: 0 },
    }],
    
    // Totals
    totals: {
        totalCash: { type: Number, default: 0 },
        totalOnline: { type: Number, default: 0 },
        totalAmount: { type: Number, default: 0 },
    },
    
    // Status (for admin direct storage, always approved)
    status: { type: String, enum: ["approved", "rejected"], default: "approved" },
    createdBy: { type: String }, // Admin user ID or "admin"
    
}, {
    timestamps: true,
});

export default mongoose.model("RecoveryMaster", RecoveryMasterSchema);

