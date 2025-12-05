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
export const registerAdmin = async(req, res) => {
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



export const loginAdmin = async(req, res) => {
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