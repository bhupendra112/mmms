import mongoose from "mongoose";

const FDMasterSchema = new mongoose.Schema({
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Member",
        required: true,
    },
    memberCode: { type: String, required: true },
    memberName: { type: String, required: true },

    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GroupMaster",
        required: true,
    },
    groupName: { type: String, required: true },
    groupCode: { type: String },

    // FD Details
    amount: { type: Number, required: true, min: 0 },
    time_period: { type: Number, required: true, min: 1 }, // Time period in months
    fd_rate_snapshot: { type: Number, required: true }, // Snapshot of fd_rate from GroupMaster at time of creation

    // Dates
    date: { type: Date, required: true, default: Date.now }, // FD creation date
    maturityDate: { type: Date, required: true }, // Calculated: date + time_period months

    // Status
    status: {
        type: String,
        enum: ["active", "matured", "closed"],
        default: "active"
    },

    // Payment reference (when FD is paid out)
    paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PaymentMaster",
    },

    // Interest calculation (optional, can be calculated on the fly)
    interestAmount: { type: Number, default: 0 }, // Total interest earned
    maturityAmount: { type: Number }, // Principal + Interest at maturity

    // Payment mode
    paymentMode: {
        cash: { type: Boolean, default: false },
        online: { type: Boolean, default: false },
    },
    onlineRef: { type: String },

    // Created by
    createdBy: { type: String }, // Admin user ID or "admin"

}, {
    timestamps: true,
});

// Index for efficient queries
FDMasterSchema.index({ memberId: 1, status: 1 });
FDMasterSchema.index({ groupId: 1, status: 1 });
FDMasterSchema.index({ maturityDate: 1 });

export default mongoose.model("FDMaster", FDMasterSchema);

