import apiResponse from "../../utility/apiResponse.js";
import { MemberRevenueDemand, GroupMaster, Member } from "../../model/index.js";
import { verifyGroupAccess } from "../../utility/groupAccessHelper.js";

/**
 * Get revenue summary by year/period
 */
export const getRevenueSummary = async (req, res) => {
    try {
        const { groupId, year, fromDate, toDate } = req.query;

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        const filter = {};
        
        if (groupId) {
            // Verify group access
            const accessCheck = await verifyGroupAccess(groupId, adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
            }
            filter.groupId = groupId;
        } else {
            // If no group specified, filter by all groups in admin's place
            const groups = await GroupMaster.find({ place: adminPlace }).select("_id").lean();
            const groupIds = groups.map(g => g._id);
            filter.groupId = { $in: groupIds };
        }

        if (year) {
            filter.year = year;
        }

        if (fromDate || toDate) {
            filter.paidDate = {};
            if (fromDate) {
                const from = new Date(fromDate);
                from.setHours(0, 0, 0, 0);
                filter.paidDate.$gte = from;
            }
            if (toDate) {
                const to = new Date(toDate);
                to.setHours(23, 59, 59, 999);
                filter.paidDate.$lte = to;
            }
        }

        // Get all revenue demands matching filter
        const revenueDemands = await MemberRevenueDemand.find(filter)
            .populate("memberId", "Member_Id Member_Nm")
            .populate("groupId", "group_name group_code")
            .populate("loanId", "amount date")
            .sort({ paidDate: -1, demandDate: -1 })
            .lean();

        // Calculate summary
        const summary = {
            total: {
                membership_fees_shg: { paid: 0, pending: 0, count: 0 },
                membership_fees_group: { paid: 0, pending: 0, count: 0 },
                yogdan: { paid: 0, pending: 0, count: 0 },
            },
            byType: {},
            byYear: {},
            byGroup: {},
        };

        revenueDemands.forEach(demand => {
            const type = demand.revenueType;
            const year = demand.year;
            const groupId = demand.groupId?._id?.toString() || demand.groupId?.toString();
            const groupName = demand.groupId?.group_name || "Unknown";

            // Initialize if not exists
            if (!summary.byType[type]) {
                summary.byType[type] = { paid: 0, pending: 0, count: 0 };
            }
            if (!summary.byYear[year]) {
                summary.byYear[year] = { paid: 0, pending: 0, count: 0 };
            }
            if (!summary.byGroup[groupId]) {
                summary.byGroup[groupId] = { groupName, paid: 0, pending: 0, count: 0 };
            }

            if (demand.isPaid) {
                summary.total[type].paid += demand.paidAmount || demand.amount;
                summary.byType[type].paid += demand.paidAmount || demand.amount;
                summary.byYear[year].paid += demand.paidAmount || demand.amount;
                summary.byGroup[groupId].paid += demand.paidAmount || demand.amount;
            } else {
                summary.total[type].pending += demand.amount;
                summary.byType[type].pending += demand.amount;
                summary.byYear[year].pending += demand.amount;
                summary.byGroup[groupId].pending += demand.amount;
            }

            summary.total[type].count++;
            summary.byType[type].count++;
            summary.byYear[year].count++;
            summary.byGroup[groupId].count++;
        });

        return apiResponse.success(res, "Revenue summary fetched successfully", {
            summary,
            details: revenueDemands,
            totalRecords: revenueDemands.length,
        });
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

/**
 * Get pending demands
 */
export const getPendingDemands = async (req, res) => {
    try {
        const { groupId, memberId, revenueType } = req.query;

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        const filter = { isPaid: false };

        if (groupId) {
            // Verify group access
            const accessCheck = await verifyGroupAccess(groupId, adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
            }
            filter.groupId = groupId;
        } else {
            // If no group specified, filter by all groups in admin's place
            const groups = await GroupMaster.find({ place: adminPlace }).select("_id").lean();
            const groupIds = groups.map(g => g._id);
            filter.groupId = { $in: groupIds };
        }

        if (memberId) {
            filter.memberId = memberId;
        }

        if (revenueType) {
            filter.revenueType = revenueType;
        }

        const pendingDemands = await MemberRevenueDemand.find(filter)
            .populate("memberId", "Member_Id Member_Nm")
            .populate("groupId", "group_name group_code")
            .populate("loanId", "amount date")
            .sort({ demandDate: 1 })
            .lean();

        return apiResponse.success(res, "Pending demands fetched successfully", pendingDemands);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

/**
 * Get paid revenue items
 */
export const getPaidRevenue = async (req, res) => {
    try {
        const { groupId, memberId, revenueType, fromDate, toDate } = req.query;

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        const filter = { isPaid: true };

        if (groupId) {
            // Verify group access
            const accessCheck = await verifyGroupAccess(groupId, adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
            }
            filter.groupId = groupId;
        } else {
            // If no group specified, filter by all groups in admin's place
            const groups = await GroupMaster.find({ place: adminPlace }).select("_id").lean();
            const groupIds = groups.map(g => g._id);
            filter.groupId = { $in: groupIds };
        }

        if (memberId) {
            filter.memberId = memberId;
        }

        if (revenueType) {
            filter.revenueType = revenueType;
        }

        if (fromDate || toDate) {
            filter.paidDate = {};
            if (fromDate) {
                const from = new Date(fromDate);
                from.setHours(0, 0, 0, 0);
                filter.paidDate.$gte = from;
            }
            if (toDate) {
                const to = new Date(toDate);
                to.setHours(23, 59, 59, 999);
                filter.paidDate.$lte = to;
            }
        }

        const paidRevenue = await MemberRevenueDemand.find(filter)
            .populate("memberId", "Member_Id Member_Nm")
            .populate("groupId", "group_name group_code")
            .populate("loanId", "amount date")
            .populate("recoveryId", "date")
            .sort({ paidDate: -1 })
            .lean();

        return apiResponse.success(res, "Paid revenue fetched successfully", paidRevenue);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

/**
 * Get revenue details for a specific member
 */
export const getMemberRevenue = async (req, res) => {
    try {
        const { memberId } = req.params;

        if (!memberId) {
            return apiResponse.error(res, "memberId is required", 400);
        }

        const member = await Member.findById(memberId);
        if (!member) {
            return apiResponse.error(res, "Member not found", 404);
        }

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Verify member's group belongs to admin's place
        if (member.group) {
            const groupId = member.group._id || member.group;
            const accessCheck = await verifyGroupAccess(groupId, adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(res, accessCheck.error || "You don't have access to this member's group", 403);
            }
        }

        const revenueDemands = await MemberRevenueDemand.find({ memberId })
            .populate("groupId", "group_name group_code")
            .populate("loanId", "amount date")
            .populate("recoveryId", "date")
            .sort({ demandDate: -1 })
            .lean();

        return apiResponse.success(res, "Member revenue fetched successfully", revenueDemands);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};
