import apiResponse from "../../utility/apiResponse.js";
import message from "../../utility/message.js";
import RecoveryMaster from "../../model/RecoveryMaster.js";
import { GroupMaster } from "../../model/index.js";
import LoanMaster from "../../model/LoanMaster.js";
import Member from "../../model/Member.js";

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

// Update or add member recovery to existing recovery session
export const updateMemberRecovery = async (req, res) => {
    try {
        const { groupId, date, memberRecovery } = req.body;

        if (!groupId || !memberRecovery) {
            return apiResponse.error(res, "groupId and memberRecovery are required", 400);
        }

        // Verify group exists
        const groupDoc = await GroupMaster.findById(groupId);
        if (!groupDoc) {
            return apiResponse.error(res, "Group not found", 404);
        }

        // Parse date
        let parsedDate = date ? new Date(date) : new Date();
        if (typeof date === 'string' && date.includes('/')) {
            const parts = date.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const year = parseInt(parts[2], 10);
                parsedDate = new Date(year, month, day);
            }
        }

        // Normalize date to start of day for comparison
        const dateStart = new Date(parsedDate);
        dateStart.setHours(0, 0, 0, 0);
        const dateEnd = new Date(parsedDate);
        dateEnd.setHours(23, 59, 59, 999);

        // Find existing recovery session for this date and group
        let recoverySession = await RecoveryMaster.findOne({
            groupId: groupDoc._id,
            date: { $gte: dateStart, $lte: dateEnd }
        });

        if (recoverySession) {
            // Calculate demand details for this member
            const demandDetails = await calculateDemandDetails(
                groupDoc._id,
                memberRecovery.memberId,
                memberRecovery,
                parsedDate,
                groupDoc
            );

            // Update existing session - find and update member recovery
            const memberIndex = recoverySession.recoveries.findIndex(
                r => r.memberId === memberRecovery.memberId
            );

            if (memberIndex >= 0) {
                // Update existing member recovery
                recoverySession.recoveries[memberIndex] = {
                    ...recoverySession.recoveries[memberIndex],
                    ...memberRecovery,
                    demandDetails,
                    total: (memberRecovery.amounts?.saving || 0) +
                        (memberRecovery.amounts?.loan || 0) +
                        (memberRecovery.amounts?.fd || 0) +
                        (memberRecovery.amounts?.interest || 0) +
                        (memberRecovery.amounts?.yogdan || 0) +
                        (memberRecovery.amounts?.memFeesSHG || 0) +
                        (memberRecovery.amounts?.memFeesSamiti || 0) +
                        (memberRecovery.amounts?.penalty || 0) +
                        (memberRecovery.amounts?.other || 0) +
                        (memberRecovery.amounts?.other1 || 0) + // Backward compatibility
                        (memberRecovery.amounts?.other2 || 0) // Backward compatibility
                };
            } else {
                // Add new member recovery
                const total = (memberRecovery.amounts?.saving || 0) +
                    (memberRecovery.amounts?.loan || 0) +
                    (memberRecovery.amounts?.fd || 0) +
                    (memberRecovery.amounts?.interest || 0) +
                    (memberRecovery.amounts?.yogdan || 0) +
                    (memberRecovery.amounts?.memFeesSHG || 0) +
                    (memberRecovery.amounts?.memFeesSamiti || 0) +
                    (memberRecovery.amounts?.penalty || 0) +
                    (memberRecovery.amounts?.other || 0) +
                    (memberRecovery.amounts?.other1 || 0) + // Backward compatibility
                    (memberRecovery.amounts?.other2 || 0); // Backward compatibility

                recoverySession.recoveries.push({
                    ...memberRecovery,
                    demandDetails,
                    total
                });
                recoverySession.memberCount = recoverySession.recoveries.length;
            }

            // Recalculate totals
            let totalCash = 0;
            let totalOnline = 0;
            let totalAmount = 0;

            recoverySession.recoveries.forEach(rec => {
                if (rec.attendance === "present" || (rec.attendance === "absent" && rec.recoveryByOther)) {
                    // Calculate total from all amount fields
                    const amounts = rec.amounts || {};
                    const memberTotal = (amounts.saving || 0) +
                        (amounts.loan || 0) +
                        (amounts.fd || 0) +
                        (amounts.interest || 0) +
                        (amounts.yogdan || 0) +
                        (amounts.memFeesSHG || 0) +
                        (amounts.memFeesSamiti || 0) +
                        (amounts.penalty || 0) +
                        (amounts.other || 0) +
                        (amounts.other1 || 0) + // Backward compatibility
                        (amounts.other2 || 0); // Backward compatibility
                    rec.total = memberTotal;
                    totalAmount += memberTotal;
                    if (rec.paymentMode?.cash) totalCash += memberTotal;
                    if (rec.paymentMode?.online) totalOnline += memberTotal;
                }
            });

            recoverySession.totals = {
                totalCash,
                totalOnline,
                totalAmount
            };

            await recoverySession.save();
            return apiResponse.success(res, "Member recovery updated successfully", recoverySession);
        } else {
            // Calculate demand details for this member
            const demandDetails = await calculateDemandDetails(
                groupDoc._id,
                memberRecovery.memberId,
                memberRecovery,
                parsedDate,
                groupDoc
            );

            // Create new recovery session
            const total = (memberRecovery.amounts?.saving || 0) +
                (memberRecovery.amounts?.loan || 0) +
                (memberRecovery.amounts?.fd || 0) +
                (memberRecovery.amounts?.interest || 0) +
                (memberRecovery.amounts?.yogdan || 0) +
                (memberRecovery.amounts?.memFeesSHG || 0) +
                (memberRecovery.amounts?.memFeesSamiti || 0) +
                (memberRecovery.amounts?.penalty || 0) +
                (memberRecovery.amounts?.other || 0) +
                (memberRecovery.amounts?.other1 || 0) + // Backward compatibility
                (memberRecovery.amounts?.other2 || 0); // Backward compatibility

            const memberTotal = memberRecovery.paymentMode?.cash ? total : 0;
            const onlineTotal = memberRecovery.paymentMode?.online ? total : 0;

            const newRecovery = await RecoveryMaster.create({
                groupId: groupDoc._id,
                groupName: groupDoc.group_name,
                groupCode: groupDoc.group_code,
                date: parsedDate,
                memberCount: 1,
                recoveries: [{
                    ...memberRecovery,
                    demandDetails,
                    total
                }],
                totals: {
                    totalCash: memberTotal,
                    totalOnline: onlineTotal,
                    totalAmount: total
                },
                status: "approved",
                createdBy: req.user?.id || "admin",
            });

            return apiResponse.success(res, "Recovery session created successfully", newRecovery);
        }
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Get recovery session for a specific date and group
export const getRecoveryByDate = async (req, res) => {
    try {
        const { groupId, date } = req.query;

        if (!groupId) {
            return apiResponse.error(res, "groupId is required", 400);
        }

        let parsedDate = date ? new Date(date) : new Date();
        if (typeof date === 'string' && date.includes('/')) {
            const parts = date.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const year = parseInt(parts[2], 10);
                parsedDate = new Date(year, month, day);
            }
        }

        const dateStart = new Date(parsedDate);
        dateStart.setHours(0, 0, 0, 0);
        const dateEnd = new Date(parsedDate);
        dateEnd.setHours(23, 59, 59, 999);

        const recovery = await RecoveryMaster.findOne({
            groupId,
            date: { $gte: dateStart, $lte: dateEnd }
        }).lean();

        if (!recovery) {
            return apiResponse.success(res, "No recovery session found for this date", null);
        }

        return apiResponse.success(res, "Recovery session fetched successfully", recovery);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Helper function to get previous recovery data for a member (checks same month first, then previous month)
const getPreviousRecoveryForMember = async (groupId, memberId, currentDate) => {
    try {
        // Parse current date
        let parsedDate = currentDate instanceof Date ? currentDate : new Date(currentDate);
        if (typeof currentDate === 'string' && currentDate.includes('/')) {
            const parts = currentDate.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const year = parseInt(parts[2], 10);
                parsedDate = new Date(year, month, day);
            }
        }

        // First, check for previous meeting in the same month (for groups with 2 meetings per month)
        const currentMonthStart = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1);
        const currentDateStart = new Date(parsedDate);
        currentDateStart.setHours(0, 0, 0, 0);

        const sameMonthRecoveries = await RecoveryMaster.find({
            groupId,
            date: { $gte: currentMonthStart, $lt: currentDateStart }
        })
            .sort({ date: -1 }) // Get most recent first
            .lean();

        // Find member's recovery in the same month (previous meeting)
        for (const recovery of sameMonthRecoveries) {
            const memberRecovery = recovery.recoveries?.find(
                r => r.memberId === memberId || r.memberId?.toString() === memberId?.toString()
            );

            if (memberRecovery) {
                // Return previous unpaid demands from demandDetails or calculate from amounts
                const demandDetails = memberRecovery.demandDetails || {};

                return {
                    loan: {
                        unpaidDemand: demandDetails.loan?.unpaidDemand || 0,
                        actualPaid: demandDetails.loan?.actualPaid || memberRecovery.amounts?.loan || 0,
                    },
                    interest: {
                        unpaidDemand: demandDetails.interest?.unpaidDemand || 0,
                        actualPaid: demandDetails.interest?.actualPaid || memberRecovery.amounts?.interest || 0,
                    },
                    saving: {
                        unpaidDemand: demandDetails.saving?.unpaidDemand || 0,
                        actualPaid: demandDetails.saving?.actualPaid || memberRecovery.amounts?.saving || 0,
                        totalDemand: demandDetails.saving?.totalDemand || 0,
                    },
                };
            }
        }

        // If not found in same month, check previous month
        const prevMonth = new Date(parsedDate);
        prevMonth.setMonth(prevMonth.getMonth() - 1);

        // Find all recovery sessions in the previous month
        const prevMonthStart = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1);
        const prevMonthEnd = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0, 23, 59, 59, 999);

        const previousRecoveries = await RecoveryMaster.find({
            groupId,
            date: { $gte: prevMonthStart, $lte: prevMonthEnd }
        })
            .sort({ date: -1 }) // Get most recent first
            .lean();

        // Find member's recovery in the most recent previous recovery session
        for (const recovery of previousRecoveries) {
            const memberRecovery = recovery.recoveries?.find(
                r => r.memberId === memberId || r.memberId?.toString() === memberId?.toString()
            );

            if (memberRecovery) {
                // Return previous unpaid demands from demandDetails or calculate from amounts
                const demandDetails = memberRecovery.demandDetails || {};

                return {
                    loan: {
                        unpaidDemand: demandDetails.loan?.unpaidDemand || 0,
                        actualPaid: demandDetails.loan?.actualPaid || memberRecovery.amounts?.loan || 0,
                    },
                    interest: {
                        unpaidDemand: demandDetails.interest?.unpaidDemand || 0,
                        actualPaid: demandDetails.interest?.actualPaid || memberRecovery.amounts?.interest || 0,
                    },
                    saving: {
                        unpaidDemand: demandDetails.saving?.unpaidDemand || 0,
                        actualPaid: demandDetails.saving?.actualPaid || memberRecovery.amounts?.saving || 0,
                        totalDemand: demandDetails.saving?.totalDemand || 0,
                    },
                };
            }
        }

        // No previous recovery found
        return {
            loan: { unpaidDemand: 0, actualPaid: 0 },
            interest: { unpaidDemand: 0, actualPaid: 0 },
            saving: { unpaidDemand: 0, actualPaid: 0, totalDemand: 0 },
        };
    } catch (error) {
        console.error("Error getting previous recovery:", error);
        return {
            loan: { unpaidDemand: 0, actualPaid: 0 },
            interest: { unpaidDemand: 0, actualPaid: 0 },
            saving: { unpaidDemand: 0, actualPaid: 0, totalDemand: 0 },
        };
    }
};

