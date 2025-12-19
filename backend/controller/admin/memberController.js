import apiResponse from "../../utility/apiResponse.js";
import message from "../../utility/message.js";
import { GroupMaster, Member } from "../../model/index.js";

export const registerMember = async (req, res) => {
    try {
        const payload = req.body || {};

        // Check if Member already exists
        const exist = await Member.findOne({ Member_Id: payload.Member_Id });
        if (exist) {
            return apiResponse.error(res, message.MEMBER_EXISTS);
        }

        // Resolve group (preferred: group_id)
        let groupDoc = null;
        if (payload.group_id) {
            groupDoc = await GroupMaster.findById(payload.group_id);
        } else if (payload.group_code) {
            groupDoc = await GroupMaster.findOne({ group_code: payload.group_code });
        } else if (payload.Group_Name) {
            groupDoc = await GroupMaster.findOne({ group_name: payload.Group_Name });
        }

        if (!groupDoc) {
            return apiResponse.error(res, "Valid group_id/group_code/Group_Name is required", 400);
        }

        // Create new Member
        const member = await Member.create({
            ...payload,
            group: groupDoc._id,
            Group_Name: payload.Group_Name || groupDoc.group_name,
        });

        return apiResponse.success(res, message.MEMBER_REGISTERED, member);

    } catch (error) {
        console.log("❌ Member Registration Error:", error);
        return apiResponse.error(res, error.message, 500);
    }
};

export const listMembersByGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const members = await Member.find({ group: groupId })
            .sort({ createdAt: -1 })
            .lean();
        return apiResponse.success(res, "Members fetched successfully", members);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

export const listMembers = async (req, res) => {
    try {
        const { group_id } = req.query;
        const filter = group_id ? { group: group_id } : {};
        const members = await Member.find(filter).sort({ createdAt: -1 }).lean();
        return apiResponse.success(res, "Members fetched successfully", members);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

export const getMemberDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const member = await Member.findById(id).populate("group").lean();
        if (!member) return apiResponse.error(res, "Member not found", 404);
        return apiResponse.success(res, "Member detail fetched successfully", member);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};