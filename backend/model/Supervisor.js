import mongoose from "mongoose";

const SupervisorSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
        select: false,
    },
    place: {
        type: String,
        required: true,
        trim: true,
    },
    createdByAdminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
    },
    status: {
        type: String,
        enum: ["active", "disabled"],
        default: "active",
    },
}, { timestamps: true });

export default mongoose.model("Supervisor", SupervisorSchema);