// Helper function to calculate cumulative loan/interest payments
const getCumulativePayments = async (groupId, memberId, currentDate, type = 'loan') => {
    try {
        let parsedDate = currentDate instanceof Date ? currentDate : new Date(currentDate);
        if (typeof currentDate === 'string' && currentDate.includes('/')) {
            const parts = currentDate.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const year = parseInt(parts[2], 10);
                parsedDate = new Date(year, month, day);
            }
        }

        // Get all recovery sessions before current date
        const dateStart = new Date(parsedDate);
        dateStart.setHours(0, 0, 0, 0);

        const previousRecoveries = await RecoveryMaster.find({
            groupId,
            date: { $lt: dateStart }
        })
            .sort({ date: 1 })
            .lean();

        let cumulative = 0;
        for (const recovery of previousRecoveries) {
            const memberRecovery = recovery.recoveries?.find(
                r => r.memberId === memberId || r.memberId?.toString() === memberId?.toString()
            );

            if (memberRecovery) {
                if (type === 'loan') {
                    cumulative += memberRecovery.amounts?.loan || 0;
                } else if (type === 'interest') {
                    cumulative += memberRecovery.amounts?.interest || 0;
                }
            }
        }

        return cumulative;
    } catch (error) {
        console.error("Error calculating cumulative payments:", error);
        return 0;
    }
};

