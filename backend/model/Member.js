import mongoose from "mongoose";

const MemberSchema = new mongoose.Schema({
    Member_Id: { type: String, required: true, unique: true },
    Group_Name: { type: String },
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GroupMaster"
    },
    Member_Nm: { type: String, required: true },
    Member_Dt: { type: Date },
    Dt_Join: { type: Date },

    F_H_Name: { type: String },
    F_H_FatherName: { type: String },

    Voter_Id: { type: String },
    Adhar_Id: { type: String },
    Ration_Card: { type: String },
    Job_Card: { type: String },

    // File uploads for identity documents
    Voter_Id_File: { type: String }, // Path to uploaded file
    Adhar_Id_File: { type: String },
    Ration_Card_File: { type: String },
    Job_Card_File: { type: String },

    Apl_Bpl_Etc: { type: String, enum: ["APL", "BPL"] },

    Desg: {
        type: String,
        enum: ["Member", "President", "Secretary", "Treasurer"],
    },

    Bank_Name: { type: String },
    Br_Name: { type: String },
    Bank_Ac: { type: String },
    Ifsc_No: { type: String },

    Age: { type: Number },
    Edu_Qual: { type: String },
    Anual_Income: { type: Number },
    Profession: { type: String },

    Caste: { type: String, enum: ["GEN", "OBC", "SC", "ST", "MINORITY"] },

    Religion: {
        type: String,
        enum: ["Hindu", "Muslim", "Christian", "Sikh", "Other"],
    },

    cell_phone: { type: String },

    dt_birth: { type: Date },

    nominee_1: { type: String },
    nominee_2: { type: String },

    res_add1: { type: String },
    res_add2: { type: String },
    Village: { type: String },

    // Existing member financial details (for migration from Excel)
    isExistingMember: { type: Boolean, default: false },
    openingSaving: { type: Number, default: 0 },
    fdDetails: {
        date: { type: Date },
        maturityDate: { type: Date },
        amount: { type: Number, default: 0 },
        interest: { type: Number, default: 0 },
    },
    loanDetails: {
        amount: { type: Number, default: 0 },
        loanDate: { type: Date },
        overdueInterest: { type: Number, default: 0 },
        time_period: { type: Number }, // Loan duration in months
        installment_amount: { type: Number }, // Monthly installment amount (calculated: amount / time_period)
    },
    openingYogdan: { type: Number, default: 0 }, // One-time opening balance, future tracked in recovery
    // Rate snapshot for existing members (to use historical saving rate instead of current group rate)
    saving_per_member_snapshot: { type: Number }, // Snapshot of saving_per_member from group
}, {
    timestamps: true,
});

export default mongoose.model("Member", MemberSchema);