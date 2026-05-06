import apiResponse from "../../utility/apiResponse.js";
import message from "../../utility/message.js";
import mongoose from "mongoose";
import crypto from "crypto";
import RecoveryMaster from "../../model/RecoveryMaster.js";
import { GroupMaster, FDMaster, MemberRevenueDemand, LoanAdjustmentLog, BankTransaction, CashTransaction, BankMaster } from "../../model/index.js";
import LoanMaster from "../../model/LoanMaster.js";
import Member from "../../model/Member.js";
import { createBankTransactionRecord } from "../../utility/bankTransactionHelper.js";
import { createCashTransactionRecord } from "../../utility/cashTransactionHelper.js";
import { verifyGroupAccess, verifyGroupAccessByCode, verifyGroupAccessByName } from "../../utility/groupAccessHelper.js";
import { generateRecoveryPDF } from "../../utility/pdfGenerator.js";
import { getDateRange, parseDate } from "../../utility/dateUtils.js";
import { postTransaction } from "../../service/ledgerPostingService.js";
import { findOrCreateHead } from "../../utility/headMappingHelper.js";
import { removeCashAmountInternal } from "./cashAmountController.js";
import { postJournal } from "../../service/journalPostingService.js";
import { getRecoveryLines } from "../../utility/accountHeadMap.js";
import {
    resolveMeetingForRecovery,
    getPreviousMeeting,
    getNextMeetingDate,
} from "../../service/meetingResolver.js";
import { getCarryForward } from "../../service/carryForwardService.js";
import { calculateDemandDetailsPure } from "../../service/demandEngine.js";
import { finalizeRecovery } from "../../service/recoveryWriter.js";
import { processRecoveryTransactions } from "../../service/recoverySideEffects.js";
import {
    upsertAnnualMembershipDemand,
    upsertRegistrationMembershipDemand,
    addPenaltyDemand as createPenaltyDemandRecord,
} from "../../service/revenueDemandService.js";

/** Round demand amount to fixed integer: if decimal >= 0.5 round up, else round down */
const roundDemand = (n) => (typeof n === "number" && !Number.isNaN(n)) ? Math.round(n) : (parseFloat(n) || 0);

/**
 * Interest / membership fees / FD (when fd.totalDemand > 0) cannot exceed demand totals from calculateDemandDetails.
 * Loan is validated separately (remaining principal).
 */
function validateRecoveryDemandCaps(demandDetails, amounts) {
    if (!demandDetails || !amounts) return null;
    const interest = roundDemand(parseFloat(amounts.interest) || 0);
    const maxInterest = roundDemand(demandDetails.interest?.totalDemand ?? 0);
    if (interest > maxInterest) {
        return `Interest on loan cannot exceed demand of ₹${maxInterest.toLocaleString()}`;
    }
    const shg = roundDemand(parseFloat(amounts.memFeesSHG) || 0);
    const maxShg = roundDemand(demandDetails.memFeesSHG?.totalDemand ?? 0);
    if (shg > maxShg) {
        return `Mem. Fees SHG (Yearly) cannot exceed demand of ₹${maxShg.toLocaleString()}`;
    }
    const grp = roundDemand(parseFloat(amounts.memFeesGroup) || 0);
    const maxGrp = roundDemand(demandDetails.memFeesGroup?.totalDemand ?? 0);
    if (grp > maxGrp) {
        return `Mem. Fees Group (Yearly) cannot exceed demand of ₹${maxGrp.toLocaleString()}`;
    }
    const fdAmt = roundDemand(parseFloat(amounts.fd) || 0);
    const maxFd = roundDemand(demandDetails.fd?.totalDemand ?? 0);
    if (maxFd > 0 && fdAmt > maxFd) {
        return `FD amount cannot exceed demand of ₹${maxFd.toLocaleString()}`;
    }
    return null;
}

/**
 * Walk back MemberRevenueDemand payments that were attributed to this recovery session (same logic as payment, reversed).
 */
async function revertRevenueDemandPaymentsForMember({ memberId, groupId, recoverySessionId, revenueType, amountToRevert }) {
    let remaining = roundDemand(parseFloat(amountToRevert) || 0);
    if (remaining <= 0) return;

    const demands = await MemberRevenueDemand.find({
        memberId,
        groupId,
        revenueType,
        recoveryId: recoverySessionId,
    }).sort({ isAnnualDemand: -1, demandDate: -1 });

    for (const d of demands) {
        if (remaining <= 0) break;
        const paid = parseFloat(d.paidAmount) || 0;
        if (paid <= 0) continue;
        const take = Math.min(remaining, paid);
        const newPaid = roundDemand(paid - take);
        remaining = roundDemand(remaining - take);
        d.paidAmount = newPaid;
        const demandAmount = parseFloat(d.amount) || 0;
        if (newPaid <= 0.001) {
            d.paidAmount = 0;
            d.isPaid = false;
            d.paidDate = null;
            d.recoveryId = null;
        } else {
            d.isPaid = newPaid >= demandAmount;
        }
        await d.save();
    }
}

/**
 * Un-mark yogdan on loans that were marked for this recovery (LIFO vs collection order).
 */
async function revertYogdanMarksForMemberRecovery(oldMemberRecovery, groupDoc, parsedDate) {
    const oldY = parseFloat(oldMemberRecovery.amounts?.yogdan) || 0;
    if (oldY <= 0 || !oldMemberRecovery.memberId) return;

    let remaining = oldY;
    const { start: dateStart, end: dateEnd } = getDateRange(parsedDate);

    const memberLoans = await LoanMaster.find({
        groupId: groupDoc._id,
        memberId: oldMemberRecovery.memberId.toString(),
        transactionType: "Loan",
        status: "approved",
        yogdanCollected: true,
        yogdanCollectedDate: { $gte: dateStart, $lte: dateEnd },
    })
        .sort({ date: -1 })
        .lean();

    for (const loan of memberLoans) {
        if (remaining <= 0) break;
        const loanAmount = loan.amount || 0;
        const hasStored = loan.yogdanAmount !== undefined && loan.yogdanAmount !== null;
        const yogdanAmount = hasStored ? (parseFloat(loan.yogdanAmount) || 0) : Math.round((loanAmount * 0.01) * 100) / 100;
        if (yogdanAmount <= 0) continue;
        if (remaining >= yogdanAmount - 0.001) {
            await LoanMaster.findByIdAndUpdate(loan._id, {
                $set: { yogdanCollected: false, yogdanCollectedDate: null },
            });
            remaining = roundDemand(remaining - yogdanAmount);
        }
    }
}

