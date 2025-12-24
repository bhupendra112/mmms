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
            interest: { type: Number, default: 0 }, // Interest on loan
            yogdan: { type: Number, default: 0 }, // Yogdan (when loan is given)
            memFeesSHG: { type: Number, default: 0 }, // Member Fees SHG (Yearly)
            memFeesSamiti: { type: Number, default: 0 }, // Member Fees Samiti (Yearly)
            penalty: { type: Number, default: 0 },
            other: { type: Number, default: 0 },
            fd: { type: Number, default: 0 }, // FD is separate, not part of auto-calculation
        },
        fd_time_period: { type: Number }, // Time period in months for new FD deposits
        fd_rate_snapshot: { type: Number }, // Snapshot of fd_rate from group at time of FD creation
        paymentMode: {
            cash: { type: Boolean, default: false },
            online: { type: Boolean, default: false },
        },
        onlineRef: { type: String },
        screenshot: { type: String }, // base64 or URL
        total: { type: Number, default: 0 },
        // Demand details for tracking previous/current demands and balances
        demandDetails: {
            loan: {
                prevDemand: { type: Number, default: 0 },      // Previous month unpaid
                currDemand: { type: Number, default: 0 },      // Current month installment
                totalDemand: { type: Number, default: 0 },     // prev + curr
                actualPaid: { type: Number, default: 0 },      // Amount received
                unpaidDemand: { type: Number, default: 0 },    // total - actual
                openingBalance: { type: Number, default: 0 }, // Cumulative loan paid till now
                closingBalance: { type: Number, default: 0 }, // opening + actual
            },
            interest: {
                prevDemand: { type: Number, default: 0 },
                currDemand: { type: Number, default: 0 },
                totalDemand: { type: Number, default: 0 },
                actualPaid: { type: Number, default: 0 },
                unpaidDemand: { type: Number, default: 0 },
                openingBalance: { type: Number, default: 0 },
                closingBalance: { type: Number, default: 0 },
            },
            saving: {
                prevDemand: { type: Number, default: 0 },
                currDemand: { type: Number, default: 0 },
                totalDemand: { type: Number, default: 0 },
                actualPaid: { type: Number, default: 0 },
                unpaidDemand: { type: Number, default: 0 },
                openingBalance: { type: Number, default: 0 },
                closingBalance: { type: Number, default: 0 },
            },
            fd: {
                prevDemand: { type: Number, default: 0 },
                currDemand: { type: Number, default: 0 },
                totalDemand: { type: Number, default: 0 },
                actualPaid: { type: Number, default: 0 },
                unpaidDemand: { type: Number, default: 0 },
                openingBalance: { type: Number, default: 0 },
                closingBalance: { type: Number, default: 0 },
            },
        },
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

