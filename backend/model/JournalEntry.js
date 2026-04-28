import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

const JournalEntrySchema = new mongoose.Schema(
    {
        entryId: {
            type: String,
            unique: true,
            immutable: true,
            default: () => randomUUID(),
        },
        voucherNo: {
            type: String,
            required: true,
        },
        voucherNumber: {
            type: Number,
        },
        groupId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "GroupMaster",
            required: true,
        },
        date: {
            type: Date,
            required: true,
        },
        sourceType: {
            type: String,
            enum: ["LOAN", "RECOVERY", "PAYMENT", "CASH_BANK", "JV_MANUAL"],
            required: true,
        },
        sourceId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        status: {
            type: String,
            enum: ["DRAFT", "POSTED", "REVERSED"],
            default: "POSTED",
        },
        totalDebit: {
            type: Number,
            required: true,
            min: 0,
        },
        totalCredit: {
            type: Number,
            required: true,
            min: 0,
        },
        createdBy: {
            type: String,
            default: "system",
        },
    },
    { timestamps: true }
);

JournalEntrySchema.index({ entryId: 1 }, { unique: true });
JournalEntrySchema.index({ groupId: 1, date: -1 });
JournalEntrySchema.index({ sourceType: 1, sourceId: 1 });
JournalEntrySchema.index(
    { groupId: 1, voucherNumber: 1 },
    {
        unique: true,
        partialFilterExpression: {
            voucherNumber: { $exists: true, $type: "number" },
        },
    }
);

export default mongoose.model("JournalEntry", JournalEntrySchema);
