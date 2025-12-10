import mongoose from "mongoose";

const MemberSchema = new mongoose.Schema(
    {
        group: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "GroupMaster",
            required: true,
            index: true,
        },

        // ✅ MAIN UNIQUE ID
        Member_Id: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true,
        },

        Member_Nm: {
            type: String,
            required: true,
            trim: true,
        },

        Member_Dt: { type: Date },
        Dt_Join: { type: Date },

        F_H_Name: { type: String },
        F_H_FatherName: { type: String },

        // ✅ OPTIONAL BUT UNIQUE → MUST BE SPARSE
        Voter_Id: {
            type: String,
            unique: true,
            sparse: true,
            trim: true,
        },

        Adhar_Id: {
            type: String,
            unique: true,
            sparse: true,
            trim: true,
        },

        Ration_Card: { type: String },

        Job_Card: {
            type: String,
            unique: true,
            sparse: true,
            trim: true,
        },

        Apl_Bpl_Etc: {
            type: String,
            enum: ["APL", "BPL"],
        },

        Desg: {
            type: String,
            enum: ["Member", "President", "Secretary", "Treasurer"],
        },

        Bank_Name: { type: String },
        Br_Name: { type: String },

        Bank_Ac: {
            type: String,
            unique: true,
            sparse: true,
            trim: true,
        },

        Ifsc_No: { type: String },

        Age: { type: Number },
        Edu_Qual: { type: String },
        Anual_Income: { type: Number },
        Profession: { type: String },

        Caste: {
            type: String,
            enum: ["GEN", "OBC", "SC", "ST", "MINORITY"],
        },

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
    },
    { timestamps: true }
);

export default mongoose.model("Member", MemberSchema);
