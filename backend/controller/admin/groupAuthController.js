import bcrypt from "bcryptjs";
import apiResponse from "../../utility/apiResponse.js";
import jwt from "jsonwebtoken";
import { GroupMaster } from "../../model/index.js";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "30d";

export const loginGroup = async (req, res) => {
    try {
        const { groupCode, password } = req.body;

        if (!groupCode) {
            return apiResponse.error(res, "Group code is required", 400);
        }

        if (!password || String(password).trim() === "") {
            return apiResponse.error(res, "Password is required", 400);
        }

        // Find group by code; include groupPassword for verification (normally select: false)
        const groupDoc = await GroupMaster.findOne({ group_code: groupCode })
            .select("+groupPassword")
            .lean();

        if (!groupDoc) {
            return apiResponse.error(res, "Invalid credentials", 401);
        }

        // Check if login is enabled
        if (groupDoc.loginEnabled === false) {
            return apiResponse.error(res, "Group login is disabled", 403);
        }

        // Password must be set for group (migration: existing groups set via admin later)
        if (!groupDoc.groupPassword || groupDoc.groupPassword.length === 0) {
            return apiResponse.error(res, "Password not set for this group. Please contact admin.", 403);
        }

        const passwordMatch = await bcrypt.compare(String(password).trim(), groupDoc.groupPassword);
        if (!passwordMatch) {
            return apiResponse.error(res, "Invalid credentials", 401);
        }

        // Update last login time (fetch doc again to update, without storing password in memory)
        await GroupMaster.findByIdAndUpdate(groupDoc._id, { lastLoginAt: new Date() });

        // Generate JWT token (include supervisorId for downstream use)
        const token = jwt.sign(
            {
                id: groupDoc._id,
                groupName: groupDoc.group_name,
                groupCode: groupDoc.group_code,
                supervisorId: groupDoc.supervisorId || null,
                type: "group",
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Prepare group data without sensitive info (groupPassword already excluded from lean)
        const groupData = {
            id: groupDoc._id,
            name: groupDoc.group_name,
            code: groupDoc.group_code,
            village: groupDoc.village,
            cluster_name: groupDoc.cluster_name,
            no_members: groupDoc.no_members,
            place: groupDoc.place,
            lastLoginAt: new Date(),
            supervisorId: groupDoc.supervisorId || null,
        };

        return apiResponse.success(res, "Group login successful", {
            token,
            group: groupData,
        });

    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

