import apiResponse from "../../utility/apiResponse.js";
import FDMaster from "../../model/FDMaster.js";
import { GroupMaster } from "../../model/index.js";
import Member from "../../model/Member.js";

// Create new FD
export const createFD = async (req, res) => {
    try {
        const payload = req.body || {};

        // Validate required fields
        if (!payload.memberId || !payload.amount || !payload.time_period) {
            return apiResponse.error(res, "memberId, amount, and time_period are required", 400);
        }

        // Verify member exists
        const member = await Member.findById(payload.memberId);
        if (!member) {
            return apiResponse.error(res, "Member not found", 404);
        }

        // Get group from member or payload
        const groupId = payload.groupId || member.group;
        if (!groupId) {
            return apiResponse.error(res, "Group ID is required", 400);
        }

        // Verify group exists and get FD rate
        const group = await GroupMaster.findById(groupId);
        if (!group) {
            return apiResponse.error(res, "Group not found", 404);
        }

        // Get FD rate from group (snapshot)
        const fdRate = group.fd_rate;
        if (!fdRate && fdRate !== 0) {
            return apiResponse.error(res, "FD rate not set for this group", 400);
        }

        // Parse date
        let fdDate = payload.date ? new Date(payload.date) : new Date();
        if (typeof payload.date === 'string' && payload.date.includes('/')) {
            const parts = payload.date.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const year = parseInt(parts[2], 10);
                fdDate = new Date(year, month, day);
            }
        }

        // Calculate maturity date
        const maturityDate = new Date(fdDate);
        maturityDate.setMonth(maturityDate.getMonth() + parseInt(payload.time_period));

        // Calculate interest and maturity amount
        const principal = parseFloat(payload.amount);
        const timePeriodMonths = parseInt(payload.time_period);
        const timePeriodYears = timePeriodMonths / 12;
        const interestAmount = (principal * fdRate * timePeriodYears) / 100;
        const maturityAmount = principal + interestAmount;

        // Create FD
        const fd = await FDMaster.create({
            memberId: payload.memberId,
            memberCode: member.Member_Id,
            memberName: member.Member_Nm,
            groupId: group._id,
            groupName: group.group_name,
            groupCode: group.group_code,
            amount: principal,
            time_period: timePeriodMonths,
            fd_rate_snapshot: fdRate,
            date: fdDate,
            maturityDate: maturityDate,
            interestAmount: interestAmount,
            maturityAmount: maturityAmount,
            paymentMode: payload.paymentMode || { cash: false, online: false },
            onlineRef: payload.onlineRef || null,
            status: "active",
            createdBy: req.user?.id || "admin",
        });

        return apiResponse.success(res, "FD created successfully", fd);

    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Get FDs by member
export const getFDsByMember = async (req, res) => {
    try {
        const { memberId } = req.params;

        if (!memberId) {
            return apiResponse.error(res, "memberId is required", 400);
        }

        const fds = await FDMaster.find({ memberId })
            .populate("groupId", "group_name group_code")
            .sort({ date: -1 })
            .lean();

        return apiResponse.success(res, "FDs fetched successfully", fds);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Get FDs by group
export const getFDsByGroup = async (req, res) => {
    try {
        const { groupId } = req.params;

        if (!groupId) {
            return apiResponse.error(res, "groupId is required", 400);
        }

        const fds = await FDMaster.find({ groupId })
            .populate("memberId", "Member_Id Member_Nm")
            .sort({ date: -1 })
            .lean();

        return apiResponse.success(res, "FDs fetched successfully", fds);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Get all FDs
export const getAllFDs = async (req, res) => {
    try {
        const { status, groupId } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (groupId) filter.groupId = groupId;

        const fds = await FDMaster.find(filter)
            .populate("memberId", "Member_Id Member_Nm")
            .populate("groupId", "group_name group_code")
            .sort({ date: -1 })
            .lean();

        return apiResponse.success(res, "FDs fetched successfully", fds);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Get FD detail
export const getFDDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const fd = await FDMaster.findById(id)
            .populate("memberId")
            .populate("groupId", "group_name group_code")
            .lean();

        if (!fd) {
            return apiResponse.error(res, "FD not found", 404);
        }

        return apiResponse.success(res, "FD detail fetched successfully", fd);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Update FD status (e.g., mark as matured or closed)
export const updateFDStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status || !["active", "matured", "closed"].includes(status)) {
            return apiResponse.error(res, "Valid status is required (active, matured, closed)", 400);
        }

        const fd = await FDMaster.findById(id);
        if (!fd) {
            return apiResponse.error(res, "FD not found", 404);
        }

        fd.status = status;
        await fd.save();

        return apiResponse.success(res, "FD status updated successfully", fd);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

