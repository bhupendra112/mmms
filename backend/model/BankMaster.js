import mongoose from "mongoose";

const BankMasterSchema = new mongoose.Schema({
    bank_name: { type: String, required: true },
    account_no: { type: String, required: true, unique: true },

    branch_name: { type: String },
    ifsc: { type: String },
    short_name: { type: String },

    ac_open_date: { type: Date },

    account_type: { type: String, enum: ["Saving", "CC", "FD"], required: true },

    opening_balance: { type: Number },
    open_indicator: { type: String },

    cc_limit: { type: Number },
    dp_limit: { type: Number },

    open_bal_curr: { type: Number },
    fd_mat_dt: { type: Date },

    open_ind_curr: { type: String },

    flg_acclosed: { type: String },
    acclosed_dt: { type: Date },

    govt_linked: { type: String, enum: ["Yes", "No"], default: "No" },
    govt_project_type: { type: String, enum: ["NRLM", "Other", ""], default: "" },

    // 🔗 Optional: Link bank account to group
    group_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GroupMaster",
        required: false,
    },
}, { timestamps: true });

export default mongoose.model("BankMaster", BankMasterSchema);