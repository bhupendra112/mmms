// ===========================
// ADMIN USER SCHEMA (ESM)
// ===========================
import mongoose from "mongoose";

const AdminSchema = new mongoose.Schema({
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
    },

    // Profile fields
    phone: {
        type: String,
        trim: true,
    },
    designation: {
        type: String,
        trim: true,
    },
    organization: {
        type: String,
        trim: true,
    },

    // Settings
    settings: {
        twoFactorAuth: {
            type: Boolean,
            default: false,
        },
        sessionTimeout: {
            type: Number,
            default: 30, // minutes
        },
    },
}, { timestamps: true });

const Admin = mongoose.model("Admin", AdminSchema);

export default Admin;