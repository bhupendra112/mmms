import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import apiResponse from "../../utility/apiResponse.js";
import message from "../../utility/message.js";
import { Admin } from "../../model/index.js";

dotenv.config(); // load .env

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";

// =========================
// REGISTER ADMIN
// =========================
export const registerAdmin = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Check if admin exists
        const exists = await Admin.findOne({ email });
        if (exists) return apiResponse.error(res, message.ADMIN_EXISTS);

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create admin
        const admin = await Admin.create({
            name,
            email,
            password: hashedPassword,
        });

        // Generate JWT token
        const token = jwt.sign({ id: admin._id, email: admin.email },
            JWT_SECRET, { expiresIn: JWT_EXPIRES_IN }
        );

        // Send response with token
        return apiResponse.success(res, message.ADMIN_REGISTERED, { admin, token });

    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};



export const loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find admin
        const admin = await Admin.findOne({ email });
        if (!admin) return apiResponse.error(res, message.INVALID_CREDENTIALS);

        // Compare password
        const match = await bcrypt.compare(password, admin.password);
        if (!match) return apiResponse.error(res, message.INVALID_CREDENTIALS);

        // Generate JWT token
        const token = jwt.sign({ id: admin._id, email: admin.email },
            JWT_SECRET, { expiresIn: JWT_EXPIRES_IN }
        );

        // Prepare admin data without password
        const adminData = {
            id: admin._id,
            name: admin.name,
            email: admin.email,
            createdAt: admin.createdAt,
            updatedAt: admin.updatedAt,
        };

        return apiResponse.success(res, message.ADMIN_LOGIN_SUCCESS, {
            token,
            admin: adminData,
        });

    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// =========================
// GET ADMIN PROFILE
// =========================
export const getAdminProfile = async (req, res) => {
    try {
        const adminId = req.user?.id;
        if (!adminId) {
            return apiResponse.error(res, "Unauthorized", 401);
        }

        const admin = await Admin.findById(adminId).select("-password");
        if (!admin) {
            return apiResponse.error(res, "Admin not found", 404);
        }

        return apiResponse.success(res, "Profile fetched successfully", admin);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// =========================
// UPDATE ADMIN PROFILE
// =========================
export const updateAdminProfile = async (req, res) => {
    try {
        const adminId = req.user?.id;
        if (!adminId) {
            return apiResponse.error(res, "Unauthorized", 401);
        }

        const { name, phone, designation, organization } = req.body;

        const admin = await Admin.findById(adminId);
        if (!admin) {
            return apiResponse.error(res, "Admin not found", 404);
        }

        // Update fields
        if (name) admin.name = name;
        if (phone !== undefined) admin.phone = phone;
        if (designation !== undefined) admin.designation = designation;
        if (organization !== undefined) admin.organization = organization;

        await admin.save();

        const adminData = admin.toObject();
        delete adminData.password;

        return apiResponse.success(res, "Profile updated successfully", adminData);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// =========================
// CHANGE PASSWORD
// =========================
export const changePassword = async (req, res) => {
    try {
        const adminId = req.user?.id;
        if (!adminId) {
            return apiResponse.error(res, "Unauthorized", 401);
        }

        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return apiResponse.error(res, "Current password and new password are required", 400);
        }

        if (newPassword.length < 6) {
            return apiResponse.error(res, "Password must be at least 6 characters long", 400);
        }

        const admin = await Admin.findById(adminId);
        if (!admin) {
            return apiResponse.error(res, "Admin not found", 404);
        }

        // Verify current password
        const match = await bcrypt.compare(currentPassword, admin.password);
        if (!match) {
            return apiResponse.error(res, "Current password is incorrect", 400);
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        admin.password = hashedPassword;
        await admin.save();

        return apiResponse.success(res, "Password changed successfully", {});
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// =========================
// GET ADMIN SETTINGS
// =========================
export const getAdminSettings = async (req, res) => {
    try {
        const adminId = req.user?.id;
        if (!adminId) {
            return apiResponse.error(res, "Unauthorized", 401);
        }

        const admin = await Admin.findById(adminId).select("settings");
        if (!admin) {
            return apiResponse.error(res, "Admin not found", 404);
        }

        return apiResponse.success(res, "Settings fetched successfully", admin.settings || {});
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// =========================
// UPDATE ADMIN SETTINGS
// =========================
export const updateAdminSettings = async (req, res) => {
    try {
        const adminId = req.user?.id;
        if (!adminId) {
            return apiResponse.error(res, "Unauthorized", 401);
        }

        const { twoFactorAuth, sessionTimeout } = req.body;

        const admin = await Admin.findById(adminId);
        if (!admin) {
            return apiResponse.error(res, "Admin not found", 404);
        }

        // Initialize settings if not exists
        if (!admin.settings) {
            admin.settings = {};
        }

        if (twoFactorAuth !== undefined) {
            admin.settings.twoFactorAuth = twoFactorAuth;
        }
        if (sessionTimeout !== undefined) {
            admin.settings.sessionTimeout = sessionTimeout;
        }

        await admin.save();

        return apiResponse.success(res, "Settings updated successfully", admin.settings);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};