// Helper function to calculate demand details for a member
const calculateDemandDetails = async (groupId, memberId, memberRecovery, currentDate, groupDoc) => {
    try {
        // Get previous recovery data
        const previousData = await getPreviousRecoveryForMember(groupId, memberId, currentDate);

        // Get member data
        const member = await Member.findById(memberId);
        if (!member) {
            throw new Error("Member not found");
        }

        // Get active loan for member
        const activeLoan = await LoanMaster.findOne({
            groupId,
            memberId: memberId.toString(),
            transactionType: "Loan",
            status: "approved"
        })
            .sort({ date: -1 })
            .lean();

        const amounts = memberRecovery.amounts || {};
        const actualLoan = amounts.loan || 0;
        const actualInterest = amounts.interest || 0;
        const actualSaving = amounts.saving || 0;
        const actualFd = amounts.fd || 0;

        // Calculate loan demand details
        // Get monthly installment amount
        let monthlyInstallment = activeLoan?.installment_amount || 0;

        // For existing members without activeLoan, try to get from member's loanDetails
        if (!activeLoan && member?.loanDetails?.amount > 0) {
            const memberInstallment = member?.loanDetails?.installment_amount;
            if (memberInstallment) {
                monthlyInstallment = parseFloat(memberInstallment) || 0;
            } else if (member?.loanDetails?.time_period) {
                // Calculate from amount and time_period: monthly installment = loan_amount / time_period
                const timePeriod = member.loanDetails.time_period || 0;
                if (timePeriod > 0) {
                    monthlyInstallment = (member.loanDetails.amount || 0) / timePeriod;
                }
            }
        }

        // Check if group has 2 meetings per month
        const meetingDay1 = groupDoc?.meeting_date_1_day;
        const meetingDay2 = groupDoc?.meeting_date_2_day;
        const hasTwoMeetings = meetingDay1 && meetingDay2;

        // If 2 meetings per month, divide monthly installment by 2 for each meeting
        const loanCurrDemand = hasTwoMeetings ? (monthlyInstallment / 2) : monthlyInstallment;

        const loanPrevDemand = previousData.loan.unpaidDemand || 0;
        const loanTotalDemand = loanPrevDemand + loanCurrDemand;
        const loanUnpaidDemand = Math.max(0, loanTotalDemand - actualLoan);
        const loanOpeningBalance = await getCumulativePayments(groupId, memberId, currentDate, 'loan');
        const loanClosingBalance = loanOpeningBalance + actualLoan;

        // Calculate interest demand details
        // Use overdue interest directly from member data as current month interest demand
        const interestOutstanding = member?.loanDetails?.overdueInterest || 0;
        const interestPrevDemand = previousData.interest.unpaidDemand || 0;
        const interestCurrDemand = interestOutstanding; // Current month interest = overdue interest
        const interestTotalDemand = interestPrevDemand + interestCurrDemand;
        const interestUnpaidDemand = Math.max(0, interestTotalDemand - actualInterest);
        const interestOpeningBalance = await getCumulativePayments(groupId, memberId, currentDate, 'interest');
        const interestClosingBalance = interestOpeningBalance + actualInterest;

        // Calculate saving demand details
        // For existing members, use snapshot saving_per_member if available
        let savingPerMember = groupDoc?.saving_per_member || 0;
        if (member.isExistingMember && member.saving_per_member_snapshot) {
            savingPerMember = member.saving_per_member_snapshot;
        }
        const savingPrevData = previousData.saving;

        // If previous month paid more than demand, previous demand = 0
        // Else previous demand = previous unpaid
        let savingPrevDemand = 0;
        if (savingPrevData.actualPaid > savingPrevData.totalDemand) {
            savingPrevDemand = 0;
        } else {
            savingPrevDemand = savingPrevData.unpaidDemand || 0;
        }

        const savingCurrDemand = savingPerMember;
        const savingTotalDemand = savingPrevDemand + savingCurrDemand;
        const savingUnpaidDemand = Math.max(0, savingTotalDemand - actualSaving);

        // Opening balance = openingSaving + all previous saving recoveries
        const openingSaving = member?.openingSaving || 0;

        // Parse currentDate for query
        let parsedCurrentDate = currentDate instanceof Date ? currentDate : new Date(currentDate);
        if (typeof currentDate === 'string' && currentDate.includes('/')) {
            const parts = currentDate.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const year = parseInt(parts[2], 10);
                parsedCurrentDate = new Date(year, month, day);
            }
        }

        const dateStart = new Date(parsedCurrentDate);
        dateStart.setHours(0, 0, 0, 0);

        const previousSavingRecoveries = await RecoveryMaster.find({
            groupId,
            date: { $lt: dateStart }
        })
            .sort({ date: 1 })
            .lean();

        let cumulativeSaving = openingSaving;
        for (const recovery of previousSavingRecoveries) {
            const memRec = recovery.recoveries?.find(
                r => r.memberId === memberId || r.memberId?.toString() === memberId?.toString()
            );
            if (memRec) {
                cumulativeSaving += memRec.amounts?.saving || 0;
            }
        }

        const savingOpeningBalance = cumulativeSaving;
        const savingClosingBalance = savingOpeningBalance + actualSaving;

        return {
            loan: {
                prevDemand: loanPrevDemand,
                currDemand: loanCurrDemand,
                totalDemand: loanTotalDemand,
                actualPaid: actualLoan,
                unpaidDemand: loanUnpaidDemand,
                openingBalance: loanOpeningBalance,
                closingBalance: loanClosingBalance,
            },
            interest: {
                prevDemand: interestPrevDemand,
                currDemand: interestCurrDemand,
                totalDemand: interestTotalDemand,
                actualPaid: actualInterest,
                unpaidDemand: interestUnpaidDemand,
                openingBalance: interestOpeningBalance,
                closingBalance: interestClosingBalance,
            },
            saving: {
                prevDemand: savingPrevDemand,
                currDemand: savingCurrDemand,
                totalDemand: savingTotalDemand,
                actualPaid: actualSaving,
                unpaidDemand: savingUnpaidDemand,
                openingBalance: savingOpeningBalance,
                closingBalance: savingClosingBalance,
            },
            fd: {
                prevDemand: 0,
                currDemand: 0,
                totalDemand: 0,
                actualPaid: actualFd,
                unpaidDemand: 0,
                openingBalance: member?.fdDetails?.amount || 0,
                closingBalance: (member?.fdDetails?.amount || 0) + actualFd,
            },
        };
    } catch (error) {
        console.error("Error calculating demand details:", error);
        // Return default structure on error
        return {
            loan: { prevDemand: 0, currDemand: 0, totalDemand: 0, actualPaid: 0, unpaidDemand: 0, openingBalance: 0, closingBalance: 0 },
            interest: { prevDemand: 0, currDemand: 0, totalDemand: 0, actualPaid: 0, unpaidDemand: 0, openingBalance: 0, closingBalance: 0 },
            saving: { prevDemand: 0, currDemand: 0, totalDemand: 0, actualPaid: 0, unpaidDemand: 0, openingBalance: 0, closingBalance: 0 },
            fd: { prevDemand: 0, currDemand: 0, totalDemand: 0, actualPaid: 0, unpaidDemand: 0, openingBalance: 0, closingBalance: 0 },
        };
    }
};

