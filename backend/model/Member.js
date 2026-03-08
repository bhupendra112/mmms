import mongoose from "mongoose";

const MemberSchema = new mongoose.Schema({
    Member_Id: { type: String, required: true }, // Not unique - same Member ID can exist in different groups
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
    Samagra_Id: { type: String },

    // File uploads for identity documents
    Member_Photo: { type: String }, // Path to uploaded file
    Voter_Id_File: { type: String }, // Path to uploaded file
    Adhar_Id_File: { type: String },
    Bank_File: { type: String },
    Ration_Card_File: { type: String },
    Job_Card_File: { type: String },

    // Spouse (Pati) details
    dt_birth_pati: { type: Date },
    Age_Pati: { type: Number },
    Adhar_Id_Pati: { type: String },
    cell_phone_pati: { type: String },
    Bank_Ac_Pati: { type: String },

    // Spouse document files
    Adhar_Id_Pati_File: { type: String },
    Voter_Id_Pati_File: { type: String },
    Bank_Pati_File: { type: String },

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
    openingSavingPaid: { type: Boolean, default: false }, //Track if openingSaving has been paid
    // Admin adjustments to opening saving (preserves history in ledger)
    openingSavingAdjustments: [{
        date: { type: Date, required: true },
        amount: { type: Number, required: true }, // delta (positive = increase, negative = decrease)
        reason: { type: String, default: "" },
    }],
    fdDetails: {
        date: { type: Date },
        maturityDate: { type: Date },
        amount: { type: Number, default: 0 },
        interest: { type: Number, default: 0 },
        isPaid: { type: Boolean, default: false }, //Track if FD has been paid
    },
    loanDetails: {
        amount: { type: Number, default: 0 },
        loanDate: { type: Date },
        overdueInterest: { type: Number, default: 0 },
        time_period: { type: Number }, // Loan duration in months (stored internally, but accepted in years from frontend)
        installment_amount: { type: Number }, // Monthly installment amount (calculated: amount / time_period)
        loanPaid: { type: Number, default: 0 }, // Total loan amount paid so far (for existing members)
        isPaid: { type: Boolean, default: false }, //Track if loan has been paid 
    },
    openingYogdan: { type: Number, default: 0 }, // One-time opening balance, future tracked in recovery
    openingYogdanPaid: { type: Boolean, default: false }, // Track if openingYogdan has been paid
    // Rate snapshot for existing members (to use historical saving rate instead of current group rate)
    saving_per_member_snapshot: { type: Number }, // Snapshot of saving_per_member from group
    // Membership payment tracking
    lastMembershipPaidDate: { type: Date }, // Last date when membership_fees was paid
    lastMembershipGroupPaidDate: { type: Date }, // Last date when Mship_Group was paid,

    approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
    rejectionReason: { type: String },
}, {
    timestamps: true,
});

export default mongoose.model("Member", MemberSchema);