/**
 * Before replacing a member's recovery row, undo side effects from the previous save
 * so MemberRevenueDemand, yogdan flags, and cash/bank records stay consistent.
 * Ledger rows are updated in place by postTransaction when the session is saved again.
 */
async function revertMemberRecoveryUpdateSideEffects(oldMemberRecovery, recoverySessionId, groupDoc, parsedDate) {
    if (!oldMemberRecovery || !recoverySessionId || !groupDoc?._id) return;
    const memberId = oldMemberRecovery.memberId;
    if (!memberId) return;

    const amounts = oldMemberRecovery.amounts || {};
    const groupId = groupDoc._id;

    const revSpecs = [
        { revenueType: "membership_fees_shg", key: "memFeesSHG" },
        { revenueType: "membership_fees_group", key: "memFeesGroup" },
        { revenueType: "penalty", key: "penalty" },
    ];
    for (const { revenueType, key } of revSpecs) {
        const amt = parseFloat(amounts[key]) || 0;
        if (amt > 0) {
            await revertRevenueDemandPaymentsForMember({
                memberId,
                groupId,
                recoverySessionId,
                revenueType,
                amountToRevert: amt,
            });
        }
    }

    await revertYogdanMarksForMemberRecovery(oldMemberRecovery, groupDoc, parsedDate);

    const mid = memberId.toString ? memberId.toString() : String(memberId);

    const cashDocs = await CashTransaction.find({
        recoveryId: recoverySessionId,
        recoveryMemberId: mid,
        transactionType: "recovery",
    });
    for (const ct of cashDocs) {
        const amt = parseFloat(ct.amount) || 0;
        if (amt > 0) {
            try {
                await removeCashAmountInternal(groupId, amt);
            } catch (e) {
                console.error("[revertMemberRecoveryUpdateSideEffects] removeCashAmountInternal:", e);
            }
        }
        await CashTransaction.findByIdAndDelete(ct._id);
    }

    const bankDocs = await BankTransaction.find({
        recoveryId: recoverySessionId,
        recoveryMemberId: mid,
        transactionType: "recovery",
    });
    for (const bt of bankDocs) {
        const bankId = bt.bankId;
        await BankTransaction.findByIdAndDelete(bt._id);
        if (bankId) {
            const bank = await BankMaster.findById(bankId);
            if (bank && typeof bank.recalculateBalance === "function") {
                try {
                    await bank.recalculateBalance();
                } catch (e) {
                    console.error("[revertMemberRecoveryUpdateSideEffects] bank recalculateBalance:", e);
                }
            }
        }
    }
}

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

        const requireApproval =
            payload.requireApproval === true || payload.source === "group_sync";
        const meetingSequence = 1;

        // Ledger finalize: single writer, idempotent clientRequestId, immutable snapshot
        if (
            !requireApproval &&
            payload.recoveries &&
            Array.isArray(payload.recoveries) &&
            payload.recoveries.length > 0
        ) {
            try {
                const clientRequestId =
                    payload.clientRequestId ||
                    (typeof crypto.randomUUID === "function"
                        ? crypto.randomUUID()
                        : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
                const { recovery, idempotent } = await finalizeRecovery({
                    groupDoc,
                    payload,
                    parsedDate,
                    clientRequestId,
                    actor: req.user?.id || payload.createdBy || "admin",
                });
                return apiResponse.success(
                    res,
                    idempotent
                        ? "Recovery already registered (idempotent)"
                        : "Recovery session registered successfully",
                    recovery
                );
            } catch (e) {
                if (
                    e.code === "RECOVERY_CAP_VALIDATION" ||
                    e.code === "RECOVERY_MEETING_LOCKED" ||
                    e.code === "CLIENT_REQUEST_ID_REQUIRED"
                ) {
                    return apiResponse.error(res, e.message, 400);
                }
                throw e;
            }
        }

        // Get date range for checking existing recoveries
        const { start: dateStart, end: dateEnd } = getDateRange(parsedDate);

        // When syncing from group panel: if a recovery session already exists for this group+date, update it instead of creating a duplicate
        const existingSessionForDate = await RecoveryMaster.findOne({
            groupId: groupDoc._id,
            date: { $gte: dateStart, $lte: dateEnd },
        }).sort({ meetingSequence: -1 });

        if (existingSessionForDate && requireApproval && payload.recoveries && Array.isArray(payload.recoveries) && payload.recoveries.length > 0) {
            const nextMeetingDate = getNextMeetingDate(parsedDate, groupDoc);
            const enrichOne = async (rec) => {
                const isPresent = rec.attendance === 'present' || (rec.attendance === 'absent' && rec.recoveryByOther);
                let demandDetails = rec.demandDetails;
                let total = rec.total;
                if (isPresent) {
                    const hasValid = demandDetails && typeof demandDetails === 'object' && (demandDetails.loan?.totalDemand != null || demandDetails.saving?.totalDemand != null);
                    if (!hasValid) {
                        try {
                            demandDetails = await calculateDemandDetails(groupDoc._id, rec.memberId, rec, parsedDate, groupDoc, meetingSequence);
                        } catch (err) {
                            console.error('[registerRecovery] calculateDemandDetails failed for member', rec.memberId, err);
                            demandDetails = rec.demandDetails || {};
                        }
                    }
                    const sum = (rec.amounts?.saving || 0) + (rec.amounts?.loan || 0) + (rec.amounts?.fd || 0) + (rec.amounts?.interest || 0) + (rec.amounts?.yogdan || 0) + (rec.amounts?.memFeesSHG || 0) + (rec.amounts?.memFeesSamiti || 0) + (rec.amounts?.memFeesGroup || 0) + (rec.amounts?.penalty || 0) + (rec.amounts?.other || 0) + (rec.amounts?.other1 || 0) + (rec.amounts?.other2 || 0);
                    if (total == null || total === 0) total = roundDemand(sum);
                }
                return { ...rec, demandDetails: demandDetails || {}, total: roundDemand(total ?? 0) };
            };
            const existingRecoveries = existingSessionForDate.recoveries || [];
            const existingByMember = new Map(existingRecoveries.map((r) => [String(r.memberId), r]));
            for (const rec of payload.recoveries) {
                const enriched = await enrichOne(rec);
                existingByMember.set(String(rec.memberId), enriched);
            }
            const mergedRecoveries = Array.from(existingByMember.values());
            let totalCash = 0, totalOnline = 0, totalAmount = 0;
            for (const rec of mergedRecoveries) {
                if (rec.attendance === 'present' || (rec.attendance === 'absent' && rec.recoveryByOther)) {
                    const t = roundDemand(rec.total ?? 0);
                    totalAmount += t;
                    if (rec.paymentMode?.cash) totalCash += t;
                    if (rec.paymentMode?.online) totalOnline += t;
                }
            }
            existingSessionForDate.recoveries = mergedRecoveries;
            existingSessionForDate.memberCount = mergedRecoveries.length;
            existingSessionForDate.totals = {
                totalCash: roundDemand(totalCash),
                totalOnline: roundDemand(totalOnline),
                totalAmount: roundDemand(totalAmount),
            };
            if (payload.groupPhoto != null) existingSessionForDate.groupPhoto = payload.groupPhoto;
            if (payload.cashDenominations) existingSessionForDate.cashDenominations = payload.cashDenominations;
            if (nextMeetingDate) existingSessionForDate.nextMeetingDate = nextMeetingDate;
            await existingSessionForDate.save();
            const msg = requireApproval ? "Recovery session updated and pending admin approval" : "Recovery session updated successfully";
            return apiResponse.success(res, msg, existingSessionForDate);
        }

        // Check if any member in the recoveries array already has a recovery for this date (when not updating existing session)
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
        // Skip this validation for group panel recoveries that require approval - let admin decide during approval
        const meetingDay1 = groupDoc.meeting_date_1_day;
        const meetingDay2 = groupDoc.meeting_date_2_day;

        if ((meetingDay1 != null || meetingDay2 != null) && !requireApproval) {
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

        // Approval status determined earlier (requireApproval already checked above)
        const approvalStatus = requireApproval ? 'pending' : 'approved';

        // Helper: enrich a single member recovery with demandDetails and total
        const enrichRecovery = async (rec) => {
            const isPresent = rec.attendance === 'present' || (rec.attendance === 'absent' && rec.recoveryByOther);
            let demandDetails = rec.demandDetails;
            let total = rec.total;
            if (isPresent) {
                const hasValidDemandDetails = demandDetails && typeof demandDetails === 'object' && (demandDetails.loan?.totalDemand != null || demandDetails.saving?.totalDemand != null);
                if (!hasValidDemandDetails) {
                    try {
                        demandDetails = await calculateDemandDetails(
                            groupDoc._id,
                            rec.memberId,
                            rec,
                            parsedDate,
                            groupDoc,
                            meetingSequence
                        );
                    } catch (err) {
                        console.error('[registerRecovery] calculateDemandDetails failed for member', rec.memberId, err);
                        demandDetails = rec.demandDetails || {};
                    }
                }
                const sum = (rec.amounts?.saving || 0) + (rec.amounts?.loan || 0) + (rec.amounts?.fd || 0) + (rec.amounts?.interest || 0) + (rec.amounts?.yogdan || 0) + (rec.amounts?.memFeesSHG || 0) + (rec.amounts?.memFeesSamiti || 0) + (rec.amounts?.memFeesGroup || 0) + (rec.amounts?.penalty || 0) + (rec.amounts?.other || 0) + (rec.amounts?.other1 || 0) + (rec.amounts?.other2 || 0);
                if (total == null || total === 0) total = sum;
            }
            return { ...rec, demandDetails: demandDetails || {}, total: total ?? 0 };
        };

        // Create new recovery session (store recovery date and next meeting date for reporting)
        const nextMeetingDate = getNextMeetingDate(parsedDate, groupDoc);
        const recoveryData = {
            ...payload,
            date: parsedDate,
            recoveryDate: parsedDate,
            nextMeetingDate: nextMeetingDate || undefined,
            meetingSequence: meetingSequence,
            groupId: groupDoc._id,
            groupName: payload.groupName || groupDoc.group_name,
            groupCode: payload.groupCode || groupDoc.group_code,
            status: "approved",
            approvalStatus: approvalStatus,
            createdBy: req.user?.id || payload.createdBy || "admin",
        };

        // Enrich each member recovery with demandDetails and total when syncing from group panel
        if (payload.recoveries && Array.isArray(payload.recoveries) && payload.recoveries.length > 0) {
            const enrichedRecoveries = [];
            let totalCash = 0;
            let totalOnline = 0;
            let totalAmount = 0;
            for (const rec of payload.recoveries) {
                const enriched = await enrichRecovery(rec);
                enrichedRecoveries.push(enriched);
                if (enriched.attendance === 'present' || (enriched.attendance === 'absent' && enriched.recoveryByOther)) {
                    const t = roundDemand(enriched.total ?? 0);
                    totalAmount += t;
                    if (enriched.paymentMode?.cash) totalCash += t;
                    if (enriched.paymentMode?.online) totalOnline += t;
                }
            }
            recoveryData.recoveries = enrichedRecoveries;
            recoveryData.totals = payload.totals && (payload.totals.totalAmount != null || payload.totals.totalCash != null)
                ? payload.totals
                : { totalCash: roundDemand(totalCash), totalOnline: roundDemand(totalOnline), totalAmount: roundDemand(totalAmount) };
        }

        // Second check right before create: another request may have created the session (e.g. concurrent syncs)
        if (requireApproval && payload.recoveries?.length > 0) {
            const again = await RecoveryMaster.findOne({
                groupId: groupDoc._id,
                date: { $gte: dateStart, $lte: dateEnd },
            }).sort({ meetingSequence: -1 });
            if (again) {
                const nextMeetingDate = getNextMeetingDate(parsedDate, groupDoc);
                const enrichOne = async (rec) => {
                    const isPresent = rec.attendance === 'present' || (rec.attendance === 'absent' && rec.recoveryByOther);
                    let demandDetails = rec.demandDetails;
                    let total = rec.total;
                    if (isPresent) {
                        const hasValid = demandDetails && typeof demandDetails === 'object' && (demandDetails.loan?.totalDemand != null || demandDetails.saving?.totalDemand != null);
                        if (!hasValid) {
                            try {
                                demandDetails = await calculateDemandDetails(groupDoc._id, rec.memberId, rec, parsedDate, groupDoc, meetingSequence);
                            } catch (err) {
                                console.error('[registerRecovery] calculateDemandDetails failed for member', rec.memberId, err);
                                demandDetails = rec.demandDetails || {};
                            }
                        }
                        const sum = (rec.amounts?.saving || 0) + (rec.amounts?.loan || 0) + (rec.amounts?.fd || 0) + (rec.amounts?.interest || 0) + (rec.amounts?.yogdan || 0) + (rec.amounts?.memFeesSHG || 0) + (rec.amounts?.memFeesSamiti || 0) + (rec.amounts?.memFeesGroup || 0) + (rec.amounts?.penalty || 0) + (rec.amounts?.other || 0) + (rec.amounts?.other1 || 0) + (rec.amounts?.other2 || 0);
                        if (total == null || total === 0) total = roundDemand(sum);
                    }
                    return { ...rec, demandDetails: demandDetails || {}, total: roundDemand(total ?? 0) };
                };
                const existingRecoveries = again.recoveries || [];
                const existingByMember = new Map(existingRecoveries.map((r) => [String(r.memberId), r]));
                for (const rec of payload.recoveries) {
                    const enriched = await enrichOne(rec);
                    existingByMember.set(String(rec.memberId), enriched);
                }
                const mergedRecoveries = Array.from(existingByMember.values());
                let totalCash = 0, totalOnline = 0, totalAmount = 0;
                for (const rec of mergedRecoveries) {
                    if (rec.attendance === 'present' || (rec.attendance === 'absent' && rec.recoveryByOther)) {
                        const t = roundDemand(rec.total ?? 0);
                        totalAmount += t;
                        if (rec.paymentMode?.cash) totalCash += t;
                        if (rec.paymentMode?.online) totalOnline += t;
                    }
                }
                again.recoveries = mergedRecoveries;
                again.memberCount = mergedRecoveries.length;
                again.totals = { totalCash: roundDemand(totalCash), totalOnline: roundDemand(totalOnline), totalAmount: roundDemand(totalAmount) };
                if (payload.groupPhoto != null) again.groupPhoto = payload.groupPhoto;
                if (payload.cashDenominations) again.cashDenominations = payload.cashDenominations;
                if (nextMeetingDate) again.nextMeetingDate = nextMeetingDate;
                await again.save();
                const msg = requireApproval ? "Recovery session updated and pending admin approval" : "Recovery session updated successfully";
                return apiResponse.success(res, msg, again);
            }
        }

        let recovery;
        try {
            recovery = await RecoveryMaster.create(recoveryData);
        } catch (createErr) {
            // Duplicate key: another request created the same (groupId, date); find and update instead
            const isDupKey = createErr.code === 11000 || (createErr.message && String(createErr.message).includes('E11000'));
            if (isDupKey && requireApproval && payload.recoveries?.length > 0) {
                const existing = await RecoveryMaster.findOne({
                    groupId: groupDoc._id,
                    date: { $gte: dateStart, $lte: dateEnd },
                }).sort({ meetingSequence: -1 });
                if (existing) {
                    const nextMeetingDate = getNextMeetingDate(parsedDate, groupDoc);
                    const enrichOne = async (rec) => {
                        const isPresent = rec.attendance === 'present' || (rec.attendance === 'absent' && rec.recoveryByOther);
                        let demandDetails = rec.demandDetails;
                        let total = rec.total;
                        if (isPresent) {
                            const hasValid = demandDetails && typeof demandDetails === 'object' && (demandDetails.loan?.totalDemand != null || demandDetails.saving?.totalDemand != null);
                            if (!hasValid) {
                                try {
                                    demandDetails = await calculateDemandDetails(groupDoc._id, rec.memberId, rec, parsedDate, groupDoc, meetingSequence);
                                } catch (err) {
                                    console.error('[registerRecovery] calculateDemandDetails failed for member', rec.memberId, err);
                                    demandDetails = rec.demandDetails || {};
                                }
                            }
                            const sum = (rec.amounts?.saving || 0) + (rec.amounts?.loan || 0) + (rec.amounts?.fd || 0) + (rec.amounts?.interest || 0) + (rec.amounts?.yogdan || 0) + (rec.amounts?.memFeesSHG || 0) + (rec.amounts?.memFeesSamiti || 0) + (rec.amounts?.memFeesGroup || 0) + (rec.amounts?.penalty || 0) + (rec.amounts?.other || 0) + (rec.amounts?.other1 || 0) + (rec.amounts?.other2 || 0);
                            if (total == null || total === 0) total = roundDemand(sum);
                        }
                        return { ...rec, demandDetails: demandDetails || {}, total: roundDemand(total ?? 0) };
                    };
                    const existingRecoveries = existing.recoveries || [];
                    const existingByMember = new Map(existingRecoveries.map((r) => [String(r.memberId), r]));
                    for (const rec of payload.recoveries) {
                        const enriched = await enrichOne(rec);
                        existingByMember.set(String(rec.memberId), enriched);
                    }
                    const mergedRecoveries = Array.from(existingByMember.values());
                    let totalCash = 0, totalOnline = 0, totalAmount = 0;
                    for (const rec of mergedRecoveries) {
                        if (rec.attendance === 'present' || (rec.attendance === 'absent' && rec.recoveryByOther)) {
                            const t = roundDemand(rec.total ?? 0);
                            totalAmount += t;
                            if (rec.paymentMode?.cash) totalCash += t;
                            if (rec.paymentMode?.online) totalOnline += t;
                        }
                    }
                    existing.recoveries = mergedRecoveries;
                    existing.memberCount = mergedRecoveries.length;
                    existing.totals = { totalCash: roundDemand(totalCash), totalOnline: roundDemand(totalOnline), totalAmount: roundDemand(totalAmount) };
                    if (payload.groupPhoto != null) existing.groupPhoto = payload.groupPhoto;
                    if (payload.cashDenominations) existing.cashDenominations = payload.cashDenominations;
                    if (nextMeetingDate) existing.nextMeetingDate = nextMeetingDate;
                    await existing.save();
                    const msg = requireApproval ? "Recovery session updated and pending admin approval" : "Recovery session updated successfully";
                    return apiResponse.success(res, msg, existing);
                }
            }
            throw createErr;
        }

        // Only process transactions and updates if approved (admin panel)
        // For pending approvals (group panel), these will be processed on approval
        if (approvalStatus === 'approved') {
            await processRecoveryTransactions(recovery, groupDoc, parsedDate, req.user?.id || "admin");
        }
        // For pending recoveries, skip processing - it will be done on approval

        const message = approvalStatus === 'pending'
            ? "Recovery session created successfully and pending admin approval"
            : "Recovery session registered successfully";
        return apiResponse.success(res, message, recovery);

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

        console.log("[updateMemberRecovery] Called with:", { groupId, date: date?.slice?.(0, 10), memberId: memberRecovery?.memberId, amountsPenalty: memberRecovery?.amounts?.penalty, amountsKeys: memberRecovery?.amounts ? Object.keys(memberRecovery.amounts) : [] });

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

        // Find existing recovery session for this date and group
        let recoverySession = await RecoveryMaster.findOne({
            groupId: groupDoc._id,
            date: { $gte: dateStart, $lte: dateEnd }
        })
            .sort({ meetingSequence: -1 }); // Get the latest sequence if multiple exist

        if (recoverySession?.isFinalized) {
            return apiResponse.error(
                res,
                "This recovery session is finalized and cannot be edited.",
                400
            );
        }

        // Strict loan cap validation:
        // loan recovery for this save cannot exceed member's remaining principal.
        const requestedLoanRecovery = parseFloat(memberRecovery?.amounts?.loan || 0);
        if (requestedLoanRecovery > 0 && memberRecovery?.memberId) {
            const loans = await LoanMaster.find({
                groupId: groupDoc._id,
                memberId: memberRecovery.memberId.toString(),
                transactionType: "Loan",
                status: "approved",
            }).lean();

            const totalLoanAmount = loans.reduce((sum, loan) => {
                return sum + (parseFloat(loan.amount) || 0);
            }, 0);

            const allRecoverySessions = await RecoveryMaster.find({
                groupId: groupDoc._id,
            }).lean();

            let totalLoanRecovered = 0;
            allRecoverySessions.forEach((sessionDoc) => {
                const rec = sessionDoc.recoveries?.find(
                    (r) => r.memberId?.toString() === memberRecovery.memberId?.toString()
                );
                if (rec?.amounts) {
                    totalLoanRecovered += parseFloat(rec.amounts.loan || 0);
                }
            });

            // If updating an existing member row in today's session, exclude previous saved amount.
            if (recoverySession) {
                const existingRecoveryForMember = recoverySession.recoveries?.find(
                    (r) => r.memberId?.toString() === memberRecovery.memberId?.toString()
                );
                if (existingRecoveryForMember?.amounts) {
                    totalLoanRecovered -= parseFloat(existingRecoveryForMember.amounts.loan || 0);
                }
            }

            const remainingLoanAmount = Math.max(0, totalLoanAmount - totalLoanRecovered);
            if (requestedLoanRecovery > remainingLoanAmount) {
                return apiResponse.error(
                    res,
                    `Loan amount cannot exceed remaining loan amount of ₹${Math.round(remainingLoanAmount).toLocaleString()}`,
                    400
                );
            }
        }

        // Meeting sequence is always 1 (no same-day meetings allowed)
        const meetingSequence = 1;

        if (recoverySession) {
            const memberIndexBeforeUpdate = recoverySession.recoveries.findIndex(
                r => r.memberId === memberRecovery.memberId ||
                    r.memberId?.toString() === memberRecovery.memberId?.toString()
            );
            if (memberIndexBeforeUpdate >= 0) {
                const oldMemberRecovery = recoverySession.recoveries[memberIndexBeforeUpdate];
                await revertMemberRecoveryUpdateSideEffects(
                    oldMemberRecovery,
                    recoverySession._id,
                    groupDoc,
                    parsedDate
                );
            }

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

            const demandCapErr = validateRecoveryDemandCaps(demandDetails, memberRecovery.amounts);
            if (demandCapErr) {
                return apiResponse.error(res, demandCapErr, 400);
            }

            // Update existing session - find and update member recovery
            const memberIndex = recoverySession.recoveries.findIndex(
                r => r.memberId === memberRecovery.memberId ||
                    r.memberId?.toString() === memberRecovery.memberId?.toString()
            );

            const sumAmounts = (amt) => roundDemand(
                (amt?.saving || 0) + (amt?.loan || 0) + (amt?.fd || 0) + (amt?.interest || 0) + (amt?.yogdan || 0) +
                (amt?.memFeesSHG || 0) + (amt?.memFeesSamiti || 0) + (amt?.memFeesGroup || 0) + (amt?.penalty || 0) +
                (amt?.other || 0) + (amt?.other1 || 0) + (amt?.other2 || 0)
            );
            if (memberIndex >= 0) {
                // Update existing member recovery (total fixed integer)
                const total = sumAmounts(memberRecovery.amounts);
                recoverySession.recoveries[memberIndex] = {
                    ...recoverySession.recoveries[memberIndex],
                    ...memberRecovery,
                    demandDetails,
                    total,
                };
            } else {
                // Add new member recovery (total fixed integer)
                const total = sumAmounts(memberRecovery.amounts);
                recoverySession.recoveries.push({
                    ...memberRecovery,
                    demandDetails,
                    total,
                });
                recoverySession.memberCount = recoverySession.recoveries.length;
            }

            // Recalculate totals (fixed integers)
            let totalCash = 0;
            let totalOnline = 0;
            let totalAmount = 0;

            recoverySession.recoveries.forEach(rec => {
                if (rec.attendance === "present" || (rec.attendance === "absent" && rec.recoveryByOther)) {
                    const amounts = rec.amounts || {};
                    const memberTotal = sumAmounts(amounts);
                    rec.total = memberTotal;
                    totalAmount += memberTotal;
                    if (rec.paymentMode?.cash) totalCash += memberTotal;
                    if (rec.paymentMode?.online) totalOnline += memberTotal;
                }
            });

            recoverySession.totals = {
                totalCash: roundDemand(totalCash),
                totalOnline: roundDemand(totalOnline),
                totalAmount: roundDemand(totalAmount),
            };

            // Use total from the session entry (recalculate has set rec.total) so "add new member" path also gets correct amount for cash/bank
            const currentRecEntry = recoverySession.recoveries.find(
                r => r.memberId === memberRecovery.memberId || r.memberId?.toString() === memberRecovery.memberId?.toString()
            );
            const totalForThisMember = currentRecEntry?.total ?? memberRecovery.total ?? 0;

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

            // Handle penalty payment - update MemberRevenueDemand
            if (memberRecovery.amounts?.penalty > 0 && memberRecovery.memberId) {
                const unpaidPenaltyDemands = await MemberRevenueDemand.find({
                    memberId: memberRecovery.memberId,
                    groupId: groupDoc._id,
                    revenueType: "penalty",
                    isPaid: false,
                }).sort({ demandDate: 1 });

                let remainingPayment = parseFloat(memberRecovery.amounts.penalty) || 0;

                for (const demand of unpaidPenaltyDemands) {
                    if (remainingPayment <= 0) break;

                    const demandAmount = parseFloat(demand.amount) || 0;
                    const currentPaidAmount = parseFloat(demand.paidAmount) || 0;
                    const remainingDemand = Math.max(0, demandAmount - currentPaidAmount);

                    const paymentForThisDemand = Math.min(remainingPayment, remainingDemand);
                    const newPaidAmount = currentPaidAmount + paymentForThisDemand;

                    demand.paidAmount = newPaidAmount;
                    demand.paidDate = parsedDate;
                    demand.recoveryId = recoverySession._id;

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
                        // Use stored yogdanAmount when present (including 0); only use 1% for legacy loans
                        const hasStored = loan.yogdanAmount !== undefined && loan.yogdanAmount !== null;
                        const yogdanAmount = hasStored ? (parseFloat(loan.yogdanAmount) || 0) : Math.round((loanAmount * 0.01) * 100) / 100;

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
                const totalAmount = totalForThisMember || memberRecovery.total || 0;
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

            // Create cash transaction record if cash payment (use totalForThisMember so "add new member" path creates one per member)
            const isCashPayment = memberRecovery.paymentMode?.cash === true ||
                memberRecovery.paymentMode?.cash === "true" ||
                (typeof memberRecovery.paymentMode === 'object' && memberRecovery.paymentMode?.cash);
            const cashTotalAmount = totalForThisMember || memberRecovery.total || 0;
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

            // Backfill recoveryDate and nextMeetingDate if not set (e.g. old records)
            if (!recoverySession.recoveryDate) recoverySession.recoveryDate = parsedDate;
            if (!recoverySession.nextMeetingDate) recoverySession.nextMeetingDate = getNextMeetingDate(parsedDate, groupDoc) || undefined;

            await recoverySession.save();

            // Post/update ledger entries for this recovery session (including penalty) so Income & Expense report shows them
            // Skip cash/bank creation here - we already created one for this member above; processRecoveryTransactions would duplicate
            try {
                await processRecoveryTransactions(recoverySession, groupDoc, parsedDate, req.user?.id || "admin", { skipCashBankCreation: true });
            } catch (ledgerErr) {
                console.error("[updateMemberRecovery] Ledger posting failed:", ledgerErr);
                // Don't fail the request; recovery is saved
            }

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

            const demandCapErrNew = validateRecoveryDemandCaps(demandDetails, memberRecovery.amounts);
            if (demandCapErrNew) {
                return apiResponse.error(res, demandCapErrNew, 400);
            }

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

            const nextMeetingDate = getNextMeetingDate(parsedDate, groupDoc);
            const newRecovery = await RecoveryMaster.create({
                groupId: groupDoc._id,
                groupName: groupDoc.group_name,
                groupCode: groupDoc.group_code,
                date: parsedDate,
                recoveryDate: parsedDate,
                nextMeetingDate: nextMeetingDate || undefined,
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

            // Handle penalty payment - update MemberRevenueDemand (for new recovery session)
            if (memberRecovery.amounts?.penalty > 0 && memberRecovery.memberId) {
                const unpaidPenaltyDemands = await MemberRevenueDemand.find({
                    memberId: memberRecovery.memberId,
                    groupId: groupDoc._id,
                    revenueType: "penalty",
                    isPaid: false,
                }).sort({ demandDate: 1 });

                let remainingPayment = parseFloat(memberRecovery.amounts.penalty) || 0;

                for (const demand of unpaidPenaltyDemands) {
                    if (remainingPayment <= 0) break;

                    const demandAmount = parseFloat(demand.amount) || 0;
                    const currentPaidAmount = parseFloat(demand.paidAmount) || 0;
                    const remainingDemand = Math.max(0, demandAmount - currentPaidAmount);

                    const paymentForThisDemand = Math.min(remainingPayment, remainingDemand);
                    const newPaidAmount = currentPaidAmount + paymentForThisDemand;

                    demand.paidAmount = newPaidAmount;
                    demand.paidDate = parsedDate;
                    demand.recoveryId = newRecovery._id;

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
                        const hasStored = loan.yogdanAmount !== undefined && loan.yogdanAmount !== null;
                        const yogdanAmount = hasStored ? (parseFloat(loan.yogdanAmount) || 0) : Math.round((loanAmount * 0.01) * 100) / 100;

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

            // Post ledger entries for this new recovery session (including penalty) so Income & Expense report shows them
            // Skip cash/bank creation here - we already created one for this member above; processRecoveryTransactions would duplicate
            try {
                await processRecoveryTransactions(newRecovery, groupDoc, parsedDate, req.user?.id || "admin", { skipCashBankCreation: true });
            } catch (ledgerErr) {
                console.error("[updateMemberRecovery] Ledger posting failed (new session):", ledgerErr);
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


export const calculateDemandDetails = async (
    groupId,
    memberId,
    memberRecovery,
    currentDate,
    groupDoc,
    _legacySeq,
    excludeRecoveryId = null,
    options = {}
) => {
    const g =
        groupDoc ||
        (await GroupMaster.findById(groupId).lean());
    if (!g) throw new Error("Group not found");

    const meeting = resolveMeetingForRecovery({
        groupDoc: g,
        recoveryDate: currentDate,
    });
    const prevMeeting = getPreviousMeeting({
        groupDoc: g,
        meetingDate: meeting.meetingDate,
        meetingSequence: meeting.meetingSequence,
    });
    const previousData = await getCarryForward({
        groupId,
        memberId,
        prevMeeting,
        groupDoc: g,
    });
    const member = await Member.findById(memberId).lean();
    if (!member) throw new Error("Member not found");

    const result = await calculateDemandDetailsPure({
        groupDoc: g,
        groupId,
        memberId,
        member,
        meeting,
        prevMeeting,
        previousData,
        actualAmounts: memberRecovery?.amounts || {},
        excludeRecoveryId,
        recoveryDate: currentDate,
        options,
    });
    return result.demandDetails;
};


// API endpoint to get previous recovery data
export const getPreviousRecoveryData = async (req, res) => {
    try {
        const { groupId, memberId, date } = req.query;

        if (!groupId || !memberId) {
            return apiResponse.error(res, "groupId and memberId are required", 400);
        }

        const currentDate = date || new Date();
        const groupDoc = await GroupMaster.findById(groupId).lean();
        if (!groupDoc) {
            return apiResponse.error(res, "Group not found", 404);
        }
        const meeting = resolveMeetingForRecovery({
            groupDoc,
            recoveryDate: currentDate,
        });
        const prevMeeting = getPreviousMeeting({
            groupDoc,
            meetingDate: meeting.meetingDate,
            meetingSequence: meeting.meetingSequence,
        });
        const previousData = await getCarryForward({
            groupId,
            memberId,
            prevMeeting,
            groupDoc,
        });

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

        const adminPlace = req.user?.place || req.admin?.place;
        const accessCheck = await verifyGroupAccess(groupId, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
        }
        const groupDoc = accessCheck.group;

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

        const meetingSequence = 1;
        const emptyMemberRecovery = { amounts: {} };

        const demandDetails = await calculateDemandDetails(
            groupDoc._id,
            memberId,
            emptyMemberRecovery,
            parsedDate,
            groupDoc,
            meetingSequence,
            null,
            { includeInterestDayDebug: true }
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

        if (recovery.isFinalized === true) {
            if (req.body.cashDenominations) {
                return apiResponse.error(
                    res,
                    "Cash denominations cannot be changed on an immutable finalized ledger session.",
                    400
                );
            }
            await recovery.save();
        } else {
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
        }

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
                            await upsertAnnualMembershipDemand({
                                memberId: member._id,
                                groupId,
                                year: financialYear,
                                revenueType: "membership_fees_shg",
                                amount: membershipFees,
                                demandDate: parsedDate,
                                notes: `Annual demand (April)`,
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
                            await upsertAnnualMembershipDemand({
                                memberId: member._id,
                                groupId,
                                year: financialYear,
                                revenueType: "membership_fees_shg",
                                amount: membershipFees,
                                demandDate: parsedDate,
                                notes: `Annual demand (April)`,
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
                            await upsertRegistrationMembershipDemand({
                                memberId: member._id,
                                groupId,
                                revenueType: "membership_fees_shg",
                                amount: membershipFees,
                                year: financialYear,
                                demandDate: new Date(joinDate),
                                notes: `New member registration demand (joined outside April)`,
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
                            await upsertAnnualMembershipDemand({
                                memberId: member._id,
                                groupId,
                                year: financialYear,
                                revenueType: "membership_fees_group",
                                amount: membershipGroup,
                                demandDate: parsedDate,
                                notes: `Annual demand (April)`,
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
                            await upsertAnnualMembershipDemand({
                                memberId: member._id,
                                groupId,
                                year: financialYear,
                                revenueType: "membership_fees_group",
                                amount: membershipGroup,
                                demandDate: parsedDate,
                                notes: `Annual demand (April)`,
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
                            await upsertRegistrationMembershipDemand({
                                memberId: member._id,
                                groupId,
                                revenueType: "membership_fees_group",
                                amount: membershipGroup,
                                year: financialYear,
                                demandDate: new Date(joinDate),
                                notes: `New member registration demand (joined outside April)`,
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

// Add penalty demand for a member (decide penalty for member; can be recovered in Demand Recovery)
export const addPenaltyDemand = async (req, res) => {
    try {
        const { groupId, memberId, amount, notes } = req.body || {};

        if (!groupId || !memberId) {
            return apiResponse.error(res, "groupId and memberId are required", 400);
        }

        const penaltyAmount = parseFloat(amount);
        if (isNaN(penaltyAmount) || penaltyAmount <= 0) {
            return apiResponse.error(res, "Valid penalty amount (greater than 0) is required", 400);
        }

        const adminPlace = req.user?.place || req.admin?.place;
        const accessCheck = await verifyGroupAccess(groupId, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
        }

        const member = await Member.findOne({ _id: memberId, group: groupId }).lean();
        if (!member) {
            return apiResponse.error(res, "Member not found", 404);
        }

        const groupDoc = await GroupMaster.findById(groupId).lean();
        if (!groupDoc) {
            return apiResponse.error(res, "Group not found", 404);
        }

        const now = new Date();
        const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; // April = start of FY
        const financialYear = `${currentYear}-${String(currentYear + 1).slice(-2)}`;

        const demand = await createPenaltyDemandRecord({
            memberId: member._id,
            groupId,
            amount: penaltyAmount,
            demandDate: now,
            notes: notes || "Penalty (added from Demand Recovery)",
        });

        return apiResponse.success(res, "Penalty demand added successfully", {
            _id: demand._id,
            memberId: demand.memberId,
            groupId: demand.groupId,
            revenueType: demand.revenueType,
            amount: demand.amount,
            demandDate: demand.demandDate,
            year: demand.year,
            notes: demand.notes,
        });
    } catch (error) {
        console.error("Error adding penalty demand:", error);
        return apiResponse.error(res, error.message || "Failed to add penalty demand", 500);
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
        // This is the FULL remaining loan amount (totalLoanAmount - totalLoanRecovered), NOT just the installment
        // Round to ensure whole number (no decimals) for consistency with frontend display
        const remainingLoanAmount = Math.round(Math.max(0, totalLoanAmount - totalLoanRecovered));

        // Get opening amounts from member model
        const openingYogdan = parseFloat(member.openingYogdan || 0);
        const openingOverdueInterest = parseFloat(member.loanDetails?.overdueInterest || 0);

        // Calculate remaining amounts = opening - recovered
        const remainingYogdanAmount = Math.max(0, openingYogdan - totalYogdanRecovered);
        const remainingOverdueInterestAmount = Math.max(0, openingOverdueInterest - totalOverdueInterestRecovered);

        // Map individual loan details for frontend display
        const loanDetails = loans.map(loan => ({
            id: loan._id,
            amount: parseFloat(loan.amount) || 0,
            date: loan.date,
            installment_amount: parseFloat(loan.installment_amount) || null,
            time_period: loan.time_period || null,
            purpose: loan.purpose || null,
            loan_rate: parseFloat(loan.loan_rate_snapshot) || null,
            yogdanAmount: parseFloat(loan.yogdanAmount) || 0,
            memberCode: loan.memberCode,
            memberName: loan.memberName
        }));

        return apiResponse.success(res, "Member remaining amounts fetched successfully", {
            // Loan data
            totalLoanAmount,
            totalLoanRecovered,
            remainingLoanAmount,
            loans: loanDetails, // Individual loan breakdown
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


// Approve Recovery (from group panel)
export const approveRecovery = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return apiResponse.error(res, "Recovery ID is required", 400);
        }

        const recovery = await RecoveryMaster.findById(id);
        if (!recovery) {
            return apiResponse.error(res, "Recovery not found", 404);
        }

        if (recovery.approvalStatus !== "pending") {
            return apiResponse.error(res, `Recovery is already ${recovery.approvalStatus}`, 400);
        }

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Verify recovery's group belongs to admin's place
        const accessCheck = await verifyGroupAccess(recovery.groupId, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "You don't have access to this recovery's group", 403);
        }
        const groupDoc = accessCheck.group;

        const journalSession = await mongoose.startSession();
        try {
            await journalSession.withTransaction(async () => {
                recovery.approvalStatus = "approved";
                recovery.approvedBy = req.user?.id || "admin";
                recovery.approvedAt = new Date();

                const { entryId } = await postJournal({
                    groupId: recovery.groupId,
                    date: recovery.date,
                    sourceType: "RECOVERY",
                    sourceId: recovery._id,
                    lines: getRecoveryLines({
                        recovery,
                        notes: `Recovery approval for group ${recovery.groupCode || ""}`.trim(),
                    }),
                    createdBy: req.user?.id || "admin",
                    session: journalSession,
                });
                recovery.journalEntryId = entryId;
                await recovery.save({ session: journalSession });
            });
        } finally {
            await journalSession.endSession();
        }

        // Process all transactions (bank, cash, ledger entries, etc.)
        const parsedDate = recovery.date;
        await processRecoveryTransactions(recovery, groupDoc, parsedDate, req.user?.id || "admin");

        return apiResponse.success(res, "Recovery approved successfully", recovery);
    } catch (error) {
        return apiResponse.error(res, error.message || "Failed to approve recovery", 500);
    }
};

// Reject Recovery (from group panel)
export const rejectRecovery = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!id) {
            return apiResponse.error(res, "Recovery ID is required", 400);
        }

        const recovery = await RecoveryMaster.findById(id);
        if (!recovery) {
            return apiResponse.error(res, "Recovery not found", 404);
        }

        if (recovery.approvalStatus !== "pending") {
            return apiResponse.error(res, `Recovery is already ${recovery.approvalStatus}`, 400);
        }

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Verify recovery's group belongs to admin's place
        const accessCheck = await verifyGroupAccess(recovery.groupId, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "You don't have access to this recovery's group", 403);
        }

        recovery.approvalStatus = "rejected";
        recovery.rejectedBy = req.user?.id || "admin";
        recovery.rejectedAt = new Date();
        recovery.rejectionReason = reason || "No reason provided";
        await recovery.save();

        return apiResponse.success(res, "Recovery rejected successfully", recovery);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};


