import mongoose from "mongoose";

const VoucherRangeSchema = new mongoose.Schema(
    {
        groupId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "GroupMaster",
            required: true,
            index: true,
        },
        startNumber: { type: Number, required: true },
        endNumber: { type: Number, required: true },
        priority: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

VoucherRangeSchema.index({ groupId: 1, isActive: 1 });
VoucherRangeSchema.index({ groupId: 1, priority: 1, createdAt: 1 });

export default mongoose.model("VoucherRange", VoucherRangeSchema);
