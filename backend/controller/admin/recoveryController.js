import apiResponse from "../../utility/apiResponse.js";
import message from "../../utility/message.js";
import RecoveryMaster from "../../model/RecoveryMaster.js";
import { GroupMaster, FDMaster } from "../../model/index.js";
import LoanMaster from "../../model/LoanMaster.js";
import Member from "../../model/Member.js";
import { createBankTransactionRecord } from "../../utility/bankTransactionHelper.js";
import { createCashTransactionRecord } from "../../utility/cashTransactionHelper.js";

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

        // Update member's lastMembershipPaidDate and lastMembershipGroupPaidDate if membership fees were paid
        // Also create bank transaction records for online payments
        if (recovery.recoveries && Array.isArray(recovery.recoveries)) {
            console.log("[RECOVERY] Processing recoveries array, count:", recovery.recoveries.length);
            for (const memberRecovery of recovery.recoveries) {
                // Calculate total if not set
                if (!memberRecovery.total || memberRecovery.total === 0) {
                    const amounts = memberRecovery.amounts || {};
                    // Calculate charges total
                    const chargesTotal = amounts.charges ?
                        Object.values(amounts.charges).reduce((sum, amount) => sum + (amount || 0), 0) : 0;

                    memberRecovery.total = (amounts.saving || 0) +
                        (amounts.loan || 0) +
                        (amounts.interest || 0) +
                        (amounts.yogdan || 0) +
                        (amounts.memFeesSHG || 0) +
                        (amounts.memFeesSamiti || 0) +
                        (amounts.memFeesGroup || 0) +
                        (amounts.penalty || 0) +
                        (amounts.other || 0) +
                        (amounts.fd || 0) +
                        chargesTotal;
                    console.log("[RECOVERY] Calculated total for member:", {
                        memberCode: memberRecovery.memberCode,
                        calculatedTotal: memberRecovery.total
                    });
                }

                // Mark yogdan as collected for loans when yogdan is paid
                if (memberRecovery.amounts?.yogdan > 0 && memberRecovery.memberId) {
                    // Find loans for this member where yogdan hasn't been collected yet
                    const memberLoans = await LoanMaster.find({
                        groupId: groupDoc._id,
                        memberId: memberRecovery.memberId.toString(),
                        transactionType: "Loan",
                        status: "approved",
                        yogdanCollected: false,
                        date: { $lte: parsedDate } // Loan date should be before or on recovery date
                    })
                        .sort({ date: 1 })
                        .lean();

                    let remainingYogdan = memberRecovery.amounts.yogdan;
                    for (const loan of memberLoans) {
                        if (remainingYogdan <= 0) break;

                        const loanAmount = loan.amount || 0;
                        const yogdanAmount = loan.yogdanAmount || (loanAmount * 0.01);

                        if (remainingYogdan >= yogdanAmount) {
                            // Mark this loan's yogdan as collected
                            await LoanMaster.findByIdAndUpdate(loan._id, {
                                yogdanCollected: true,
                                yogdanAmount: yogdanAmount
                            });
                            remainingYogdan -= yogdanAmount;
                        }
                    }
                }
                if (memberRecovery.amounts?.memFeesSHG > 0 && memberRecovery.memberId) {
                    const member = await Member.findById(memberRecovery.memberId);
                    if (member) {
                        member.lastMembershipPaidDate = parsedDate;
                        await member.save();
                    }
                }
                if (memberRecovery.amounts?.memFeesGroup > 0 && memberRecovery.memberId) {
                    const member = await Member.findById(memberRecovery.memberId);
                    if (member) {
                        member.lastMembershipGroupPaidDate = parsedDate;
                        await member.save();
                    }
                }

                // Create bank transaction record if online payment with bank
                if (memberRecovery.paymentMode?.online && memberRecovery.bankId && memberRecovery.total > 0) {
                    const totalAmount = memberRecovery.total || 0;
                    await createBankTransactionRecord({
                        bankId: memberRecovery.bankId,
                        groupId: groupDoc._id,
                        transactionType: "recovery",
                        amount: totalAmount,
                        date: parsedDate,
                        onlineRef: memberRecovery.onlineRef || null,
                        receipt: memberRecovery.screenshot || null,
                        description: `Recovery payment - Member: ${memberRecovery.memberName} (${memberRecovery.memberCode})`,
                        recoveryId: recovery._id,
                        recoveryMemberId: memberRecovery.memberId,
                        memberId: memberRecovery.memberId,
                        memberCode: memberRecovery.memberCode,
                        memberName: memberRecovery.memberName,
                        createdBy: req.user?.id || "admin",
                    });
                }

                // Create cash transaction record if cash payment
                // Handle different paymentMode formats
                const isCashPayment = memberRecovery.paymentMode?.cash === true ||
                    memberRecovery.paymentMode?.cash === "true" ||
                    (typeof memberRecovery.paymentMode === 'object' && memberRecovery.paymentMode?.cash);
                const hasTotal = memberRecovery.total > 0;

                console.log("[RECOVERY] Checking cash payment for member:", {
                    memberId: memberRecovery.memberId,
                    memberCode: memberRecovery.memberCode,
                    paymentMode: memberRecovery.paymentMode,
                    paymentModeType: typeof memberRecovery.paymentMode,
                    paymentModeCash: memberRecovery.paymentMode?.cash,
                    paymentModeCashType: typeof memberRecovery.paymentMode?.cash,
                    isCashPayment,
                    total: memberRecovery.total,
                    totalType: typeof memberRecovery.total,
                    hasTotal,
                    conditionMet: isCashPayment && hasTotal
                });

                if (isCashPayment && hasTotal) {
                    const totalAmount = memberRecovery.total || 0;
                    console.log("[RECOVERY] Creating cash transaction record:", {
                        groupId: groupDoc._id,
                        transactionType: "recovery",
                        amount: totalAmount,
                        memberCode: memberRecovery.memberCode,
                        memberName: memberRecovery.memberName
                    });

                    try {
                        const cashTransactionResult = await createCashTransactionRecord({
                            groupId: groupDoc._id,
                            transactionType: "recovery",
                            amount: totalAmount,
                            date: parsedDate,
                            receipt: memberRecovery.screenshot || null,
                            description: `Recovery payment - Member: ${memberRecovery.memberName} (${memberRecovery.memberCode})`,
                            recoveryId: recovery._id,
                            recoveryMemberId: memberRecovery.memberId,
                            memberId: memberRecovery.memberId,
                            memberCode: memberRecovery.memberCode,
                            memberName: memberRecovery.memberName,
                            createdBy: req.user?.id || "admin",
                        });

                    } catch (cashError) {
                        console.error("[RECOVERY] Error creating cash transaction:", cashError);
                        // Don't throw - allow recovery to be saved even if cash transaction fails
                    }
                }
            }
        }

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
        parsedDate.setHours(0, 0, 0, 0);

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
                        (memberRecovery.amounts?.memFeesGroup || 0) +
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
                    (memberRecovery.amounts?.memFeesGroup || 0) +
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
                        (amounts.memFeesGroup || 0) +
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

            // Update member's lastMembershipPaidDate if membership fees were paid
            if (memberRecovery.amounts?.memFeesSHG > 0) {
                const member = await Member.findById(memberRecovery.memberId);
                if (member) {
                    member.lastMembershipPaidDate = parsedDate;
                    await member.save();
                }
            }
            // Update member's lastMembershipGroupPaidDate if membership group was paid
            if (memberRecovery.amounts?.memFeesGroup > 0) {
                const member = await Member.findById(memberRecovery.memberId);
                if (member) {
                    member.lastMembershipGroupPaidDate = parsedDate;
                    await member.save();
                }
            }

            // Create bank transaction record if online payment with bank
            if (memberRecovery.paymentMode?.online && memberRecovery.bankId) {
                const totalAmount = memberRecovery.total || 0;
                if (totalAmount > 0) {
                    await createBankTransactionRecord({
                        bankId: memberRecovery.bankId,
                        groupId: groupDoc._id,
                        transactionType: "recovery",
                        amount: totalAmount,
                        date: parsedDate,
                        onlineRef: memberRecovery.onlineRef || null,
                        receipt: memberRecovery.screenshot || null,
                        description: `Recovery payment - Member: ${memberRecovery.memberName} (${memberRecovery.memberCode})`,
                        recoveryId: recoverySession._id,
                        recoveryMemberId: memberRecovery.memberId,
                        memberId: memberRecovery.memberId,
                        memberCode: memberRecovery.memberCode,
                        memberName: memberRecovery.memberName,
                        createdBy: req.user?.id || "admin",
                    });
                }
            }

            // Create cash transaction record if cash payment
            const isCashPayment = memberRecovery.paymentMode?.cash === true ||
                memberRecovery.paymentMode?.cash === "true" ||
                (typeof memberRecovery.paymentMode === 'object' && memberRecovery.paymentMode?.cash);
            const cashTotalAmount = memberRecovery.total || 0;
            const hasTotal = cashTotalAmount > 0;

            if (isCashPayment && hasTotal) {
                try {
                    await createCashTransactionRecord({
                        groupId: groupDoc._id,
                        transactionType: "recovery",
                        amount: cashTotalAmount,
                        date: parsedDate,
                        receipt: memberRecovery.screenshot || null,
                        description: `Recovery payment - Member: ${memberRecovery.memberName} (${memberRecovery.memberCode})`,
                        recoveryId: recoverySession._id,
                        recoveryMemberId: memberRecovery.memberId,
                        memberId: memberRecovery.memberId,
                        memberCode: memberRecovery.memberCode,
                        memberName: memberRecovery.memberName,
                        createdBy: req.user?.id || "admin",
                    });
                } catch (cashError) {
                    console.error("[UPDATE_MEMBER_RECOVERY] Error creating cash transaction:", cashError);
                    // Don't throw - allow recovery to be saved even if cash transaction fails
                }
            }

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
                (memberRecovery.amounts?.memFeesGroup || 0) +
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

            // Update member's lastMembershipPaidDate if membership fees were paid
            if (memberRecovery.amounts?.memFeesSHG > 0) {
                const member = await Member.findById(memberRecovery.memberId);
                if (member) {
                    member.lastMembershipPaidDate = parsedDate;
                    await member.save();
                }
            }
            // Update member's lastMembershipGroupPaidDate if membership group was paid
            if (memberRecovery.amounts?.memFeesGroup > 0) {
                const member = await Member.findById(memberRecovery.memberId);
                if (member) {
                    member.lastMembershipGroupPaidDate = parsedDate;
                    await member.save();
                }
            }

            // Create bank transaction record if online payment with bank
            if (memberRecovery.paymentMode?.online && memberRecovery.bankId && total > 0) {
                await createBankTransactionRecord({
                    bankId: memberRecovery.bankId,
                    groupId: groupDoc._id,
                    transactionType: "recovery",
                    amount: total,
                    date: parsedDate,
                    onlineRef: memberRecovery.onlineRef || null,
                    receipt: memberRecovery.screenshot || null,
                    description: `Recovery payment - Member: ${memberRecovery.memberName} (${memberRecovery.memberCode})`,
                    recoveryId: newRecovery._id,
                    recoveryMemberId: memberRecovery.memberId,
                    memberId: memberRecovery.memberId,
                    memberCode: memberRecovery.memberCode,
                    memberName: memberRecovery.memberName,
                    createdBy: req.user?.id || "admin",
                });
            }

            // Create cash transaction record if cash payment
            const isCashPaymentNew = memberRecovery.paymentMode?.cash === true ||
                memberRecovery.paymentMode?.cash === "true" ||
                (typeof memberRecovery.paymentMode === 'object' && memberRecovery.paymentMode?.cash);

            if (isCashPaymentNew && total > 0) {
                try {
                    await createCashTransactionRecord({
                        groupId: groupDoc._id,
                        transactionType: "recovery",
                        amount: total,
                        date: parsedDate,
                        receipt: memberRecovery.screenshot || null,
                        description: `Recovery payment - Member: ${memberRecovery.memberName} (${memberRecovery.memberCode})`,
                        recoveryId: newRecovery._id,
                        recoveryMemberId: memberRecovery.memberId,
                        memberId: memberRecovery.memberId,
                        memberCode: memberRecovery.memberCode,
                        memberName: memberRecovery.memberName,
                        createdBy: req.user?.id || "admin",
                    });
                } catch (cashError) {
                    console.error("[UPDATE_MEMBER_RECOVERY] Error creating cash transaction (new session):", cashError);
                    // Don't throw - allow recovery to be saved even if cash transaction fails
                }
            }

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
        parsedDate.setHours(0, 0, 0, 0);

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

        // Parse currentDate FIRST before using it anywhere
        let parsedCurrentDate = currentDate instanceof Date ? new Date(currentDate) : new Date(currentDate);
        if (typeof currentDate === 'string' && currentDate.includes('/')) {
            const parts = currentDate.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const year = parseInt(parts[2], 10);
                parsedCurrentDate = new Date(year, month, day);
            }
        }
        // Normalize to start of day
        parsedCurrentDate.setHours(0, 0, 0, 0);

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

        // Calculate interest demand details - Daily calculation from loan date to meeting date
        let interestCurrDemand = 0;
        const interestPrevDemand = previousData.interest.unpaidDemand || 0;

        // Get loan details for interest calculation
        const loanAmount = activeLoan?.amount || member?.loanDetails?.amount || 0;
        const loanDateRaw = activeLoan?.date || member?.loanDetails?.loanDate;
        const loanDate = loanDateRaw ? new Date(loanDateRaw) : null;
        const loanRate = activeLoan?.loan_rate_snapshot || groupDoc?.loan_rate || 0;

        if (loanAmount > 0 && loanDate && loanRate > 0) {
            // Calculate days between loan date and current meeting date
            const meetingDate = parsedCurrentDate;

            // Normalize both dates to start of day for accurate day calculation
            const loanDateStart = new Date(loanDate);
            loanDateStart.setHours(0, 0, 0, 0);
            const meetingDateStart = new Date(meetingDate);
            meetingDateStart.setHours(0, 0, 0, 0);

            const timeDiff = meetingDateStart.getTime() - loanDateStart.getTime();
            const daysDiff = Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60 * 24))); // Use floor, not ceil, and ensure non-negative

            if (daysDiff > 0) {
                // Check if it's a leap year for accurate calculation
                const isLeapYear = (year) => {
                    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
                };
                const daysInYear = isLeapYear(meetingDate.getFullYear()) ? 366 : 365;

                // Daily interest calculation: (loanAmount * annualRate / 100 / daysInYear) * numberOfDays
                const interestBeforeRound = (loanAmount * loanRate / 100 / daysInYear) * daysDiff;
                interestCurrDemand = Math.round(interestBeforeRound * 100) / 100;
            }
        } else {
            // Fallback to overdue interest if calculation not possible
            interestCurrDemand = member?.loanDetails?.overdueInterest || 0;
        }

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

        // parsedCurrentDate is already defined at the top of the function
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

        // Calculate Yogdan demand from loans (1% of loan amount)
        // Get all approved loans for this member where yogdan hasn't been collected yet
        // Yogdan is collected at the next meeting after loan disbursement
        const memberLoans = await LoanMaster.find({
            groupId,
            memberId: memberId.toString(),
            transactionType: "Loan",
            status: "approved"
        })
            .sort({ date: 1 })
            .lean();

        // Calculate yogdan for loans that haven't had yogdan collected yet
        // Check if loan date is before current meeting date
        let totalYogdanDue = 0;
        for (const loan of memberLoans) {
            const loanDate = new Date(loan.date);
            const loanAmount = loan.amount || 0;

            // If yogdan hasn't been collected and loan date is before current meeting
            if (!loan.yogdanCollected && loanDate < parsedCurrentDate) {
                // Calculate 1% yogdan
                const yogdanAmount = loanAmount * 0.01;
                totalYogdanDue += yogdanAmount;
            } else if (loan.yogdanAmount && loan.yogdanAmount > 0 && !loan.yogdanCollected) {
                // Use existing yogdanAmount if set
                totalYogdanDue += loan.yogdanAmount;
            }
        }

        // Get previous Yogdan payments from recoveries
        const previousYogdanRecoveries = await RecoveryMaster.find({
            groupId,
            date: { $lt: dateStart }
        })
            .sort({ date: 1 })
            .lean();

        let cumulativeYogdanPaid = member?.openingYogdan || 0;
        for (const recovery of previousYogdanRecoveries) {
            const memRec = recovery.recoveries?.find(
                r => r.memberId === memberId || r.memberId?.toString() === memberId?.toString()
            );
            if (memRec) {
                cumulativeYogdanPaid += memRec.amounts?.yogdan || 0;
            }
        }

        const actualYogdan = amounts.yogdan || 0;
        const yogdanOpeningBalance = cumulativeYogdanPaid;
        const yogdanTotalDemand = totalYogdanDue; // Total Yogdan due from all loans
        const yogdanUnpaidDemand = Math.max(0, yogdanTotalDemand - cumulativeYogdanPaid - actualYogdan);
        const yogdanClosingBalance = yogdanOpeningBalance + actualYogdan;

        // Calculate membership fees due
        const membershipDue = calculateMembershipDue(member, groupDoc, currentDate);
        const actualMemFeesSHG = amounts.memFeesSHG || 0;
        const actualMemFeesGroup = amounts.memFeesGroup || 0;

        // Calculate charges due
        const chargesDue = await calculateChargesDue(member, groupDoc, currentDate, groupId);
        const actualCharges = amounts.charges || {};
        const totalChargesDue = Object.values(chargesDue).reduce((sum, amount) => sum + amount, 0);
        const totalChargesPaid = Object.values(actualCharges).reduce((sum, amount) => sum + amount, 0);

        // Calculate FD details
        // FD doesn't have a recurring demand like saving/loan, but we show current FD balance
        // and allow adding new FD during recovery
        const memberFDs = await FDMaster.find({
            groupId,
            memberId: memberId.toString(),
            status: "active"
        })
            .sort({ date: -1 })
            .lean();

        // Get total FD amount from active FDs
        const totalFDAmount = memberFDs.reduce((sum, fd) => sum + (fd.principal || 0), 0);

        // Get previous FD payments from recoveries
        const previousFdRecoveries = await RecoveryMaster.find({
            groupId,
            date: { $lt: dateStart }
        })
            .sort({ date: 1 })
            .lean();

        let cumulativeFdPaid = member?.fdDetails?.amount || 0;
        for (const recovery of previousFdRecoveries) {
            const memRec = recovery.recoveries?.find(
                r => r.memberId === memberId || r.memberId?.toString() === memberId?.toString()
            );
            if (memRec) {
                cumulativeFdPaid += memRec.amounts?.fd || 0;
            }
        }

        // FD opening balance = current FD amount from member or FDMaster
        const fdOpeningBalance = totalFDAmount || member?.fdDetails?.amount || 0;

        // FD doesn't have demand, but we show it for reference
        // currDemand can be set to 0 or can show any pending FD commitment if needed
        const fdPrevDemand = 0;
        const fdCurrDemand = 0; // FD is optional, no recurring demand
        const fdTotalDemand = 0; // No demand for FD
        const fdUnpaidDemand = 0; // No unpaid demand
        const fdClosingBalance = fdOpeningBalance + actualFd;

        const demandResult = {
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
                prevDemand: fdPrevDemand,
                currDemand: fdCurrDemand,
                totalDemand: fdTotalDemand,
                actualPaid: actualFd,
                unpaidDemand: fdUnpaidDemand,
                openingBalance: fdOpeningBalance,
                closingBalance: fdClosingBalance,
            },
            yogdan: {
                prevDemand: 0,
                currDemand: yogdanTotalDemand,
                totalDemand: yogdanTotalDemand,
                actualPaid: actualYogdan,
                unpaidDemand: yogdanUnpaidDemand,
                openingBalance: yogdanOpeningBalance,
                closingBalance: yogdanClosingBalance,
            },
            membership: {
                membershipFeesDue: membershipDue.membershipFeesDue,
                membershipGroupDue: membershipDue.membershipGroupDue,
                actualMemFeesSHG: actualMemFeesSHG,
                actualMemFeesGroup: actualMemFeesGroup,
            },
            charges: {
                chargesDue: chargesDue,
                totalChargesDue: totalChargesDue,
                actualCharges: actualCharges,
                totalChargesPaid: totalChargesPaid,
            },
        };

        return demandResult;
    } catch (error) {
        console.error("[DEMAND_CALCULATION] Error calculating demand details:", error);
        // Return default structure on error
        return {
            loan: { prevDemand: 0, currDemand: 0, totalDemand: 0, actualPaid: 0, unpaidDemand: 0, openingBalance: 0, closingBalance: 0 },
            interest: { prevDemand: 0, currDemand: 0, totalDemand: 0, actualPaid: 0, unpaidDemand: 0, openingBalance: 0, closingBalance: 0 },
            saving: { prevDemand: 0, currDemand: 0, totalDemand: 0, actualPaid: 0, unpaidDemand: 0, openingBalance: 0, closingBalance: 0 },
            fd: { prevDemand: 0, currDemand: 0, totalDemand: 0, actualPaid: 0, unpaidDemand: 0, openingBalance: 0, closingBalance: 0 },
            yogdan: { prevDemand: 0, currDemand: 0, totalDemand: 0, actualPaid: 0, unpaidDemand: 0, openingBalance: 0, closingBalance: 0 },
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

// API endpoint to get demand details for a member (without requiring a recovery session)
export const getDemandDetails = async (req, res) => {
    try {
        const { groupId, memberId, date } = req.query;

        if (!groupId || !memberId) {
            return apiResponse.error(res, "groupId and memberId are required", 400);
        }

        // Get group document
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
        parsedDate.setHours(0, 0, 0, 0);

        // Create empty memberRecovery object for calculation
        const emptyMemberRecovery = {
            amounts: {}
        };

        // Calculate demand details
        const demandDetails = await calculateDemandDetails(
            groupId,
            memberId,
            emptyMemberRecovery,
            parsedDate,
            groupDoc
        );

        return apiResponse.success(res, "Demand details calculated successfully", demandDetails);
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

// Calculate charges due for a member based on charge cycles
const calculateChargesDue = async (member, group, currentDate, groupId) => {
    try {
        if (!group.charges || group.charges.length === 0) {
            return {};
        }

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

        const currentYear = parsedDate.getFullYear();
        const currentMonth = parsedDate.getMonth();
        const currentDay = parsedDate.getDate();

        // Get member join date
        const joinDate = member.Dt_Join || member.Member_Dt || member.createdAt;
        const joinYear = joinDate ? new Date(joinDate).getFullYear() : currentYear;
        const joinMonth = joinDate ? new Date(joinDate).getMonth() : currentMonth;
        const joinDay = joinDate ? new Date(joinDate).getDate() : currentDay;

        // Get previous charge payments from recoveries
        const dateStart = new Date(parsedDate);
        dateStart.setHours(0, 0, 0, 0);

        const previousRecoveries = await RecoveryMaster.find({
            groupId,
            date: { $lt: dateStart }
        })
            .sort({ date: 1 })
            .lean();

        // Track which charges have been paid
        const chargePayments = {};
        for (const recovery of previousRecoveries) {
            const memRec = recovery.recoveries?.find(
                r => r.memberId === member._id.toString() || r.memberId?.toString() === member._id.toString()
            );
            if (memRec && memRec.amounts?.charges) {
                Object.keys(memRec.amounts.charges).forEach(chargeName => {
                    if (!chargePayments[chargeName]) {
                        chargePayments[chargeName] = 0;
                    }
                    chargePayments[chargeName] += memRec.amounts.charges[chargeName] || 0;
                });
            }
        }

        const chargesDue = {};
        const activeCharges = group.charges.filter(c => c.isActive !== false);

        for (const charge of activeCharges) {
            const chargeStartDate = new Date(charge.startDate);
            const chargeStartYear = chargeStartDate.getFullYear();
            const chargeStartMonth = chargeStartDate.getMonth();
            const chargeStartDay = chargeStartDate.getDate();

            if (charge.type === "one-time") {
                // One-time charge: due if not paid yet
                const chargePaid = chargePayments[charge.name] || 0;
                if (chargePaid < charge.amount) {
                    chargesDue[charge.name] = charge.amount - chargePaid;
                }
            } else if (charge.type === "recurring") {
                // Recurring charge: align with charge's startDate cycle, not member join date
                if (charge.frequency === "yearly") {
                    // Yearly: calculate based on charge start date cycle
                    // Find the current cycle start date
                    let cycleStartYear = chargeStartYear;
                    if (currentYear > chargeStartYear ||
                        (currentYear === chargeStartYear && currentMonth > chargeStartMonth) ||
                        (currentYear === chargeStartYear && currentMonth === chargeStartMonth && currentDay >= chargeStartDay)) {
                        // Current date is on or after this year's cycle start
                        cycleStartYear = currentYear;
                    } else {
                        // Current date is before this year's cycle start
                        cycleStartYear = currentYear - 1;
                    }

                    const currentCycleStart = new Date(cycleStartYear, chargeStartMonth, chargeStartDay);
                    const nextCycleStart = new Date(cycleStartYear + 1, chargeStartMonth, chargeStartDay);

                    // Check if member joined before current cycle start
                    // If member joined mid-cycle, they pay at next cycle start (not based on join date)
                    const memberJoinedBeforeCycle = joinYear < cycleStartYear ||
                        (joinYear === cycleStartYear && joinMonth < chargeStartMonth) ||
                        (joinYear === cycleStartYear && joinMonth === chargeStartMonth && joinDay < chargeStartDay);

                    // Check if we're at or past the cycle start date
                    const isCycleStart = currentYear === cycleStartYear &&
                        currentMonth === chargeStartMonth &&
                        currentDay >= chargeStartDay;

                    // Check if member has paid for current cycle
                    // We need to check if payment was made on or after currentCycleStart
                    let paidForCurrentCycle = false;
                    for (const recovery of previousRecoveries) {
                        const memRec = recovery.recoveries?.find(
                            r => r.memberId === member._id.toString() || r.memberId?.toString() === member._id.toString()
                        );
                        if (memRec && memRec.amounts?.charges?.[charge.name] > 0) {
                            const recoveryDate = new Date(recovery.date);
                            if (recoveryDate >= currentCycleStart) {
                                paidForCurrentCycle = true;
                                break;
                            }
                        }
                    }

                    // Charge is due if:
                    // 1. We're at cycle start date, OR
                    // 2. Member hasn't paid for current cycle and (member joined before cycle OR we're past cycle start)
                    if (isCycleStart || (!paidForCurrentCycle && (memberJoinedBeforeCycle || parsedDate >= currentCycleStart))) {
                        chargesDue[charge.name] = charge.amount;
                    }
                } else if (charge.frequency === "monthly") {
                    // Monthly: calculate based on charge start date cycle
                    let cycleStartYear = chargeStartYear;
                    let cycleStartMonth = chargeStartMonth;

                    // Find current cycle start
                    if (currentYear > chargeStartYear ||
                        (currentYear === chargeStartYear && currentMonth > chargeStartMonth) ||
                        (currentYear === chargeStartYear && currentMonth === chargeStartMonth && currentDay >= chargeStartDay)) {
                        cycleStartYear = currentYear;
                        cycleStartMonth = currentMonth;
                        if (currentDay < chargeStartDay) {
                            cycleStartMonth = currentMonth - 1;
                            if (cycleStartMonth < 0) {
                                cycleStartMonth = 11;
                                cycleStartYear = currentYear - 1;
                            }
                        }
                    } else {
                        cycleStartYear = currentYear - 1;
                        cycleStartMonth = 11; // December of previous year
                    }

                    const currentCycleStart = new Date(cycleStartYear, cycleStartMonth, chargeStartDay);
                    const nextCycleStart = new Date(cycleStartYear, cycleStartMonth + 1, chargeStartDay);

                    // Check if member has paid for current cycle
                    let paidForCurrentCycle = false;
                    for (const recovery of previousRecoveries) {
                        const memRec = recovery.recoveries?.find(
                            r => r.memberId === member._id.toString() || r.memberId?.toString() === member._id.toString()
                        );
                        if (memRec && memRec.amounts?.charges?.[charge.name] > 0) {
                            const recoveryDate = new Date(recovery.date);
                            if (recoveryDate >= currentCycleStart && recoveryDate < nextCycleStart) {
                                paidForCurrentCycle = true;
                                break;
                            }
                        }
                    }

                    // Charge is due if not paid for current cycle
                    if (!paidForCurrentCycle && parsedDate >= currentCycleStart) {
                        chargesDue[charge.name] = charge.amount;
                    }
                }
            }
        }

        return chargesDue;
    } catch (error) {
        console.error("Error calculating charges due:", error);
        return {};
    }
};

// Calculate membership fees due based on April-to-April cycle
const calculateMembershipDue = (member, group, currentDate) => {
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

        const currentYear = parsedDate.getFullYear();
        const currentMonth = parsedDate.getMonth(); // 0-indexed (0 = January, 3 = April)
        const currentDay = parsedDate.getDate();

        // Get member join date
        const joinDate = member.Dt_Join || member.Member_Dt || member.createdAt;
        const joinYear = joinDate ? new Date(joinDate).getFullYear() : currentYear;
        const joinMonth = joinDate ? new Date(joinDate).getMonth() : currentMonth;

        // April is month 3 (0-indexed)
        const APRIL_MONTH = 3;
        const currentApril1 = new Date(currentYear, APRIL_MONTH, 1);
        const nextApril1 = new Date(currentYear + 1, APRIL_MONTH, 1);

        // Get last payment dates
        const lastMembershipPaidDate = member.lastMembershipPaidDate ? new Date(member.lastMembershipPaidDate) : null;
        const lastMembershipGroupPaidDate = member.lastMembershipGroupPaidDate ? new Date(member.lastMembershipGroupPaidDate) : null;

        // Get amounts from group
        const membershipFees = group.membership_fees || 0;
        const membershipGroup = group.Mship_Group || 0;

        let membershipFeesDue = 0;
        let membershipGroupDue = 0;

        // Check if current month is April (first meeting month)
        const isApril = currentMonth === APRIL_MONTH;

        // Fixed logic: Align with cycle start (April), not member join date
        // If member joins mid-cycle (e.g., July 2026 when cycle starts in April 2026),
        // next fee should be April 2027 (next cycle start), not July 2027

        if (isApril) {
            // In April, all members pay for next year (April to April)
            membershipFeesDue = membershipFees;
            membershipGroupDue = membershipGroup;
        } else {
            // Not April - check if member needs to pay
            // Key fix: Member join date doesn't determine next payment date
            // Next payment is always at next cycle start (April), regardless of when they joined

            // For membership_fees:
            if (!lastMembershipPaidDate || lastMembershipPaidDate < currentApril1) {
                // Member hasn't paid for current year (or never paid)
                // Fee is due regardless of when they joined - they pay at next cycle start
                // But if we're past April 1, they owe for current cycle
                if (parsedDate >= currentApril1) {
                    membershipFeesDue = membershipFees;
                }
            }
            // If lastMembershipPaidDate >= currentApril1, member already paid for current year

            // For membership group (same logic):
            if (!lastMembershipGroupPaidDate || lastMembershipGroupPaidDate < currentApril1) {
                if (parsedDate >= currentApril1) {
                    membershipGroupDue = membershipGroup;
                }
            }
        }

        return {
            membershipFeesDue,
            membershipGroupDue
        };
    } catch (error) {
        console.error("Error calculating membership due:", error);
        return {
            membershipFeesDue: 0,
            membershipGroupDue: 0
        };
    }
};