// API endpoint to get previous recovery data
export const getPreviousRecoveryData = async (req, res) => {
    try {
        const { groupId, memberId, date } = req.query;

        if (!groupId || !memberId) {
            return apiResponse.error(res, "groupId and memberId are required", 400);
        }

        const currentDate = date || new Date();
        const previousData = await getPreviousRecoveryForMember(groupId, memberId, currentDate);

        return apiResponse.success(res, "Previous recovery data fetched successfully", previousData);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Update recovery session with group photo
export const updateRecoveryPhoto = async (req, res) => {
    try {
        const { groupId, date, groupPhoto } = req.body;

        if (!groupId || !groupPhoto) {
            return apiResponse.error(res, "groupId and groupPhoto are required", 400);
        }

        let parsedDate = date ? new Date(date) : new Date();
        if (typeof date === 'string' && date.includes('/')) {
            const parts = date.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const year = parseInt(parts[2], 10);
                parsedDate = new Date(year, month, day);
            }
        }

        const dateStart = new Date(parsedDate);
        dateStart.setHours(0, 0, 0, 0);
        const dateEnd = new Date(parsedDate);
        dateEnd.setHours(23, 59, 59, 999);

        const recovery = await RecoveryMaster.findOne({
            groupId,
            date: { $gte: dateStart, $lte: dateEnd }
        });

        if (!recovery) {
            return apiResponse.error(res, "Recovery session not found for this date", 404);
        }

        recovery.groupPhoto = groupPhoto;
        await recovery.save();

        return apiResponse.success(res, "Group photo updated successfully", recovery);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

