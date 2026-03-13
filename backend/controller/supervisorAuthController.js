import bcrypt from "bcryptjs";
import apiResponse from "../utility/apiResponse.js";
import jwt from "jsonwebtoken";
import { Supervisor } from "../model/index.js";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "30d";

export const loginSupervisor = async (req, res) => {
    try {
        const { email, password } = req.body;

        const supervisor = await Supervisor.findOne({ email: email?.toLowerCase?.() || email })
            .select("+password")
            .lean();

        if (!supervisor) {
            return apiResponse.error(res, "Invalid credentials", 401);
        }

        if (supervisor.status !== "active") {
            return apiResponse.error(res, "Supervisor account is disabled", 403);
        }

        const passwordMatch = await bcrypt.compare(String(password).trim(), supervisor.password);
        if (!passwordMatch) {
            return apiResponse.error(res, "Invalid credentials", 401);
        }

        const token = jwt.sign(
            {
                id: supervisor._id,
                email: supervisor.email,
                place: supervisor.place,
                type: "supervisor",
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        const supervisorData = {
            id: supervisor._id,
            name: supervisor.name,
            email: supervisor.email,
            place: supervisor.place,
            status: supervisor.status,
            createdAt: supervisor.createdAt,
        };

        return apiResponse.success(res, "Supervisor login successful", {
            token,
            supervisor: supervisorData,
        });
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};
