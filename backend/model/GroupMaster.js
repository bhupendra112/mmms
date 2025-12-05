import mongoose from "mongoose";

const GroupMasterSchema = new mongoose.Schema({
    group_name: { type: String, required: true },
    group_code: { type: String, required: true, unique: true },

    cluster_name: { type: String },
    village: { type: String },

    no_members: { type: Number },
    formation_date: { type: Date },

    president_name: { type: String },
    secretary_name: { type: String },
    treasurer_name: { type: String },

    cluster: { type: String },

    saving_per_member: { type: Number },
    Mship_Group: { type: String },
    membership_fees: { type: Number },

    mitan_name: { type: String },

    meeting_date_1: { type: Date },
    meeting_date_2: { type: Date },

    sahyog_rashi: { type: String },
    shar_capital: { type: String },
    other: { type: String },

    remark: { type: String },

    govt_linked: { type: String, enum: ["Yes", "No"], default: "No" },
    govt_project_type: { type: String, enum: ["NRLM", "Other", ""], default: "" },
    bankmaster: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BankMaster"
    }
}, { timestamps: true });

export default mongoose.model("GroupMaster", GroupMasterSchema);