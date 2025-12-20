import apiResponse from "../../utility/apiResponse.js";
import message from "../../utility/message.js";
import RecoveryMaster from "../../model/RecoveryMaster.js";
import { GroupMaster } from "../../model/index.js";

export const registerRecovery = async (req, res) => {
    try {
        const payload = req.body || {};

        // Verify group exists
        let groupDoc = null;
        if (payload.groupId) {
            groupDoc = await GroupMaster.findById(payload.groupId);
        } else if (payload.groupCode) {
            groupDoc = await GroupMaster.findOne({ group_code: payload.groupCode });
        } else if (payload.groupName) {
            groupDoc = await GroupMaster.findOne({ group_name: payload.groupName });
        }

        if (!groupDoc) {
            return apiResponse.error(res, "Valid groupId/groupCode/groupName is required", 400);
        }

        // Parse date if it's a string (DD/MM/YYYY format) - needed for meeting day validation
        let parsedDate = payload.date;
        if (!payload.date) {
            // If no date provided, use today's date
            parsedDate = new Date();
        } else if (typeof payload.date === 'string' && payload.date.includes('/')) {
            // Handle DD/MM/YYYY format
            const parts = payload.date.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed in JS Date
                const year = parseInt(parts[2], 10);
                parsedDate = new Date(year, month, day);
            } else {
                // Try parsing as ISO string or other format
                parsedDate = new Date(payload.date);
            }
        } else if (typeof payload.date === 'string') {
            // Try parsing as ISO string
            parsedDate = new Date(payload.date);
        } else if (payload.date instanceof Date) {
            parsedDate = payload.date;
        }

        // Validate parsed date
        if (!(parsedDate instanceof Date) || isNaN(parsedDate.getTime())) {
            return apiResponse.error(res, "Invalid date format. Expected DD/MM/YYYY or ISO date string", 400);
        }

        // Validate meeting day - recovery can only be done on scheduled meeting days
        const meetingDay1 = groupDoc.meeting_date_1_day;
        const meetingDay2 = groupDoc.meeting_date_2_day;
        
        if (meetingDay1 != null || meetingDay2 != null) {
            const dayOfMonth = parsedDate.getDate();
            const isMeetingDay = dayOfMonth === meetingDay1 || dayOfMonth === meetingDay2;

            if (!isMeetingDay) {
                // Calculate next meeting date for error message
                const today = new Date();
                const currentYear = today.getFullYear();
                const currentMonth = today.getMonth();
                const meetingDays = [meetingDay1, meetingDay2].filter(d => d != null);
                const possibleDates = [];

                // Current month
                meetingDays.forEach(day => {
                    const date = new Date(currentYear, currentMonth, day);
                    if (date.getDate() === day) possibleDates.push(date);
                });
                // Next month
                meetingDays.forEach(day => {
                    const date = new Date(currentYear, currentMonth + 1, day);
                    if (date.getDate() === day) possibleDates.push(date);
                });

                possibleDates.sort((a, b) => a - b);
                const todayStart = new Date(currentYear, currentMonth, today.getDate(), 0, 0, 0, 0);
                const nextDate = possibleDates.find(d => d >= todayStart) || possibleDates[0];

                let errorMsg = `Recovery can only be done on scheduled meeting days (${meetingDay1 != null ? meetingDay1 : ''}${meetingDay1 != null && meetingDay2 != null ? ' and ' : ''}${meetingDay2 != null ? meetingDay2 : ''} of each month).`;
                if (nextDate) {
                    const day = nextDate.getDate().toString().padStart(2, '0');
                    const month = (nextDate.getMonth() + 1).toString().padStart(2, '0');
                    const year = nextDate.getFullYear();
                    errorMsg += ` Next meeting date: ${day}/${month}/${year}`;
                    if (groupDoc.meeting_date_2_time) {
                        errorMsg += ` at ${groupDoc.meeting_date_2_time}`;
                    }
                }
                return apiResponse.error(res, errorMsg, 403);
            }
        }

        // Create recovery session
        const recovery = await RecoveryMaster.create({
            ...payload,
            date: parsedDate,
            groupId: groupDoc._id,
            groupName: payload.groupName || groupDoc.group_name,
            groupCode: payload.groupCode || groupDoc.group_code,
            status: "approved", // Admin actions are directly approved
            createdBy: req.user?.id || "admin",
        });

        return apiResponse.success(res, "Recovery session registered successfully", recovery);

    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

export const listRecoveries = async (req, res) => {
    try {
        const { groupId, groupCode, status, date } = req.query;
        
        const filter = {};
        if (groupId) {
            filter.groupId = groupId;
        } else if (groupCode) {
            const group = await GroupMaster.findOne({ group_code: groupCode });
            if (group) filter.groupId = group._id;
        }
        if (status) filter.status = status;
        if (date) {
            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
            filter.date = { $gte: startDate, $lte: endDate };
        }

        const recoveries = await RecoveryMaster.find(filter)
            .populate("groupId", "group_name group_code village")
            .sort({ createdAt: -1 })
            .lean();

        return apiResponse.success(res, "Recoveries fetched successfully", recoveries);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

export const getRecoveryDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const recovery = await RecoveryMaster.findById(id)
            .populate("groupId", "group_name group_code village")
            .lean();
        
        if (!recovery) {
            return apiResponse.error(res, "Recovery not found", 404);
        }
        
        return apiResponse.success(res, "Recovery detail fetched successfully", recovery);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

