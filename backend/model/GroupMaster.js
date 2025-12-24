import mongoose from "mongoose";

const GroupMasterSchema = new mongoose.Schema({
    group_name: { type: String, required: true },
    group_code: { type: String, required: true, unique: true },

    cluster_name: { type: String },
    village: { type: String },

    no_members: { type: Number },
    formation_date: { type: Date },

    cluster: { type: String },

    saving_per_member: { type: Number },
    Mship_Group: { type: String },
    membership_fees: { type: Number },

    mitan_name: { type: String },

    meeting_date_1_day: { type: Number, min: 1, max: 31 },
    meeting_date_2_day: { type: Number, min: 1, max: 31 },
    meeting_date_2_time: { type: String },

    sahyog_rashi: { type: String },
    shar_capital: { type: String },
    other: { type: String },

    remark: { type: String },

    govt_linked: { type: String, enum: ["Yes", "No"], default: "No" },
    govt_project_type: { type: String, enum: ["NRLM", "Other", ""], default: "" },
    // Single bank ref kept for backward compatibility (deprecated)
    bankmaster: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BankMaster"
    },
    // ✅ Multiple bank accounts per group
    bankmasters: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "BankMaster"
    }],

    // Group login fields
    loginEnabled: { type: Boolean, default: true },
    lastLoginAt: { type: Date },

    // Financial rates
    saving_rate: { type: Number }, // Rate for saving (interest rate percentage)
    fd_rate: { type: Number }, // Fixed Deposit interest rate percentage
    loan_rate: { type: Number }, // Loan interest rate percentage
}, { timestamps: true });

export default mongoose.model("GroupMaster", GroupMasterSchema);