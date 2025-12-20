import apiResponse from "../../utility/apiResponse.js";
import message from "../../utility/message.js";
import { GroupMaster, Member } from "../../model/index.js";

export const registerMember = async (req, res) => {
    try {
        const payload = req.body || {};

        // Handle file uploads - multer adds files to req.files
        // When using upload.fields(), req.files is an object with field names as keys
        if (req.files) {
            const fileFields = ['Voter_Id_File', 'Adhar_Id_File', 'Ration_Card_File', 'Job_Card_File'];
            
            // req.files is an object: { fieldName: [file1, file2, ...] }
            Object.keys(req.files).forEach(fieldName => {
                if (fileFields.includes(fieldName)) {
                    const files = req.files[fieldName];
                    if (files && files.length > 0) {
                        // Store relative path from uploads directory
                        // Take the first file if multiple uploaded
                        payload[fieldName] = `/uploads/members/${files[0].filename}`;
                    }
                }
            });
        }

        // Parse JSON fields that might be sent as strings (for nested objects)
        if (typeof payload.fdDetails === 'string') {
            try {
                payload.fdDetails = JSON.parse(payload.fdDetails);
            } catch (e) {
                // Keep as is if not valid JSON
            }
        }
        
        if (typeof payload.loanDetails === 'string') {
            try {
                payload.loanDetails = JSON.parse(payload.loanDetails);
            } catch (e) {
                // Keep as is if not valid JSON
            }
        }

        // Parse numeric fields that come as strings from FormData
        const numericFields = ['Age', 'Anual_Income', 'openingSaving', 'openingYogdan'];
        numericFields.forEach(field => {
            if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
                const numValue = Number(payload[field]);
                if (!isNaN(numValue)) {
                    payload[field] = numValue;
                }
            }
        });

        // Parse date fields that come as strings from FormData
        const dateFields = ['Member_Dt', 'Dt_Join', 'dt_birth'];
        dateFields.forEach(field => {
            if (payload[field] && typeof payload[field] === 'string' && payload[field] !== '') {
                const dateValue = new Date(payload[field]);
                if (!isNaN(dateValue.getTime())) {
                    payload[field] = dateValue;
                }
            }
        });

        // Parse nested date and numeric fields in fdDetails and loanDetails
        if (payload.fdDetails && typeof payload.fdDetails === 'object') {
            if (payload.fdDetails.date && typeof payload.fdDetails.date === 'string') {
                const dateValue = new Date(payload.fdDetails.date);
                if (!isNaN(dateValue.getTime())) {
                    payload.fdDetails.date = dateValue;
                }
            }
            if (payload.fdDetails.maturityDate && typeof payload.fdDetails.maturityDate === 'string') {
                const dateValue = new Date(payload.fdDetails.maturityDate);
                if (!isNaN(dateValue.getTime())) {
                    payload.fdDetails.maturityDate = dateValue;
                }
            }
            // Parse numeric fields in fdDetails
            if (payload.fdDetails.amount !== undefined && payload.fdDetails.amount !== null && payload.fdDetails.amount !== '') {
                const numValue = Number(payload.fdDetails.amount);
                if (!isNaN(numValue)) {
                    payload.fdDetails.amount = numValue;
                }
            }
            if (payload.fdDetails.interest !== undefined && payload.fdDetails.interest !== null && payload.fdDetails.interest !== '') {
                const numValue = Number(payload.fdDetails.interest);
                if (!isNaN(numValue)) {
                    payload.fdDetails.interest = numValue;
                }
            }
        }

        if (payload.loanDetails && typeof payload.loanDetails === 'object') {
            if (payload.loanDetails.loanDate && typeof payload.loanDetails.loanDate === 'string') {
                const dateValue = new Date(payload.loanDetails.loanDate);
                if (!isNaN(dateValue.getTime())) {
                    payload.loanDetails.loanDate = dateValue;
                }
            }
            // Parse numeric fields in loanDetails
            if (payload.loanDetails.amount !== undefined && payload.loanDetails.amount !== null && payload.loanDetails.amount !== '') {
                const numValue = Number(payload.loanDetails.amount);
                if (!isNaN(numValue)) {
                    payload.loanDetails.amount = numValue;
                }
            }
            if (payload.loanDetails.overdueInterest !== undefined && payload.loanDetails.overdueInterest !== null && payload.loanDetails.overdueInterest !== '') {
                const numValue = Number(payload.loanDetails.overdueInterest);
                if (!isNaN(numValue)) {
                    payload.loanDetails.overdueInterest = numValue;
                }
            }
        }

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