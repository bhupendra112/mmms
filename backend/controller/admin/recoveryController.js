import apiResponse from "../../utility/apiResponse.js";
import message from "../../utility/message.js";
import RecoveryMaster from "../../model/RecoveryMaster.js";
import { GroupMaster, FDMaster, MemberRevenueDemand } from "../../model/index.js";
import LoanMaster from "../../model/LoanMaster.js";
import Member from "../../model/Member.js";
import { createBankTransactionRecord } from "../../utility/bankTransactionHelper.js";
import { createCashTransactionRecord } from "../../utility/cashTransactionHelper.js";
import { verifyGroupAccess, verifyGroupAccessByCode, verifyGroupAccessByName } from "../../utility/groupAccessHelper.js";
import { generateRecoveryPDF } from "../../utility/pdfGenerator.js";
import { getDateRange, parseDate } from "../../utility/dateUtils.js";

export const registerRecovery = async (req, res) => {
    try {
        const payload = req.body || {};

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Verify group exists and belongs to admin's place
        let groupDoc = null;
        if (payload.groupId) {
            const accessCheck = await verifyGroupAccess(payload.groupId, adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
            }
            groupDoc = accessCheck.group;
        } else if (payload.groupCode) {
            const accessCheck = await verifyGroupAccessByCode(payload.groupCode, adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
            }
            groupDoc = accessCheck.group;
        } else if (payload.groupName) {
            const accessCheck = await verifyGroupAccessByName(payload.groupName, adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
            }
            groupDoc = accessCheck.group;
        }

        if (!groupDoc) {
            return apiResponse.error(res, "Valid groupId/groupCode/groupName is required", 400);
        }

        // Parse date using utility function
        const parsedDate = parseDate(payload.date);

        // Validate parsed date
        if (!(parsedDate instanceof Date) || isNaN(parsedDate.getTime())) {
            return apiResponse.error(res, "Invalid date format. Expected DD/MM/YYYY or ISO date string", 400);
        }

        // Get date range for checking existing recoveries
        const { start: dateStart, end: dateEnd } = getDateRange(parsedDate);

        // Check if any member in the recoveries array already has a recovery for this date
        if (payload.recoveries && Array.isArray(payload.recoveries) && payload.recoveries.length > 0) {
            const memberIds = payload.recoveries
                .map(r => r.memberId)
                .filter(id => id); // Filter out undefined/null

            if (memberIds.length > 0) {
                const existingRecoverySession = await RecoveryMaster.findOne({
                    groupId: groupDoc._id,
                    date: { $gte: dateStart, $lte: dateEnd },
                    'recoveries.memberId': { $in: memberIds }
                }).lean();

                if (existingRecoverySession) {
                    // Check which members already have recoveries
                    const existingMemberIds = existingRecoverySession.recoveries
                        ?.filter(r =>
                            (r.attendance === 'present' ||
                                (r.attendance === 'absent' && r.recoveryByOther)) &&
                            memberIds.some(id =>
                                r.memberId === id ||
                                r.memberId?.toString() === id?.toString()
                            )
                        )
                        .map(r => {
                            const memberRecovery = payload.recoveries.find(
                                rec => rec.memberId === r.memberId ||
                                    rec.memberId?.toString() === r.memberId?.toString()
                            );
                            return memberRecovery?.memberName || r.memberName || r.memberCode;
                        }) || [];

                    if (existingMemberIds.length > 0) {
                        return apiResponse.error(
                            res,
                            `Demand already recovered for member(s): ${existingMemberIds.join(', ')} today`,
                            400
                        );
                    }
                }
            }
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

        // Meeting sequence is always 1 (no same-day meetings allowed)
        const meetingSequence = 1;

        // Validate cash denominations if provided
        if (payload.cashDenominations) {
            const { note200 = 0, note500 = 0, note100 = 0, note50 = 0, note20 = 0, note10 = 0, note5 = 0, note2 = 0, note1 = 0 } = payload.cashDenominations;
            const calculatedTotal = (parseFloat(note200) || 0) * 200 +
                (parseFloat(note500) || 0) * 500 +
                (parseFloat(note100) || 0) * 100 +
                (parseFloat(note50) || 0) * 50 +
                (parseFloat(note20) || 0) * 20 +
                (parseFloat(note10) || 0) * 10 +
                (parseFloat(note5) || 0) * 5 +
                (parseFloat(note2) || 0) * 2 +
                (parseFloat(note1) || 0) * 1;

            // Calculate totalCash from recoveries if not provided
            let totalCash = payload.totals?.totalCash || 0;
            if (!totalCash && payload.recoveries && Array.isArray(payload.recoveries)) {
                totalCash = payload.recoveries.reduce((sum, rec) => {
                    if (rec.paymentMode?.cash && rec.total) {
                        return sum + (parseFloat(rec.total) || 0);
                    }
                    return sum;
                }, 0);
            }

            // Round totalCash: if decimal >= 0.5, round up; otherwise round down
            const roundedTotalCash = totalCash >= 0 ? Math.floor(totalCash) + (totalCash % 1 >= 0.5 ? 1 : 0) : Math.ceil(totalCash) - (Math.abs(totalCash) % 1 >= 0.5 ? 1 : 0);
            const roundedCalculatedTotal = Math.round(calculatedTotal);

            // Validate that denominations sum equals rounded totalCash (allow 1 rupee difference for rounding)
            if (totalCash > 0 && Math.abs(roundedCalculatedTotal - roundedTotalCash) > 1) {
                return apiResponse.error(
                    res,
                    `Cash denominations sum (₹${roundedCalculatedTotal}) does not match total cash (₹${roundedTotalCash}). Please verify the note counts.`,
                    400
                );
            }
        }

        // Create recovery session
        const recovery = await RecoveryMaster.create({
            ...payload,
            date: parsedDate,
            meetingSequence: meetingSequence,
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

                // Mark yogdan as collected when yogdan is paid
                // Yogdan is now managed only in LoanMaster, not in MemberRevenueDemand or member model
                if (memberRecovery.amounts?.yogdan > 0 && memberRecovery.memberId) {
                    let remainingYogdan = memberRecovery.amounts.yogdan;

                    // Handle yogdan for loans - only use LoanMaster
                    if (remainingYogdan > 0) {
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

                        for (const loan of memberLoans) {
                            if (remainingYogdan <= 0) break;

                            const loanAmount = loan.amount || 0;
                            const yogdanAmount = loan.yogdanAmount || (loanAmount * 0.01);

                            if (remainingYogdan >= yogdanAmount) {
                                // Mark this loan's yogdan as collected in LoanMaster only
                                await LoanMaster.findByIdAndUpdate(loan._id, {
                                    yogdanCollected: true,
                                    yogdanCollectedDate: parsedDate
                                });

                                remainingYogdan -= yogdanAmount;
                            }
                        }
                    }
                }

                // Handle loan payment - update member's loanPaid field for backward compatibility
                // Note: For new registrations (after this fix), loan payments are tracked in RecoveryMaster
                // This update is kept for backward compatibility with members registered before this fix
                // member.loanDetails.loanPaid should only represent pre-registration payments for existing members
                // Post-registration payments are tracked via RecoveryMaster records
                if (memberRecovery.amounts?.loan > 0 && memberRecovery.memberId) {
                    const member = await Member.findById(memberRecovery.memberId);
                    if (member && member.loanDetails) {
                        // Only update loanPaid if member was registered before this fix (no LoanMaster entries exist)
                        // For new registrations with LoanMaster entries, we don't update member.loanPaid
                        // to avoid double-counting (payments are tracked via RecoveryMaster)
                        const hasLoanMasterEntries = await LoanMaster.findOne({
                            groupId: groupDoc._id,
                            memberId: memberRecovery.memberId.toString(),
                            transactionType: "Loan",
                            status: "approved"
                        }).lean();

                        // Only update if no LoanMaster entries exist (backward compatibility)
                        // This means the member was registered before this fix and loan payments need to be tracked in member.loanDetails.loanPaid
                        if (!hasLoanMasterEntries) {
                            // Get current loan paid amount
                            const currentLoanPaid = member.loanDetails.loanPaid || 0;
                            const newLoanPaid = currentLoanPaid + memberRecovery.amounts.loan;

                            // Update loanPaid field (for backward compatibility only)
                            if (!member.loanDetails.loanPaid) {
                                member.loanDetails.loanPaid = 0;
                            }
                            member.loanDetails.loanPaid = newLoanPaid;
                            await member.save();
                        }
                        // If LoanMaster entries exist, payments are tracked in RecoveryMaster only (via getCumulativePayments)
                    }
                }

                // Handle membership fees SHG payment
                if (memberRecovery.amounts?.memFeesSHG > 0 && memberRecovery.memberId) {
                    const member = await Member.findById(memberRecovery.memberId);
                    if (member) {
                        member.lastMembershipPaidDate = parsedDate;
                        await member.save();
                    }

                    // Find ALL unpaid demands for membership fees SHG (not filtered by year)
                    // Priority: registration demand first, then annual demand (oldest first)
                    const unpaidMemFeesDemands = await MemberRevenueDemand.find({
                        memberId: memberRecovery.memberId,
                        groupId: groupDoc._id,
                        revenueType: "membership_fees_shg",
                        isPaid: false,
                    }).sort({ isAnnualDemand: 1, demandDate: 1 }); // Registration demand first, then oldest first

                    let remainingPayment = parseFloat(memberRecovery.amounts.memFeesSHG) || 0;

                    // Distribute payment across unpaid demands
                    for (const demand of unpaidMemFeesDemands) {
                        if (remainingPayment <= 0) break;

                        const demandAmount = parseFloat(demand.amount) || 0;
                        const currentPaidAmount = parseFloat(demand.paidAmount) || 0;
                        const remainingDemand = Math.max(0, demandAmount - currentPaidAmount);

                        // Pay as much as possible for this demand
                        const paymentForThisDemand = Math.min(remainingPayment, remainingDemand);
                        const newPaidAmount = currentPaidAmount + paymentForThisDemand;

                        // Update paid amount
                        demand.paidAmount = newPaidAmount;
                        demand.paidDate = parsedDate;
                        demand.recoveryId = recovery._id;

                        // Mark as paid if fully paid
                        if (newPaidAmount >= demandAmount) {
                            demand.isPaid = true;
                        }

                        await demand.save();
                        remainingPayment -= paymentForThisDemand;
                    }
                }

                // Handle membership fees Group payment
                if (memberRecovery.amounts?.memFeesGroup > 0 && memberRecovery.memberId) {
                    const member = await Member.findById(memberRecovery.memberId);
                    if (member) {
                        member.lastMembershipGroupPaidDate = parsedDate;
                        await member.save();
                    }

                    // Find ALL unpaid demands for membership fees Group (not filtered by year)
                    // Priority: registration demand first, then annual demand (oldest first)
                    const unpaidMemGroupDemands = await MemberRevenueDemand.find({
                        memberId: memberRecovery.memberId,
                        groupId: groupDoc._id,
                        revenueType: "membership_fees_group",
                        isPaid: false,
                    }).sort({ isAnnualDemand: 1, demandDate: 1 }); // Registration demand first, then oldest first

                    let remainingPayment = parseFloat(memberRecovery.amounts.memFeesGroup) || 0;

                    // Distribute payment across unpaid demands
                    for (const demand of unpaidMemGroupDemands) {
                        if (remainingPayment <= 0) break;

                        const demandAmount = parseFloat(demand.amount) || 0;
                        const currentPaidAmount = parseFloat(demand.paidAmount) || 0;
                        const remainingDemand = Math.max(0, demandAmount - currentPaidAmount);

                        // Pay as much as possible for this demand
                        const paymentForThisDemand = Math.min(remainingPayment, remainingDemand);
                        const newPaidAmount = currentPaidAmount + paymentForThisDemand;

                        // Update paid amount
                        demand.paidAmount = newPaidAmount;
                        demand.paidDate = parsedDate;
                        demand.recoveryId = recovery._id;

                        // Mark as paid if fully paid
                        if (newPaidAmount >= demandAmount) {
                            demand.isPaid = true;
                        }

                        await demand.save();
                        remainingPayment -= paymentForThisDemand;
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
        } else if (groupCode) {
            // Verify group access by code
            const accessCheck = await verifyGroupAccessByCode(groupCode, adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
            }
            filter.groupId = accessCheck.group._id;
        } else {
            // If no group specified, filter by all groups in admin's place
            const groups = await GroupMaster.find({ place: adminPlace }).select("_id").lean();
            const groupIds = groups.map(g => g._id);
            filter.groupId = { $in: groupIds };
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

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Verify recovery's group belongs to admin's place
        if (recovery.groupId) {
            const groupId = recovery.groupId._id || recovery.groupId;
            const accessCheck = await verifyGroupAccess(groupId, adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(res, accessCheck.error || "You don't have access to this recovery's group", 403);
            }
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

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Verify group exists and belongs to admin's place
        const accessCheck = await verifyGroupAccess(groupId, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
        }
        const groupDoc = accessCheck.group;

        // Parse date using utility function
        const parsedDate = parseDate(date);
        const { start: dateStart, end: dateEnd } = getDateRange(parsedDate);

        // Check if member already has a recovery for this date
        const existingRecoverySession = await RecoveryMaster.findOne({
            groupId: groupDoc._id,
            date: { $gte: dateStart, $lte: dateEnd },
            'recoveries.memberId': memberRecovery.memberId
        }).lean();

        if (existingRecoverySession) {
            // Check if this member already has a recovery in this session
            const existingMemberRecovery = existingRecoverySession.recoveries?.find(
                r => r.memberId === memberRecovery.memberId ||
                    r.memberId?.toString() === memberRecovery.memberId?.toString()
            );

            if (existingMemberRecovery &&
                (existingMemberRecovery.attendance === 'present' ||
                    (existingMemberRecovery.attendance === 'absent' && existingMemberRecovery.recoveryByOther))) {
                // Member already has a recovery for today
                return apiResponse.error(
                    res,
                    "Demand already recovered for this member today",
                    400
                );
            }
        }

        // Find existing recovery session for this date and group
        let recoverySession = await RecoveryMaster.findOne({
            groupId: groupDoc._id,
            date: { $gte: dateStart, $lte: dateEnd }
        })
            .sort({ meetingSequence: -1 }); // Get the latest sequence if multiple exist

        // Meeting sequence is always 1 (no same-day meetings allowed)
        const meetingSequence = 1;

        if (recoverySession) {
            // Calculate demand details for this member
            // Exclude current recovery session from cumulative calculations
            const demandDetails = await calculateDemandDetails(
                groupDoc._id,
                memberRecovery.memberId,
                memberRecovery,
                parsedDate,
                groupDoc,
                recoverySession.meetingSequence || meetingSequence,
                recoverySession._id
            );

            // Update existing session - find and update member recovery
            const memberIndex = recoverySession.recoveries.findIndex(
                r => r.memberId === memberRecovery.memberId ||
                    r.memberId?.toString() === memberRecovery.memberId?.toString()
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

            // Validate and update cash denominations if provided
            if (req.body.cashDenominations) {
                const { note200 = 0, note500 = 0, note100 = 0, note50 = 0, note20 = 0, note10 = 0, note5 = 0, note2 = 0, note1 = 0 } = req.body.cashDenominations;
                const calculatedTotal = (parseFloat(note200) || 0) * 200 +
                    (parseFloat(note500) || 0) * 500 +
                    (parseFloat(note100) || 0) * 100 +
                    (parseFloat(note50) || 0) * 50 +
                    (parseFloat(note20) || 0) * 20 +
                    (parseFloat(note10) || 0) * 10 +
                    (parseFloat(note5) || 0) * 5 +
                    (parseFloat(note2) || 0) * 2 +
                    (parseFloat(note1) || 0) * 1;

                // Round totalCash: if decimal >= 0.5, round up; otherwise round down
                const roundedTotalCash = totalCash >= 0 ? Math.floor(totalCash) + (totalCash % 1 >= 0.5 ? 1 : 0) : Math.ceil(totalCash) - (Math.abs(totalCash) % 1 >= 0.5 ? 1 : 0);
                const roundedCalculatedTotal = Math.round(calculatedTotal);

                // Validate that denominations sum equals rounded totalCash (allow 1 rupee difference for rounding)
                if (totalCash > 0 && Math.abs(roundedCalculatedTotal - roundedTotalCash) > 1) {
                    return apiResponse.error(
                        res,
                        `Cash denominations sum (₹${roundedCalculatedTotal}) does not match total cash (₹${roundedTotalCash}). Please verify the note counts.`,
                        400
                    );
                }

                // Update cash denominations
                recoverySession.cashDenominations = {
                    note200: parseFloat(note200) || 0,
                    note500: parseFloat(note500) || 0,
                    note100: parseFloat(note100) || 0,
                    note50: parseFloat(note50) || 0,
                    note20: parseFloat(note20) || 0,
                    note10: parseFloat(note10) || 0,
                    note5: parseFloat(note5) || 0,
                    note2: parseFloat(note2) || 0,
                    note1: parseFloat(note1) || 0,
                };
            }

            // Handle membership fees SHG payment - update MemberRevenueDemand
            if (memberRecovery.amounts?.memFeesSHG > 0 && memberRecovery.memberId) {
                const member = await Member.findById(memberRecovery.memberId);
                if (member) {
                    member.lastMembershipPaidDate = parsedDate;
                    await member.save();
                }

                // Find ALL unpaid demands for membership fees SHG (not filtered by year)
                // Priority: registration demand first, then annual demand (oldest first)
                const unpaidMemFeesDemands = await MemberRevenueDemand.find({
                    memberId: memberRecovery.memberId,
                    groupId: groupDoc._id,
                    revenueType: "membership_fees_shg",
                    isPaid: false,
                }).sort({ isAnnualDemand: 1, demandDate: 1 }); // Registration demand first, then oldest first

                let remainingPayment = parseFloat(memberRecovery.amounts.memFeesSHG) || 0;

                // Distribute payment across unpaid demands
                for (const demand of unpaidMemFeesDemands) {
                    if (remainingPayment <= 0) break;

                    const demandAmount = parseFloat(demand.amount) || 0;
                    const currentPaidAmount = parseFloat(demand.paidAmount) || 0;
                    const remainingDemand = Math.max(0, demandAmount - currentPaidAmount);

                    // Pay as much as possible for this demand
                    const paymentForThisDemand = Math.min(remainingPayment, remainingDemand);
                    const newPaidAmount = currentPaidAmount + paymentForThisDemand;

                    // Update paid amount
                    demand.paidAmount = newPaidAmount;
                    demand.paidDate = parsedDate;
                    demand.recoveryId = recoverySession._id;

                    // Mark as paid if fully paid
                    if (newPaidAmount >= demandAmount) {
                        demand.isPaid = true;
                    }

                    await demand.save();
                    remainingPayment -= paymentForThisDemand;
                }
            }

            // Handle membership fees Group payment - update MemberRevenueDemand
            if (memberRecovery.amounts?.memFeesGroup > 0 && memberRecovery.memberId) {
                const member = await Member.findById(memberRecovery.memberId);
                if (member) {
                    member.lastMembershipGroupPaidDate = parsedDate;
                    await member.save();
                }

                // Find ALL unpaid demands for membership fees Group (not filtered by year)
                // Priority: registration demand first, then annual demand (oldest first)
                const unpaidMemGroupDemands = await MemberRevenueDemand.find({
                    memberId: memberRecovery.memberId,
                    groupId: groupDoc._id,
                    revenueType: "membership_fees_group",
                    isPaid: false,
                }).sort({ isAnnualDemand: 1, demandDate: 1 }); // Registration demand first, then oldest first

                let remainingPayment = parseFloat(memberRecovery.amounts.memFeesGroup) || 0;

                // Distribute payment across unpaid demands
                for (const demand of unpaidMemGroupDemands) {
                    if (remainingPayment <= 0) break;

                    const demandAmount = parseFloat(demand.amount) || 0;
                    const currentPaidAmount = parseFloat(demand.paidAmount) || 0;
                    const remainingDemand = Math.max(0, demandAmount - currentPaidAmount);

                    // Pay as much as possible for this demand
                    const paymentForThisDemand = Math.min(remainingPayment, remainingDemand);
                    const newPaidAmount = currentPaidAmount + paymentForThisDemand;

                    // Update paid amount
                    demand.paidAmount = newPaidAmount;
                    demand.paidDate = parsedDate;
                    demand.recoveryId = recoverySession._id;

                    // Mark as paid if fully paid
                    if (newPaidAmount >= demandAmount) {
                        demand.isPaid = true;
                    }

                    await demand.save();
                    remainingPayment -= paymentForThisDemand;
                }
            }

            // Mark yogdan as collected when yogdan is paid
            // Yogdan is now managed only in LoanMaster, not in MemberRevenueDemand or member model
            if (memberRecovery.amounts?.yogdan > 0 && memberRecovery.memberId) {
                let remainingYogdan = memberRecovery.amounts.yogdan;

                // Handle yogdan for loans - only use LoanMaster
                if (remainingYogdan > 0) {
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

                    for (const loan of memberLoans) {
                        if (remainingYogdan <= 0) break;

                        const loanAmount = loan.amount || 0;
                        const yogdanAmount = Math.round((loanAmount * 0.01) * 100) / 100; // 1% of loan amount

                        if (remainingYogdan >= yogdanAmount) {
                            // Mark loan yogdan as collected in LoanMaster only
                            await LoanMaster.findByIdAndUpdate(loan._id, {
                                yogdanCollected: true,
                                yogdanCollectedDate: parsedDate
                            });
                            remainingYogdan -= yogdanAmount;
                        }
                    }
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
                groupDoc,
                meetingSequence
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

            // Validate cash denominations if provided
            if (req.body.cashDenominations && memberTotal > 0) {
                const { note200 = 0, note500 = 0, note100 = 0, note50 = 0, note20 = 0, note10 = 0, note5 = 0, note2 = 0, note1 = 0 } = req.body.cashDenominations;
                const calculatedTotal = (parseFloat(note200) || 0) * 200 +
                    (parseFloat(note500) || 0) * 500 +
                    (parseFloat(note100) || 0) * 100 +
                    (parseFloat(note50) || 0) * 50 +
                    (parseFloat(note20) || 0) * 20 +
                    (parseFloat(note10) || 0) * 10 +
                    (parseFloat(note5) || 0) * 5 +
                    (parseFloat(note2) || 0) * 2 +
                    (parseFloat(note1) || 0) * 1;

                // Round memberTotal: if decimal >= 0.5, round up; otherwise round down
                const roundedMemberTotal = memberTotal >= 0 ? Math.floor(memberTotal) + (memberTotal % 1 >= 0.5 ? 1 : 0) : Math.ceil(memberTotal) - (Math.abs(memberTotal) % 1 >= 0.5 ? 1 : 0);
                const roundedCalculatedTotal = Math.round(calculatedTotal);

                // Validate that denominations sum equals rounded memberTotal (allow 1 rupee difference for rounding)
                if (Math.abs(roundedCalculatedTotal - roundedMemberTotal) > 1) {
                    return apiResponse.error(
                        res,
                        `Cash denominations sum (₹${roundedCalculatedTotal}) does not match total cash (₹${roundedMemberTotal}). Please verify the note counts.`,
                        400
                    );
                }
            }

            const newRecovery = await RecoveryMaster.create({
                groupId: groupDoc._id,
                groupName: groupDoc.group_name,
                groupCode: groupDoc.group_code,
                date: parsedDate,
                meetingSequence: meetingSequence,
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
                cashDenominations: req.body.cashDenominations ? {
                    note200: parseFloat(req.body.cashDenominations.note200) || 0,
                    note500: parseFloat(req.body.cashDenominations.note500) || 0,
                    note100: parseFloat(req.body.cashDenominations.note100) || 0,
                    note50: parseFloat(req.body.cashDenominations.note50) || 0,
                    note20: parseFloat(req.body.cashDenominations.note20) || 0,
                    note10: parseFloat(req.body.cashDenominations.note10) || 0,
                    note5: parseFloat(req.body.cashDenominations.note5) || 0,
                    note2: parseFloat(req.body.cashDenominations.note2) || 0,
                    note1: parseFloat(req.body.cashDenominations.note1) || 0,
                } : undefined,
                status: "approved",
                createdBy: req.user?.id || "admin",
            });

            // Handle membership fees SHG payment - update MemberRevenueDemand (for new recovery session)
            if (memberRecovery.amounts?.memFeesSHG > 0 && memberRecovery.memberId) {
                const member = await Member.findById(memberRecovery.memberId);
                if (member) {
                    member.lastMembershipPaidDate = parsedDate;
                    await member.save();
                }

                // Find ALL unpaid demands for membership fees SHG (not filtered by year)
                // Priority: registration demand first, then annual demand (oldest first)
                const unpaidMemFeesDemands = await MemberRevenueDemand.find({
                    memberId: memberRecovery.memberId,
                    groupId: groupDoc._id,
                    revenueType: "membership_fees_shg",
                    isPaid: false,
                }).sort({ isAnnualDemand: 1, demandDate: 1 }); // Registration demand first, then oldest first

                let remainingPayment = parseFloat(memberRecovery.amounts.memFeesSHG) || 0;

                // Distribute payment across unpaid demands
                for (const demand of unpaidMemFeesDemands) {
                    if (remainingPayment <= 0) break;

                    const demandAmount = parseFloat(demand.amount) || 0;
                    const currentPaidAmount = parseFloat(demand.paidAmount) || 0;
                    const remainingDemand = Math.max(0, demandAmount - currentPaidAmount);

                    // Pay as much as possible for this demand
                    const paymentForThisDemand = Math.min(remainingPayment, remainingDemand);
                    const newPaidAmount = currentPaidAmount + paymentForThisDemand;

                    // Update paid amount
                    demand.paidAmount = newPaidAmount;
                    demand.paidDate = parsedDate;
                    demand.recoveryId = newRecovery._id;

                    // Mark as paid if fully paid
                    if (newPaidAmount >= demandAmount) {
                        demand.isPaid = true;
                    }

                    await demand.save();
                    remainingPayment -= paymentForThisDemand;
                }
            }

            // Handle membership fees Group payment - update MemberRevenueDemand (for new recovery session)
            if (memberRecovery.amounts?.memFeesGroup > 0 && memberRecovery.memberId) {
                const member = await Member.findById(memberRecovery.memberId);
                if (member) {
                    member.lastMembershipGroupPaidDate = parsedDate;
                    await member.save();
                }

                // Find ALL unpaid demands for membership fees Group (not filtered by year)
                // Priority: registration demand first, then annual demand (oldest first)
                const unpaidMemGroupDemands = await MemberRevenueDemand.find({
                    memberId: memberRecovery.memberId,
                    groupId: groupDoc._id,
                    revenueType: "membership_fees_group",
                    isPaid: false,
                }).sort({ isAnnualDemand: 1, demandDate: 1 }); // Registration demand first, then oldest first

                let remainingPayment = parseFloat(memberRecovery.amounts.memFeesGroup) || 0;

                // Distribute payment across unpaid demands
                for (const demand of unpaidMemGroupDemands) {
                    if (remainingPayment <= 0) break;

                    const demandAmount = parseFloat(demand.amount) || 0;
                    const currentPaidAmount = parseFloat(demand.paidAmount) || 0;
                    const remainingDemand = Math.max(0, demandAmount - currentPaidAmount);

                    // Pay as much as possible for this demand
                    const paymentForThisDemand = Math.min(remainingPayment, remainingDemand);
                    const newPaidAmount = currentPaidAmount + paymentForThisDemand;

                    // Update paid amount
                    demand.paidAmount = newPaidAmount;
                    demand.paidDate = parsedDate;
                    demand.recoveryId = newRecovery._id;

                    // Mark as paid if fully paid
                    if (newPaidAmount >= demandAmount) {
                        demand.isPaid = true;
                    }

                    await demand.save();
                    remainingPayment -= paymentForThisDemand;
                }
            }

            // Mark yogdan as collected when yogdan is paid (for new recovery session)
            // Yogdan is now managed only in LoanMaster, not in MemberRevenueDemand or member model
            if (memberRecovery.amounts?.yogdan > 0 && memberRecovery.memberId) {
                let remainingYogdan = memberRecovery.amounts.yogdan;

                // Handle yogdan for loans - only use LoanMaster
                if (remainingYogdan > 0) {
                    const memberLoans = await LoanMaster.find({
                        groupId: groupDoc._id,
                        memberId: memberRecovery.memberId.toString(),
                        transactionType: "Loan",
                        status: "approved",
                        yogdanCollected: false,
                        date: { $lte: parsedDate }
                    })
                        .sort({ date: 1 })
                        .lean();

                    for (const loan of memberLoans) {
                        if (remainingYogdan <= 0) break;

                        const loanAmount = loan.amount || 0;
                        const yogdanAmount = Math.round((loanAmount * 0.01) * 100) / 100;

                        if (remainingYogdan >= yogdanAmount) {
                            // Mark loan yogdan as collected in LoanMaster only
                            await LoanMaster.findByIdAndUpdate(loan._id, {
                                yogdanCollected: true,
                                yogdanCollectedDate: parsedDate
                            });
                            remainingYogdan -= yogdanAmount;
                        }
                    }
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

// Helper function to normalize date for calculations and anchor to scheduled meeting days
const getAdjustedDateForCalculation = (
    recoveryDate,
    groupDoc = null,
    meetingSequence = 1
) => {
    try {
        console.log("-------------------------------------------------");
        console.log("[ADJUST_DATE_START]");
        console.log("Input recoveryDate:", recoveryDate);
        console.log("Meeting Sequence:", meetingSequence);

        if (!recoveryDate) {
            console.log("[ADJUST_DATE_EXIT] No recoveryDate provided");
            return recoveryDate;
        }

        const d = new Date(recoveryDate);
        d.setHours(0, 0, 0, 0);

        console.log("[NORMALIZED_INPUT_DATE]", d);

        if (!groupDoc) {
            console.log("[NO_GROUP_DOC] Returning normalized date");
            return d;
        }

        const day = d.getDate();
        const day1 = groupDoc.meeting_date_1_day;
        const day2 = groupDoc.meeting_date_2_day;

        console.log("[MEETING_DAYS]", {
            actualDay: day,
            meetingDay1: day1,
            meetingDay2: day2,
        });

        if (!day1 && !day2) {
            console.log("[NO_MEETING_DAYS_DEFINED] Returning original date");
            return d;
        }

        let targetDay = day1;

        if (day1 && day2) {
            // If meetingSequence is provided, use it to determine which meeting day
            if (meetingSequence === 1) {
                targetDay = day1;
                console.log("[BOTH_MEETINGS_PRESENT_SEQ_1]", {
                    meetingSequence,
                    chosenTargetDay: targetDay,
                });
            } else if (meetingSequence === 2) {
                targetDay = day2;
                console.log("[BOTH_MEETINGS_PRESENT_SEQ_2]", {
                    meetingSequence,
                    chosenTargetDay: targetDay,
                });
            } else {
                // Fallback to closest day logic if sequence is not 1 or 2
                const diff1 = Math.abs(day - day1);
                const diff2 = Math.abs(day - day2);
                targetDay = diff1 <= diff2 ? day1 : day2;
                console.log("[BOTH_MEETINGS_PRESENT_FALLBACK]", {
                    diffToDay1: diff1,
                    diffToDay2: diff2,
                    chosenTargetDay: targetDay,
                    meetingSequence,
                });
            }
        } else if (day2) {
            targetDay = day2;
            console.log("[ONLY_MEETING_DAY_2_PRESENT]", targetDay);
        } else {
            console.log("[ONLY_MEETING_DAY_1_PRESENT]", targetDay);
        }

        const adjustedDate = new Date(d);
        adjustedDate.setDate(targetDay);
        adjustedDate.setHours(0, 0, 0, 0);

        console.log("[ADJUSTED_DATE_RESULT]", adjustedDate);
        console.log("[ADJUST_DATE_END]");
        console.log("-------------------------------------------------");

        return adjustedDate;
    } catch (error) {
        console.error("[ADJUST_DATE_ERROR]", error);
        return recoveryDate;
    }
};


const getPreviousRecoveryForMember = async (
    groupId,
    memberId,
    currentDate,
    currentMeetingSequence = 1
) => {
    try {
        console.log("=================================================");
        console.log("[PREVIOUS_RECOVERY_START]");
        console.log({ groupId, memberId, currentDate, currentMeetingSequence });

        // ------------------ PARSE CURRENT DATE ------------------
        let parsedDate =
            currentDate instanceof Date ? currentDate : new Date(currentDate);

        if (typeof currentDate === "string" && currentDate.includes("/")) {
            const parts = currentDate.split("/");
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const year = parseInt(parts[2], 10);
                parsedDate = new Date(year, month, day);
            }
        }

        parsedDate.setHours(0, 0, 0, 0);
        console.log("[PARSED_CURRENT_DATE]", parsedDate);

        // ------------------ GROUP ------------------
        const groupDoc = await GroupMaster.findById(groupId).lean();
        console.log("[GROUP_DOC_MEETING_DAYS]", {
            meeting_date_1_day: groupDoc?.meeting_date_1_day,
            meeting_date_2_day: groupDoc?.meeting_date_2_day,
        });

        // ------------------ ADJUST CURRENT DATE ------------------
        const adjustedCurrentDate = getAdjustedDateForCalculation(
            parsedDate,
            groupDoc,
            currentMeetingSequence
        );

        console.log("[ADJUSTED_CURRENT_DATE]", adjustedCurrentDate);

        // ------------------ FETCH ALL RECOVERIES ------------------
        const allRecoveries = await RecoveryMaster.find({ groupId })
            .sort({ date: 1, meetingSequence: 1 })
            .lean();

        console.log("[TOTAL_RECOVERIES_FOUND]", allRecoveries.length);

        // ------------------ FIND MOST RECENT RECOVERY ------------------
        // Normalize memberId to string for comparison
        const memberIdStr = memberId?.toString() || String(memberId);
        let mostRecentRecovery = null;
        let mostRecentDate = null;

        console.log("[SEARCHING_PREVIOUS_RECOVERY]", {
            memberId: memberIdStr,
            adjustedCurrentDate,
            currentMeetingSequence
        });

        for (const recovery of allRecoveries) {
            const recoveryAdjustedDate = getAdjustedDateForCalculation(
                recovery.date,
                groupDoc,
                recovery.meetingSequence || 1
            );

            // Compare both date and meetingSequence (same logic as getCumulativePayments)
            // First compare original dates, then adjusted dates, then sequences
            const recoveryOriginalDate = new Date(recovery.date);
            recoveryOriginalDate.setHours(0, 0, 0, 0);
            const currentOriginalDate = new Date(parsedDate);
            currentOriginalDate.setHours(0, 0, 0, 0);

            const recoveryDateMs = recoveryAdjustedDate.getTime();
            const currentDateMs = adjustedCurrentDate.getTime();
            const recoverySeq = recovery.meetingSequence || 1;
            const recoveryOriginalMs = recoveryOriginalDate.getTime();
            const currentOriginalMs = currentOriginalDate.getTime();

            // Compare: original date first, then adjusted date, then sequence
            const isBeforeCurrent = recoveryOriginalMs < currentOriginalMs ||
                (recoveryOriginalMs === currentOriginalMs && recoveryDateMs < currentDateMs) ||
                (recoveryOriginalMs === currentOriginalMs && recoveryDateMs === currentDateMs && recoverySeq < currentMeetingSequence);

            console.log("[CHECKING_RECOVERY_FOR_PREVIOUS]", {
                recoveryId: recovery._id,
                recoveryDate: recovery.date,
                meetingSequence: recovery.meetingSequence,
                recoverySeq,
                currentMeetingSequence,
                adjustedRecoveryDate: recoveryAdjustedDate,
                adjustedCurrentDate,
                recoveryDateMs,
                currentDateMs,
                isBeforeCurrent,
                memberCount: recovery.recoveries?.length || 0
            });

            // Only check recoveries before current date/sequence
            if (!isBeforeCurrent) {
                console.log("[SKIP_RECOVERY_NOT_BEFORE_CURRENT]", {
                    recoveryId: recovery._id,
                    recoveryDate: recovery.date,
                    recoveryAdjustedDate,
                    adjustedCurrentDate,
                    recoverySeq,
                    currentMeetingSequence
                });
                continue;
            }

            const memberRecovery = recovery.recoveries?.find(r => {
                const rMemberIdStr = String(r.memberId || '');
                const matches = rMemberIdStr === memberIdStr;
                if (matches) {
                    console.log("[MEMBER_FOUND_IN_RECOVERY]", {
                        recoveryId: recovery._id,
                        searchedMemberId: memberIdStr,
                        foundMemberId: rMemberIdStr,
                        memberCode: r.memberCode,
                        amounts: r.amounts
                    });
                }
                return matches;
            });

            if (!memberRecovery) {
                console.log("[MEMBER_NOT_IN_RECOVERY]", {
                    recoveryId: recovery._id,
                    recoveryDate: recovery.date,
                    searchedMemberId: memberIdStr,
                    availableMembers: recovery.recoveries?.map(r => ({
                        memberId: String(r.memberId),
                        memberCode: r.memberCode
                    })) || []
                });
                continue;
            }

            // Only consider valid recoveries (present or absent with recoveryByOther)
            const isValidRecovery = memberRecovery.attendance === 'present' ||
                (memberRecovery.attendance === 'absent' && memberRecovery.recoveryByOther === true);

            if (!isValidRecovery) {
                console.log("[PREVIOUS_RECOVERY_SKIPPED_INVALID_ATTENDANCE]", {
                    recoveryId: recovery._id,
                    recoveryDate: recovery.date,
                    memberId: memberIdStr,
                    attendance: memberRecovery.attendance,
                    recoveryByOther: memberRecovery.recoveryByOther
                });
                continue;
            }

            // Keep track of the most recent valid recovery
            // Compare by date first, then by meetingSequence if dates are equal
            const recoverySeqForCompare = recovery.meetingSequence || 1;
            const isMoreRecent = !mostRecentDate ||
                recoveryAdjustedDate > mostRecentDate ||
                (recoveryAdjustedDate.getTime() === mostRecentDate.getTime() &&
                    recoverySeqForCompare > (mostRecentRecovery?.recovery?.meetingSequence || 1));

            if (isMoreRecent) {
                mostRecentRecovery = { recovery, memberRecovery };
                mostRecentDate = recoveryAdjustedDate;

                console.log("[PREVIOUS_RECOVERY_MATCH_FOUND]", {
                    recoveryId: recovery._id,
                    recoveryDate: recovery.date,
                    recoveryAdjustedDate,
                    recoverySeq: recoverySeqForCompare,
                    currentMeetingSequence,
                    memberId: memberIdStr,
                    memberCode: memberRecovery.memberCode,
                    attendance: memberRecovery.attendance,
                    recoveryByOther: memberRecovery.recoveryByOther,
                    amounts: memberRecovery.amounts,
                    demandDetails: memberRecovery.demandDetails
                });
            }
        }

        // ------------------ PREVIOUS RECOVERY FOUND ------------------
        if (mostRecentRecovery) {
            const { memberRecovery } = mostRecentRecovery;
            const demandDetails = memberRecovery.demandDetails || {};

            console.log("[PREVIOUS_MEMBER_RECOVERY]", {
                amounts: memberRecovery.amounts,
                demandDetails,
            });

            const result = {
                loan: {
                    unpaidDemand: demandDetails.loan?.unpaidDemand || 0,
                    actualPaid:
                        demandDetails.loan?.actualPaid ||
                        memberRecovery.amounts?.loan ||
                        0,
                },
                interest: {
                    unpaidDemand: demandDetails.interest?.unpaidDemand || 0,
                    actualPaid:
                        demandDetails.interest?.actualPaid ||
                        memberRecovery.amounts?.interest ||
                        0,
                },
                saving: {
                    unpaidDemand: demandDetails.saving?.unpaidDemand || 0,
                    actualPaid:
                        demandDetails.saving?.actualPaid ||
                        memberRecovery.amounts?.saving ||
                        0,
                    totalDemand: demandDetails.saving?.totalDemand || 0,
                },
            };

            console.log("[PREVIOUS_RECOVERY_RESULT]");
            console.log(JSON.stringify(result, null, 2));
            console.log("[PREVIOUS_RECOVERY_END]");
            console.log("=================================================");

            return result;
        }

        // ------------------ NO PREVIOUS RECOVERY ------------------
        console.log("[NO_PREVIOUS_RECOVERY_FOUND]");

        const emptyResult = {
            loan: { unpaidDemand: 0, actualPaid: 0 },
            interest: { unpaidDemand: 0, actualPaid: 0 },
            saving: { unpaidDemand: 0, actualPaid: 0, totalDemand: 0 },
        };

        console.log(JSON.stringify(emptyResult, null, 2));
        console.log("[PREVIOUS_RECOVERY_END]");
        console.log("=================================================");

        return emptyResult;
    } catch (error) {
        console.error("[PREVIOUS_RECOVERY_ERROR]", error);

        return {
            loan: { unpaidDemand: 0, actualPaid: 0 },
            interest: { unpaidDemand: 0, actualPaid: 0 },
            saving: { unpaidDemand: 0, actualPaid: 0, totalDemand: 0 },
        };
    }
};

// Helper function to calculate cumulative loan/interest payments
const getCumulativePayments = async (groupId, memberId, currentDate, type = 'loan', currentMeetingSequence = 1, excludeRecoveryId = null) => {
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

        parsedDate.setHours(0, 0, 0, 0);

        // Normalize current date for comparison
        const groupDoc = await GroupMaster.findById(groupId).lean();
        const adjustedCurrentDate = getAdjustedDateForCalculation(parsedDate, groupDoc, currentMeetingSequence);

        // Normalize memberId to string for comparison (RecoveryMaster stores memberId as String)
        const memberIdStr = memberId?.toString() || String(memberId);

        // Get all recovery sessions for this group
        const allRecoveries = await RecoveryMaster.find({ groupId })
            .sort({ date: 1, meetingSequence: 1 })
            .lean();

        console.log(`[CUMULATIVE_${type.toUpperCase()}_START]`, {
            groupId,
            memberId: memberIdStr,
            currentDate: adjustedCurrentDate,
            currentMeetingSequence,
            totalRecoveries: allRecoveries.length,
            excludeRecoveryId: excludeRecoveryId?.toString()
        });

        let cumulative = 0;
        let recoveryCount = 0;
        let skippedCount = 0;
        let memberNotFoundCount = 0;

        for (const recovery of allRecoveries) {
            const recoveryAdjustedDate = getAdjustedDateForCalculation(
                recovery.date,
                groupDoc,
                recovery.meetingSequence || 1
            );

            // Exclude the current recovery session if specified
            if (excludeRecoveryId && recovery._id && recovery._id.toString() === excludeRecoveryId.toString()) {
                console.log(`[CUMULATIVE_${type.toUpperCase()}_SKIP_EXCLUDED]`, {
                    recoveryId: recovery._id,
                    date: recovery.date
                });
                skippedCount++;
                continue;
            }

            // Only count recoveries before current adjusted date
            // For same-day recoveries, exclude if meetingSequence is same or higher
            // Compare original dates first, then adjusted dates, then sequences
            const recoveryOriginalDate = new Date(recovery.date);
            recoveryOriginalDate.setHours(0, 0, 0, 0);
            const currentOriginalDate = new Date(parsedDate);
            currentOriginalDate.setHours(0, 0, 0, 0);

            const recoveryDateMs = recoveryAdjustedDate.getTime();
            const currentDateMs = adjustedCurrentDate.getTime();
            const recoverySeq = recovery.meetingSequence || 1;
            const recoveryOriginalMs = recoveryOriginalDate.getTime();
            const currentOriginalMs = currentOriginalDate.getTime();

            // Compare: original date first, then adjusted date, then sequence
            const isBeforeCurrent = recoveryOriginalMs < currentOriginalMs ||
                (recoveryOriginalMs === currentOriginalMs && recoveryDateMs < currentDateMs) ||
                (recoveryOriginalMs === currentOriginalMs && recoveryDateMs === currentDateMs && recoverySeq < currentMeetingSequence);

            if (!isBeforeCurrent) {
                skippedCount++;
                continue;
            }

            // Find member recovery - memberId is stored as String in RecoveryMaster
            const memberRecovery = recovery.recoveries?.find(r => {
                const rMemberIdStr = String(r.memberId || '');
                const matches = rMemberIdStr === memberIdStr;
                if (matches) {
                    console.log(`[CUMULATIVE_${type.toUpperCase()}_MEMBER_FOUND]`, {
                        recoveryId: recovery._id,
                        member: r.memberName,
                        recoveryDate: recovery.date,
                        searchedMemberId: memberIdStr,
                        foundMemberId: rMemberIdStr,
                        memberCode: r.memberCode,
                        amounts: r.amounts
                    });
                }
                return matches;
            });

            if (!memberRecovery) {
                memberNotFoundCount++;
                if (recovery.recoveries && recovery.recoveries.length > 0) {
                    console.log(`[CUMULATIVE_${type.toUpperCase()}_MEMBER_NOT_FOUND]`, {
                        recoveryId: recovery._id,
                        recoveryDate: recovery.date,
                        searchedMemberId: memberIdStr,
                        availableMembers: recovery.recoveries.map(r => ({
                            memberId: String(r.memberId),
                            memberCode: r.memberCode,
                            amounts: r.amounts
                        }))
                    });
                }
                continue;
            }

            // Check attendance - only count present or absent with recoveryByOther
            const isValidRecovery = memberRecovery.attendance === 'present' ||
                (memberRecovery.attendance === 'absent' && memberRecovery.recoveryByOther === true);

            if (!isValidRecovery) {
                console.log(`[CUMULATIVE_${type.toUpperCase()}_SKIP_ATTENDANCE]`, {
                    recoveryDate: recovery.date,
                    memberId: memberRecovery.memberId,
                    attendance: memberRecovery.attendance,
                    recoveryByOther: memberRecovery.recoveryByOther
                });
                skippedCount++;
                continue;
            }

            // Get the amount based on type
            const amount = type === 'loan' ? (memberRecovery.amounts?.loan || 0) :
                type === 'interest' ? (memberRecovery.amounts?.interest || 0) :
                    type === 'saving' ? (memberRecovery.amounts?.saving || 0) :
                        type === 'fd' ? (memberRecovery.amounts?.fd || 0) : 0;

            cumulative += amount;
            recoveryCount++;

            console.log(`[CUMULATIVE_${type.toUpperCase()}_ADD]`, {
                recoveryId: recovery._id,
                recoveryDate: recovery.date,
                meetingSequence: recovery.meetingSequence,
                adjustedDate: recoveryAdjustedDate,
                memberId: memberRecovery.memberId,
                memberCode: memberRecovery.memberCode,
                amount,
                cumulative,
                attendance: memberRecovery.attendance,
                recoveryByOther: memberRecovery.recoveryByOther,
                amounts: memberRecovery.amounts
            });
        }

        console.log(`[CUMULATIVE_${type.toUpperCase()}_RESULT]`, {
            groupId,
            memberId: memberIdStr,
            currentDate: adjustedCurrentDate,
            currentMeetingSequence,
            totalRecoveriesChecked: allRecoveries.length,
            validRecoveriesCount: recoveryCount,
            skippedCount,
            memberNotFoundCount,
            cumulative
        });

        return cumulative;
    } catch (error) {
        console.error("Error calculating cumulative payments:", error);
        return 0;
    }
};

// Helper function to calculate demand details for a member
// Helper function to calculate demand details for a member
const calculateDemandDetails = async (
    groupId,
    memberId,
    memberRecovery,
    currentDate,
    groupDoc,
    meetingSequence = 1,
    excludeRecoveryId = null
) => {
    try {
        console.log("=================================================");
        console.log("[DEMAND_CALCULATION_START]");
        console.log({ groupId, memberId, currentDate, meetingSequence });

        // ------------------ PREVIOUS RECOVERY ------------------
        const previousData = await getPreviousRecoveryForMember(
            groupId,
            memberId,
            currentDate,
            meetingSequence
        );
        console.log("[PREVIOUS_DATA]", previousData);

        // ------------------ MEMBER ------------------
        const member = await Member.findById(memberId);
        if (!member) throw new Error("Member not found");

        console.log("[MEMBER]", {
            id: member._id,
            isExistingMember: member.isExistingMember,
            loanPaidBeforeReg: member?.loanDetails?.loanPaid,
            overdueInterest: member?.loanDetails?.overdueInterest,
        });

        // ------------------ DATE NORMALIZATION ------------------
        let parsedCurrentDate = new Date(currentDate);
        if (typeof currentDate === "string" && currentDate.includes("/")) {
            const [d, m, y] = currentDate.split("/");
            parsedCurrentDate = new Date(+y, +m - 1, +d);
        }
        parsedCurrentDate.setHours(0, 0, 0, 0);

        const adjustedCurrentDate = getAdjustedDateForCalculation(
            parsedCurrentDate,
            groupDoc,
            meetingSequence
        );
        adjustedCurrentDate.setHours(0, 0, 0, 0);

        console.log("[DATE]", {
            parsedCurrentDate,
            adjustedCurrentDate,
        });

        // ------------------ AMOUNTS ------------------
        const amounts = memberRecovery.amounts || {};
        const actualLoan = amounts.loan || 0;
        const actualInterest = amounts.interest || 0;
        const actualSaving = amounts.saving || 0;
        const actualFd = amounts.fd || 0;
        const actualYogdan = amounts.yogdan || 0;

        console.log("[ACTUAL_PAID]", {
            actualLoan,
            actualInterest,
            actualSaving,
            actualFd,
            actualYogdan,
        });

        // ------------------ LOANS ------------------
        const allActiveLoans = await LoanMaster.find({
            groupId,
            memberId: memberId.toString(),
            transactionType: "Loan",
            status: "approved",
        })
            .sort({ date: 1 })
            .lean();

        console.log("[ACTIVE_LOANS]", allActiveLoans);

        const memberLoanPaid = member?.loanDetails?.loanPaid || 0;
        const isExistingMember = member?.isExistingMember || false;

        let totalLoanAmount = 0;
        if (allActiveLoans.length > 0) {
            const principal = allActiveLoans.reduce(
                (s, l) => s + (l.amount || 0),
                0
            );
            totalLoanAmount =
                isExistingMember && memberLoanPaid > 0
                    ? principal + memberLoanPaid
                    : principal;
        } else {
            totalLoanAmount = member?.loanDetails?.amount || 0;
        }

        const loanPaidFromRecoveries = await getCumulativePayments(
            groupId,
            memberId,
            currentDate,
            "loan",
            meetingSequence,
            excludeRecoveryId
        );

        const totalLoanPaid = memberLoanPaid + loanPaidFromRecoveries;
        const remainingLoan = Math.max(0, totalLoanAmount - totalLoanPaid);

        console.log("[LOAN_SUMMARY]", {
            totalLoanAmount,
            memberLoanPaid,
            loanPaidFromRecoveries,
            totalLoanPaid,
            remainingLoan,
        });

        // ------------------ LOAN DEMAND ------------------
        let loanCurrDemand = 0;
        let loanPrevDemand = previousData.loan.unpaidDemand || 0;

        if (remainingLoan > 0) {
            let monthlyInstallment = 0;
            for (const loan of allActiveLoans) {
                if (loan.installment_amount) {
                    monthlyInstallment += loan.installment_amount;
                } else if (loan.time_period) {
                    monthlyInstallment += loan.amount / loan.time_period;
                }
            }

            const hasTwoMeetings =
                groupDoc?.meeting_date_1_day &&
                groupDoc?.meeting_date_2_day;

            loanCurrDemand = hasTwoMeetings
                ? monthlyInstallment / 2
                : monthlyInstallment;
        }

        const loanTotalDemand = loanPrevDemand + loanCurrDemand;
        const loanUnpaidDemand = Math.min(
            remainingLoan,
            Math.max(0, loanTotalDemand - actualLoan)
        );

        console.log("[LOAN_DEMAND]", {
            loanPrevDemand,
            loanCurrDemand,
            loanTotalDemand,
            loanUnpaidDemand,
        });

        // ------------------ INTEREST ------------------
        const loanRate =
            allActiveLoans.at(-1)?.loan_rate_snapshot ||
            groupDoc?.loan_rate ||
            0;

        const overdueInterest = member?.loanDetails?.overdueInterest || 0;

        const interestPaid = await getCumulativePayments(
            groupId,
            memberId,
            currentDate,
            "interest",
            meetingSequence,
            excludeRecoveryId
        );

        const remainingOverdueInterest = Math.max(
            0,
            overdueInterest - interestPaid
        );

        let newInterestDemand = 0;
        if (remainingLoan > 0 && loanRate > 0) {
            const days = Math.max(
                0,
                Math.floor(
                    (adjustedCurrentDate -
                        new Date(allActiveLoans[0]?.date)) /
                    (1000 * 60 * 60 * 24)
                )
            );

            const daysInYear =
                adjustedCurrentDate.getFullYear() % 4 === 0 ? 366 : 365;

            newInterestDemand =
                (remainingLoan * loanRate * days) / (100 * daysInYear);
        }

        const interestCurrDemand =
            remainingOverdueInterest > 0
                ? remainingOverdueInterest
                : newInterestDemand;

        const interestPrevDemand =
            previousData.interest.unpaidDemand || 0;

        const interestTotalDemand =
            interestPrevDemand + interestCurrDemand;

        const interestUnpaidDemand = Math.max(
            0,
            interestTotalDemand - actualInterest
        );

        console.log("[INTEREST]", {
            overdueInterest,
            interestPaid,
            remainingOverdueInterest,
            newInterestDemand,
            interestCurrDemand,
            interestUnpaidDemand,
        });

        // ------------------ SAVING ------------------
        const savingPerMember =
            member.isExistingMember && member.saving_per_member_snapshot
                ? member.saving_per_member_snapshot
                : groupDoc?.saving_per_member || 0;

        const openingSaving = member?.openingSaving || 0;
        const savingPaidFromRecoveries = await getCumulativePayments(
            groupId,
            memberId,
            currentDate,
            "saving",
            meetingSequence,
            excludeRecoveryId
        );
        const totalSavingPaid = openingSaving + savingPaidFromRecoveries;

        const savingPrevDemand = previousData.saving.unpaidDemand || 0;
        const savingCurrDemand = savingPerMember;
        const savingTotalDemand = savingPrevDemand + savingCurrDemand;
        const savingUnpaidDemand = Math.max(
            0,
            savingTotalDemand - actualSaving
        );

        console.log("[SAVING]", {
            openingSaving,
            savingPaidFromRecoveries,
            totalSavingPaid,
            savingPrevDemand,
            savingCurrDemand,
            savingUnpaidDemand,
        });

        // ------------------ FD ------------------
        const openingFd = member?.fdDetails?.amount || 0;
        const fdPaidFromRecoveries = await getCumulativePayments(
            groupId,
            memberId,
            currentDate,
            "fd",
            meetingSequence,
            excludeRecoveryId
        );
        const totalFdPaid = openingFd + fdPaidFromRecoveries;

        console.log("[FD]", {
            openingFd,
            fdPaidFromRecoveries,
            totalFdPaid,
            actualFd,
        });

        // ------------------ FINAL RESULT ------------------
        const demandResult = {
            loan: {
                prevDemand: loanPrevDemand,
                currDemand: loanCurrDemand,
                totalDemand: loanTotalDemand,
                actualPaid: actualLoan,
                unpaidDemand: loanUnpaidDemand,
                openingBalance: totalLoanPaid,
                closingBalance: totalLoanPaid + actualLoan,
            },
            interest: {
                prevDemand: interestPrevDemand,
                currDemand: interestCurrDemand,
                totalDemand: interestTotalDemand,
                actualPaid: actualInterest,
                unpaidDemand: interestUnpaidDemand,
                openingBalance: interestPaid,
                closingBalance: interestPaid + actualInterest,
            },
            saving: {
                prevDemand: savingPrevDemand,
                currDemand: savingCurrDemand,
                totalDemand: savingTotalDemand,
                actualPaid: actualSaving,
                unpaidDemand: savingUnpaidDemand,
                openingBalance: totalSavingPaid,
                closingBalance: totalSavingPaid + actualSaving,
            },
            fd: {
                actualPaid: actualFd,
                openingBalance: totalFdPaid,
                closingBalance: totalFdPaid + actualFd,
            },
        };

        console.log("[FINAL_DEMAND_RESULT]");
        console.log(JSON.stringify(demandResult, null, 2));
        console.log("[DEMAND_CALCULATION_END]");
        console.log("=================================================");

        return demandResult;
    } catch (error) {
        console.error("[DEMAND_CALCULATION_ERROR]", error);
        throw error;
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
        const meetingSequence = 1;
        const previousData = await getPreviousRecoveryForMember(groupId, memberId, currentDate, meetingSequence);

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
        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Verify group exists and belongs to admin's place
        const accessCheck = await verifyGroupAccess(groupId, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
        }
        const groupDoc = accessCheck.group;

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

        // Meeting sequence is always 1 (no same-day meetings allowed)
        const meetingSequence = 1;

        // Create empty memberRecovery object for calculation
        const emptyMemberRecovery = {
            amounts: {}
        };

        // Calculate demand details
        const demandDetails = await calculateDemandDetails(
            groupDoc._id,
            memberId,
            emptyMemberRecovery,
            parsedDate,
            groupDoc,
            meetingSequence
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

        // Update cash denominations if provided
        // Note: We skip validation here since totals are already saved in the database
        // The frontend has already validated before calling this endpoint
        // We just save the denominations as provided
        if (req.body.cashDenominations) {
            recovery.cashDenominations = {
                note200: parseFloat(req.body.cashDenominations.note200) || 0,
                note500: parseFloat(req.body.cashDenominations.note500) || 0,
                note100: parseFloat(req.body.cashDenominations.note100) || 0,
                note50: parseFloat(req.body.cashDenominations.note50) || 0,
                note20: parseFloat(req.body.cashDenominations.note20) || 0,
                note10: parseFloat(req.body.cashDenominations.note10) || 0,
                note5: parseFloat(req.body.cashDenominations.note5) || 0,
                note2: parseFloat(req.body.cashDenominations.note2) || 0,
                note1: parseFloat(req.body.cashDenominations.note1) || 0,
            };
        }

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
// Logic: If someone joins between April, they pay at join time, then next demand is next April
// If already paid, don't show in demand or summary
const calculateMembershipDue = async (member, group, currentDate, groupId) => {
    try {
        // Parse current date
        let parsedDate = currentDate instanceof Date ? new Date(currentDate) : new Date(currentDate);
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

        // Get member join date
        const joinDate = member.Dt_Join || member.Member_Dt || member.createdAt;
        const joinYear = joinDate ? new Date(joinDate).getFullYear() : currentYear;
        const joinMonth = joinDate ? new Date(joinDate).getMonth() : currentMonth;

        // April is month 3 (0-indexed)
        const APRIL_MONTH = 3;

        // Get amounts from group
        const membershipFees = group.membership_fees || 0;
        const membershipGroup = group.Mship_Group || 0;

        let membershipFeesDue = 0;
        let membershipGroupDue = 0;

        // Check if current month is April
        const isApril = currentMonth === APRIL_MONTH;

        // Check if member is NEW (not existing) and joined outside April
        const isNewMember = !member.isExistingMember;
        const joinedOutsideApril = isNewMember && joinMonth !== APRIL_MONTH;

        if (groupId) {
            // Helper function to get next April date after a given date
            // If payment is in April, next April is next year
            // If payment is before April, next April is this year
            // If payment is after April, next April is next year
            const getNextApril = (date) => {
                const dateYear = date.getFullYear();
                const dateMonth = date.getMonth();
                if (dateMonth < APRIL_MONTH) {
                    // If before April (Jan-Mar), next April is this year
                    return new Date(dateYear, APRIL_MONTH, 1);
                } else {
                    // If April or after (Apr-Dec), next April is next year
                    return new Date(dateYear + 1, APRIL_MONTH, 1);
                }
            };

            // Check for unpaid membership fees SHG
            const unpaidMemFeesSHG = await MemberRevenueDemand.findOne({
                memberId: member._id,
                groupId: groupId,
                revenueType: "membership_fees_shg",
                isPaid: false,
            }).sort({ demandDate: 1 }).lean();

            if (unpaidMemFeesSHG) {
                // Show unpaid fee
                membershipFeesDue = unpaidMemFeesSHG.amount || membershipFees;
            } else {
                // Check for the most recent paid membership fee
                const lastPaidMemFeesSHG = await MemberRevenueDemand.findOne({
                    memberId: member._id,
                    groupId: groupId,
                    revenueType: "membership_fees_shg",
                    isPaid: true,
                }).sort({ paidDate: -1 }).lean();

                if (lastPaidMemFeesSHG && lastPaidMemFeesSHG.paidDate) {
                    // If paid, check if we're past the next April after payment
                    const paidDate = new Date(lastPaidMemFeesSHG.paidDate);
                    const nextAprilAfterPayment = getNextApril(paidDate);

                    // Only show demand in April if current date is on or after next April after payment
                    // Demand is only created/shown in April (April-to-April cycle)
                    if (isApril && parsedDate >= nextAprilAfterPayment) {
                        // Check if annual demand for this financial year already exists
                        const financialYear = `${currentYear}-${String(currentYear + 1).slice(-2)}`;

                        const annualDemandSHG = await MemberRevenueDemand.findOne({
                            memberId: member._id,
                            groupId: groupId,
                            revenueType: "membership_fees_shg",
                            isAnnualDemand: true,
                            year: financialYear,
                        }).lean();

                        if (!annualDemandSHG && membershipFees > 0) {
                            await MemberRevenueDemand.create({
                                memberId: member._id,
                                groupId: groupId,
                                revenueType: "membership_fees_shg",
                                amount: membershipFees,
                                demandDate: parsedDate,
                                isAnnualDemand: true,
                                year: financialYear,
                                notes: `Annual demand (April)`,
                                isPaid: false,
                            });
                            membershipFeesDue = membershipFees;
                        } else if (annualDemandSHG && !annualDemandSHG.isPaid) {
                            membershipFeesDue = membershipFees;
                        }
                    }
                    // If not April or current date is before next April after payment, don't show demand (already paid)
                } else {
                    // No payment history - check if member needs initial demand
                    if (isApril) {
                        // In April, create annual demand for members who haven't paid
                        const financialYear = `${currentYear}-${String(currentYear + 1).slice(-2)}`;

                        const annualDemandSHG = await MemberRevenueDemand.findOne({
                            memberId: member._id,
                            groupId: groupId,
                            revenueType: "membership_fees_shg",
                            isAnnualDemand: true,
                            year: financialYear,
                        }).lean();

                        if (!annualDemandSHG && membershipFees > 0) {
                            await MemberRevenueDemand.create({
                                memberId: member._id,
                                groupId: groupId,
                                revenueType: "membership_fees_shg",
                                amount: membershipFees,
                                demandDate: parsedDate,
                                isAnnualDemand: true,
                                year: financialYear,
                                notes: `Annual demand (April)`,
                                isPaid: false,
                            });
                            membershipFeesDue = membershipFees;
                        } else if (annualDemandSHG && !annualDemandSHG.isPaid) {
                            membershipFeesDue = membershipFees;
                        }
                    } else if (joinedOutsideApril) {
                        // For new members joining outside April: create registration demand
                        // They pay at join time, then next demand is next April
                        const financialYear = `${joinYear}-${String(joinYear + 1).slice(-2)}`;

                        const registrationDemandSHG = await MemberRevenueDemand.findOne({
                            memberId: member._id,
                            groupId: groupId,
                            revenueType: "membership_fees_shg",
                            isAnnualDemand: false,
                        }).lean();

                        if (!registrationDemandSHG && membershipFees > 0) {
                            await MemberRevenueDemand.create({
                                memberId: member._id,
                                groupId: groupId,
                                revenueType: "membership_fees_shg",
                                amount: membershipFees,
                                demandDate: new Date(joinDate),
                                isAnnualDemand: false,
                                year: financialYear,
                                notes: `New member registration demand (joined outside April)`,
                                isPaid: false,
                            });
                            membershipFeesDue = membershipFees;
                        } else if (registrationDemandSHG && !registrationDemandSHG.isPaid) {
                            membershipFeesDue = membershipFees;
                        }
                    }
                }
            }

            // Check for unpaid membership fees Group
            const unpaidMemFeesGroup = await MemberRevenueDemand.findOne({
                memberId: member._id,
                groupId: groupId,
                revenueType: "membership_fees_group",
                isPaid: false,
            }).sort({ demandDate: 1 }).lean();

            if (unpaidMemFeesGroup) {
                // Show unpaid fee
                membershipGroupDue = unpaidMemFeesGroup.amount || membershipGroup;
            } else {
                // Check for the most recent paid membership group fee
                const lastPaidMemFeesGroup = await MemberRevenueDemand.findOne({
                    memberId: member._id,
                    groupId: groupId,
                    revenueType: "membership_fees_group",
                    isPaid: true,
                }).sort({ paidDate: -1 }).lean();

                if (lastPaidMemFeesGroup && lastPaidMemFeesGroup.paidDate) {
                    // If paid, check if we're past the next April after payment
                    const paidDate = new Date(lastPaidMemFeesGroup.paidDate);
                    const nextAprilAfterPayment = getNextApril(paidDate);

                    // Only show demand in April if current date is on or after next April after payment
                    // Demand is only created/shown in April (April-to-April cycle)
                    if (isApril && parsedDate >= nextAprilAfterPayment) {
                        // Check if annual demand for this financial year already exists
                        const financialYear = `${currentYear}-${String(currentYear + 1).slice(-2)}`;

                        const annualDemandGroup = await MemberRevenueDemand.findOne({
                            memberId: member._id,
                            groupId: groupId,
                            revenueType: "membership_fees_group",
                            isAnnualDemand: true,
                            year: financialYear,
                        }).lean();

                        if (!annualDemandGroup && membershipGroup > 0) {
                            await MemberRevenueDemand.create({
                                memberId: member._id,
                                groupId: groupId,
                                revenueType: "membership_fees_group",
                                amount: membershipGroup,
                                demandDate: parsedDate,
                                isAnnualDemand: true,
                                year: financialYear,
                                notes: `Annual demand (April)`,
                                isPaid: false,
                            });
                            membershipGroupDue = membershipGroup;
                        } else if (annualDemandGroup && !annualDemandGroup.isPaid) {
                            membershipGroupDue = membershipGroup;
                        }
                    }
                    // If not April or current date is before next April after payment, don't show demand (already paid)
                } else {
                    // No payment history - check if member needs initial demand
                    if (isApril) {
                        // In April, create annual demand for members who haven't paid
                        const financialYear = `${currentYear}-${String(currentYear + 1).slice(-2)}`;

                        const annualDemandGroup = await MemberRevenueDemand.findOne({
                            memberId: member._id,
                            groupId: groupId,
                            revenueType: "membership_fees_group",
                            isAnnualDemand: true,
                            year: financialYear,
                        }).lean();

                        if (!annualDemandGroup && membershipGroup > 0) {
                            await MemberRevenueDemand.create({
                                memberId: member._id,
                                groupId: groupId,
                                revenueType: "membership_fees_group",
                                amount: membershipGroup,
                                demandDate: parsedDate,
                                isAnnualDemand: true,
                                year: financialYear,
                                notes: `Annual demand (April)`,
                                isPaid: false,
                            });
                            membershipGroupDue = membershipGroup;
                        } else if (annualDemandGroup && !annualDemandGroup.isPaid) {
                            membershipGroupDue = membershipGroup;
                        }
                    } else if (joinedOutsideApril) {
                        // For new members joining outside April: create registration demand
                        // They pay at join time, then next demand is next April
                        const financialYear = `${joinYear}-${String(joinYear + 1).slice(-2)}`;

                        const registrationDemandGroup = await MemberRevenueDemand.findOne({
                            memberId: member._id,
                            groupId: groupId,
                            revenueType: "membership_fees_group",
                            isAnnualDemand: false,
                        }).lean();

                        if (!registrationDemandGroup && membershipGroup > 0) {
                            await MemberRevenueDemand.create({
                                memberId: member._id,
                                groupId: groupId,
                                revenueType: "membership_fees_group",
                                amount: membershipGroup,
                                demandDate: new Date(joinDate),
                                isAnnualDemand: false,
                                year: financialYear,
                                notes: `New member registration demand (joined outside April)`,
                                isPaid: false,
                            });
                            membershipGroupDue = membershipGroup;
                        } else if (registrationDemandGroup && !registrationDemandGroup.isPaid) {
                            membershipGroupDue = membershipGroup;
                        }
                    }
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

// Get remaining revenue demands from MemberRevenueDemand
// Returns unpaid membership fees, group fees, and their remaining amounts
export const getMemberRevenueRemaining = async (req, res) => {
    try {
        const { groupId, memberId } = req.query;

        if (!groupId || !memberId) {
            return apiResponse.error(res, "groupId and memberId are required", 400);
        }

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Verify group exists and belongs to admin's place
        const accessCheck = await verifyGroupAccess(groupId, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
        }

        // Get member document
        const member = await Member.findOne({
            _id: memberId,
            group: groupId
        }).lean();

        if (!member) {
            return apiResponse.error(res, "Member not found", 404);
        }

        // Get group document for verification
        const groupDoc = await GroupMaster.findById(groupId).lean();
        if (!groupDoc) {
            return apiResponse.error(res, "Group not found", 404);
        }

        // Get all unpaid revenue demands for this member
        const memberObjectId = typeof memberId === 'string' ? memberId : memberId.toString();
        const groupObjectId = typeof groupId === 'string' ? groupId : groupId.toString();

        const unpaidRevenueDemands = await MemberRevenueDemand.find({
            $or: [
                { memberId: memberObjectId, groupId: groupObjectId, isPaid: false },
                { memberId: member._id, groupId: groupDoc._id, isPaid: false }
            ]
        })
            .sort({ demandDate: 1 })
            .lean();

        // Calculate totals and remaining amounts for each revenue type
        let totalMembershipFeesDemand = 0;
        let totalMembershipFeesPaid = 0;
        let totalMembershipGroupDemand = 0;
        let totalMembershipGroupPaid = 0;

        const membershipFeesDetails = [];
        const membershipGroupDetails = [];

        unpaidRevenueDemands.forEach(demand => {
            const demandAmount = parseFloat(demand.amount || 0);
            const paidAmount = parseFloat(demand.paidAmount || 0);
            const remainingAmount = Math.max(0, demandAmount - paidAmount);

            if (demand.revenueType === "membership_fees_shg") {
                totalMembershipFeesDemand += demandAmount;
                totalMembershipFeesPaid += paidAmount;
                membershipFeesDetails.push({
                    demandId: demand._id,
                    demandAmount,
                    paidAmount,
                    remainingAmount,
                    demandDate: demand.demandDate,
                    isAnnualDemand: demand.isAnnualDemand,
                    year: demand.year,
                    notes: demand.notes
                });
            } else if (demand.revenueType === "membership_fees_group") {
                totalMembershipGroupDemand += demandAmount;
                totalMembershipGroupPaid += paidAmount;
                membershipGroupDetails.push({
                    demandId: demand._id,
                    demandAmount,
                    paidAmount,
                    remainingAmount,
                    demandDate: demand.demandDate,
                    isAnnualDemand: demand.isAnnualDemand,
                    year: demand.year,
                    notes: demand.notes
                });
            }
        });

        const remainingMembershipFees = Math.max(0, totalMembershipFeesDemand - totalMembershipFeesPaid);
        const remainingMembershipGroup = Math.max(0, totalMembershipGroupDemand - totalMembershipGroupPaid);

        return apiResponse.success(res, "Member revenue remaining amounts fetched successfully", {
            // Membership Fees SHG
            membershipFeesSHG: {
                totalDemand: totalMembershipFeesDemand,
                totalPaid: totalMembershipFeesPaid,
                remainingAmount: remainingMembershipFees,
                details: membershipFeesDetails
            },
            // Membership Fees Group
            membershipFeesGroup: {
                totalDemand: totalMembershipGroupDemand,
                totalPaid: totalMembershipGroupPaid,
                remainingAmount: remainingMembershipGroup,
                details: membershipGroupDetails
            },
            // Summary
            hasUnpaidDemands: unpaidRevenueDemands.length > 0
        });
    } catch (error) {
        console.error("Error fetching member revenue remaining amounts:", error);
        return apiResponse.error(res, error.message, 500);
    }
};

// Get loan totals for a member (from LoanMaster and RecoveryMaster)
// Also includes remaining amounts for yogdan and overdueInterest
export const getMemberLoanTotals = async (req, res) => {
    try {
        const { groupId, memberId } = req.query;

        if (!groupId || !memberId) {
            return apiResponse.error(res, "groupId and memberId are required", 400);
        }

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Verify group exists and belongs to admin's place
        const accessCheck = await verifyGroupAccess(groupId, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
        }

        // Get member document to get openingYogdan and overdueInterest
        const member = await Member.findOne({
            _id: memberId,
            group: groupId
        }).lean();

        if (!member) {
            return apiResponse.error(res, "Member not found", 404);
        }

        // Calculate total loan amount from LoanMaster
        // Sum all loan amounts where transactionType === "Loan" and status === "approved"
        const loans = await LoanMaster.find({
            groupId: groupId,
            memberId: memberId.toString(),
            transactionType: "Loan",
            status: "approved"
        }).lean();

        const totalLoanAmount = loans.reduce((sum, loan) => {
            return sum + (parseFloat(loan.amount) || 0);
        }, 0);

        // Get all recoveries for this group
        const recoveries = await RecoveryMaster.find({
            groupId: groupId
        }).lean();

        // Calculate total recovered amounts from RecoveryMaster
        let totalLoanRecovered = 0;
        let totalYogdanRecovered = 0;
        let totalOverdueInterestRecovered = 0;

        recoveries.forEach((recovery) => {
            const memberRecovery = recovery.recoveries?.find(
                (r) => r.memberId === memberId.toString()
            );
            if (memberRecovery && memberRecovery.amounts) {
                totalLoanRecovered += parseFloat(memberRecovery.amounts.loan || 0);
                totalYogdanRecovered += parseFloat(memberRecovery.amounts.yogdan || 0);
                totalOverdueInterestRecovered += parseFloat(memberRecovery.amounts.interest || 0);
            }
        });

        // Calculate remaining amounts
        const remainingLoanAmount = Math.max(0, totalLoanAmount - totalLoanRecovered);

        // Get opening amounts from member model
        const openingYogdan = parseFloat(member.openingYogdan || 0);
        const openingOverdueInterest = parseFloat(member.loanDetails?.overdueInterest || 0);

        // Calculate remaining amounts = opening - recovered
        const remainingYogdanAmount = Math.max(0, openingYogdan - totalYogdanRecovered);
        const remainingOverdueInterestAmount = Math.max(0, openingOverdueInterest - totalOverdueInterestRecovered);

        return apiResponse.success(res, "Member remaining amounts fetched successfully", {
            // Loan data
            totalLoanAmount,
            totalLoanRecovered,
            remainingLoanAmount,
            // Yogdan data
            openingYogdan,
            totalYogdanRecovered,
            remainingYogdanAmount,
            // Overdue Interest data
            openingOverdueInterest,
            totalOverdueInterestRecovered,
            remainingOverdueInterestAmount
        });
    } catch (error) {
        console.error("Error fetching member remaining amounts:", error);
        return apiResponse.error(res, error.message, 500);
    }
};

// Get group recovery details - all recovery sessions for a group
export const getGroupRecoveryDetails = async (req, res) => {
    try {
        const { groupId, fromDate, toDate } = req.query;

        if (!groupId) {
            return apiResponse.error(res, "groupId is required", 400);
        }

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Verify group access
        const accessCheck = await verifyGroupAccess(groupId, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
        }

        // Build date filter
        const dateFilter = {};
        if (fromDate) {
            const from = new Date(fromDate);
            from.setHours(0, 0, 0, 0);
            dateFilter.$gte = from;
        }
        if (toDate) {
            const to = new Date(toDate);
            to.setHours(23, 59, 59, 999);
            dateFilter.$lte = to;
        }

        // Build query
        const query = { groupId };
        if (Object.keys(dateFilter).length > 0) {
            query.date = dateFilter;
        }

        // Fetch all recovery sessions for the group
        const recoveries = await RecoveryMaster.find(query)
            .populate("groupId", "group_name group_code village")
            .sort({ date: -1, meetingSequence: -1 }) // Newest first
            .lean();

        return apiResponse.success(res, "Group recovery details fetched successfully", recoveries);
    } catch (error) {
        console.error("Error fetching group recovery details:", error);
        return apiResponse.error(res, error.message, 500);
    }
};

// Export recovery data as PDF
export const exportRecoveryPDF = async (req, res) => {
    try {
        const { groupId, date } = req.query;

        if (!groupId) {
            return apiResponse.error(res, "groupId is required", 400);
        }

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Verify group access
        const accessCheck = await verifyGroupAccess(groupId, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
        }

        const group = accessCheck.group;

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

        const dateStart = new Date(parsedDate);
        dateStart.setHours(0, 0, 0, 0);
        const dateEnd = new Date(parsedDate);
        dateEnd.setHours(23, 59, 59, 999);

        // Fetch recovery data
        const recovery = await RecoveryMaster.findOne({
            groupId,
            date: { $gte: dateStart, $lte: dateEnd }
        }).lean();

        if (!recovery) {
            return apiResponse.error(res, "No recovery session found for this date", 404);
        }

        // Prepare group info
        const groupInfo = {
            name: group.group_name || recovery.groupName,
            code: group.group_code || recovery.groupCode,
            village: group.village
        };

        // Prepare recovery data
        const recoveryData = {
            date: recovery.date,
            recoveries: recovery.recoveries || []
        };

        // Prepare totals
        const totals = recovery.totals || {
            totalCash: 0,
            totalOnline: 0,
            totalAmount: 0
        };

        // Generate PDF
        try {
            const pdfBuffer = await generateRecoveryPDF(recoveryData, groupInfo, totals);

            // Set response headers
            const filename = `${groupInfo.name || 'Recovery'}_${parsedDate.toISOString().split('T')[0]}.pdf`;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
            res.setHeader('Content-Length', pdfBuffer.length);

            // Send PDF
            res.send(pdfBuffer);
        } catch (pdfError) {
            console.error("Error generating PDF:", pdfError);
            return apiResponse.error(res, `Error generating PDF: ${pdfError.message}`, 500);
        }
    } catch (error) {
        console.error("Error exporting recovery PDF:", error);
        return apiResponse.error(res, error.message, 500);
    }
};

// Check recovery status for a member on a specific date
export const getMemberRecoveryStatus = async (req, res) => {
    try {
        const { memberId } = req.params;
        const { date, groupId } = req.query;

        if (!memberId) {
            return apiResponse.error(res, "memberId is required", 400);
        }

        if (!groupId) {
            return apiResponse.error(res, "groupId is required", 400);
        }

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Verify group access
        const accessCheck = await verifyGroupAccess(groupId, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
        }

        // Parse date (default to today if not provided)
        const parsedDate = parseDate(date);
        const { start: dateStart, end: dateEnd } = getDateRange(parsedDate);

        // Find recovery session for this date and group
        const recoverySession = await RecoveryMaster.findOne({
            groupId,
            date: { $gte: dateStart, $lte: dateEnd },
            'recoveries.memberId': memberId
        }).lean();

        if (!recoverySession) {
            return apiResponse.success(res, "Recovery status fetched successfully", {
                recoveredToday: false,
                recoveryId: null,
                amount: 0,
                recovery: null
            });
        }

        // Find the member's recovery in the session
        const memberRecovery = recoverySession.recoveries?.find(
            r => r.memberId === memberId || r.memberId?.toString() === memberId?.toString()
        );

        if (!memberRecovery) {
            return apiResponse.success(res, "Recovery status fetched successfully", {
                recoveredToday: false,
                recoveryId: null,
                amount: 0,
                recovery: null
            });
        }

        // Check if recovery is valid (present or absent with recovery by other)
        const isRecovered = memberRecovery.attendance === 'present' ||
            (memberRecovery.attendance === 'absent' && memberRecovery.recoveryByOther);

        return apiResponse.success(res, "Recovery status fetched successfully", {
            recoveredToday: isRecovered,
            recoveryId: recoverySession._id,
            amount: memberRecovery.total || 0,
            recovery: isRecovered ? {
                memberId: memberRecovery.memberId,
                memberCode: memberRecovery.memberCode,
                memberName: memberRecovery.memberName,
                attendance: memberRecovery.attendance,
                amounts: memberRecovery.amounts,
                total: memberRecovery.total,
                paymentMode: memberRecovery.paymentMode,
                date: recoverySession.date
            } : null
        });
    } catch (error) {
        console.error("Error fetching member recovery status:", error);
        return apiResponse.error(res, error.message, 500);
    }
};


