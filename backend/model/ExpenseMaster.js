import mongoose from "mongoose";

const ExpenseMasterSchema = new mongoose.Schema({
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GroupMaster",
        required: true,
    },
    groupName: { type: String, required: true },
    groupCode: { type: String },

    // Expense details
    expenseType: {
        type: String,
        required: true, // Allow any expense type name to be entered manually
    },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true },
    paymentMode: {
        type: String,
        enum: ["Cash", "Bank"],
        required: true,
    },
    bankId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BankMaster",
        required: false, // Optional - only required when paymentMode is "Bank"
    },
    purpose: { type: String }, // Description/remarks

    // Created by
    createdBy: { type: String }, // Admin user ID or "admin"

}, {
    timestamps: true,
});

// Indexes for efficient queries
ExpenseMasterSchema.index({ groupId: 1, date: 1 });
ExpenseMasterSchema.index({ expenseType: 1 });
ExpenseMasterSchema.index({ date: 1 });

export default mongoose.model("ExpenseMaster", ExpenseMasterSchema);

