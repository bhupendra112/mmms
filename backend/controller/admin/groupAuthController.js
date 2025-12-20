import apiResponse from "../../utility/apiResponse.js";
import message from "../../utility/message.js";
import jwt from "jsonwebtoken";
import { GroupMaster } from "../../model/index.js";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "30d";

export const loginGroup = async (req, res) => {
    try {
        const { groupName, groupId, groupCode } = req.body;

        if (!groupName) {
            return apiResponse.error(res, "Group name is required", 400);
        }

        if (!groupId && !groupCode) {
            return apiResponse.error(res, "Group ID or Group Code is required", 400);
        }

        // Find group by name and ID/code
        let groupDoc = null;
        if (groupId) {
            groupDoc = await GroupMaster.findById(groupId);
        } else if (groupCode) {
            groupDoc = await GroupMaster.findOne({ group_code: groupCode });
        }

        if (!groupDoc) {
            return apiResponse.error(res, "Group not found", 404);
        }

        // Verify group name matches
        if (groupDoc.group_name !== groupName) {
            return apiResponse.error(res, "Invalid group name or ID", 401);
        }

        // Check if login is enabled
        if (groupDoc.loginEnabled === false) {
            return apiResponse.error(res, "Group login is disabled", 403);
        }

        // Update last login time
        groupDoc.lastLoginAt = new Date();
        await groupDoc.save();

        // Generate JWT token
        const token = jwt.sign(
            {
                id: groupDoc._id,
                groupName: groupDoc.group_name,
                groupCode: groupDoc.group_code,
                type: "group",
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Prepare group data without sensitive info
        const groupData = {
            id: groupDoc._id,
            name: groupDoc.group_name,
            code: groupDoc.group_code,
            village: groupDoc.village,
            cluster_name: groupDoc.cluster_name,
            no_members: groupDoc.no_members,
            lastLoginAt: groupDoc.lastLoginAt,
        };

        return apiResponse.success(res, "Group login successful", {
            token,
            group: groupData,
        });

    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

