import mongoose from "mongoose";

const JournalLineSchema = new mongoose.Schema(
    {
        entryId: {
            type: String,
            required: true,
            index: true,
        },
        accountHead: {
            type: String,
            required: true,
            trim: true,
        },
        accountHeadCode: {
            type: String,
            default: "",
        },
        debit: {
            type: Number,
            min: 0,
            default: 0,
        },
        credit: {
            type: Number,
            min: 0,
            default: 0,
        },
        memberId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Member",
            required: false,
        },
        bankId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "BankMaster",
            required: false,
        },
        notes: {
            type: String,
            default: "",
        },
    },
    { timestamps: true }
);

JournalLineSchema.index({ entryId: 1 });
JournalLineSchema.index({ accountHead: 1, entryId: 1 });

export default mongoose.model("JournalLine", JournalLineSchema);
