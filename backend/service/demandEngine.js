/**
 * PURE DEMAND ENGINE (read-only): no RecoveryMaster writes, no MemberRevenueDemand creates,
 * no RecoveryMaster updates.
 * Output contract: demandDetails, meetingKey, demandStatus, isMissingDemand, gapDays, loanSnapshots,
 * plus non-enumerable __caps for recoveryWriter cap checks only.
 *
 * Interest: meeting-to-meeting accrual inside interestEngine (`getPreviousMeeting` boundary + disbursement
 * floor). `prevMeeting` argument is ignored for day count — avoids multi-month accrual when prev is null.
 */

import mongoose from "mongoose";
import LoanMaster from "../model/LoanMaster.js";
import FDMaster from "../model/FDMaster.js";
import MemberRevenueDemand from "../model/MemberRevenueDemand.js";
import LoanAdjustmentLog from "../model/LoanAdjustmentLog.js";
import { computeInterestForMeeting } from "./interestEngine.js";
import { getLastRecoveredMeetingBefore } from "./meetingLedgerResolver.js";
import { getCumulativePaymentsBeforeMeeting } from "./recoveryPaymentTotals.js";
import {
    meetingKeyString,
    normalizeDateOnly,
} from "./meetingResolver.js";
import {
    calculateYogdanDemand,
    calculateChargesDue,
    getMembershipFeesDemandReadOnly,
} from "./recoveryDemandHelpers.js";

export const DEMAND_SNAPSHOT_VERSION = 1;

const roundDemand = (n) =>
    typeof n === "number" && !Number.isNaN(n)
        ? Math.round(n)
        : Math.round(parseFloat(n) || 0);

function toYmd(d) {
    if (d == null || d === "") return null;
    try {
        const x = normalizeDateOnly(d instanceof Date ? d : new Date(d));
        if (!x || Number.isNaN(x.getTime())) return null;
        const y = x.getFullYear();
        const m = String(x.getMonth() + 1).padStart(2, "0");
        const day = String(x.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    } catch {
        return null;
    }
}

/**
 * @param {object} params
 * @param {object} params.groupDoc
 * @param {any} params.groupId
 * @param {any} params.memberId
 * @param {object} params.member - lean Member doc
 * @param {object} params.meeting - resolveMeetingForRecovery output
 * @param {object|null} params.prevMeeting
 * @param {object} params.previousData - carry-forward snapshot (getCarryForward output shape)
 * @param {object} params.actualAmounts - amounts paid this session
 * @param {string|null} params.excludeRecoveryId
 * @param {Date|string} params.recoveryDate - calendar date of recovery action (for charges/membership context)
 * @param {object} [params.options]
 */
export async function calculateDemandDetailsPure({
    groupDoc,
    groupId,
    memberId,
    member,
    meeting,
    prevMeeting,
    previousData,
    actualAmounts = {},
    excludeRecoveryId = null,
    recoveryDate,
    options = {},
}) {
    const gid =
        typeof groupId === "string"
            ? new mongoose.Types.ObjectId(groupId)
            : groupId;

    let parsedRecovery =
        recoveryDate instanceof Date ? recoveryDate : new Date(recoveryDate);
    if (typeof recoveryDate === "string" && recoveryDate.includes("/")) {
        const parts = recoveryDate.split("/");
        if (parts.length === 3) {
            parsedRecovery = new Date(
                parseInt(parts[2], 10),
                parseInt(parts[1], 10) - 1,
                parseInt(parts[0], 10)
            );
        }
    }
    parsedRecovery = normalizeDateOnly(parsedRecovery);

    const amounts = actualAmounts || {};
    const actualLoan = Math.max(0, parseFloat(amounts.loan) || 0);
    const actualInterest = Math.max(0, parseFloat(amounts.interest) || 0);
    const actualSaving = Math.max(0, parseFloat(amounts.saving) || 0);
    const actualFd = Math.max(0, parseFloat(amounts.fd) || 0);
    const actualYogdan = Math.max(0, parseFloat(amounts.yogdan) || 0);
    const actualMemFeesSHG = Math.max(0, parseFloat(amounts.memFeesSHG) || 0);
    const actualMemFeesGroup = Math.max(0, parseFloat(amounts.memFeesGroup) || 0);
    const actualPenalty = Math.max(0, parseFloat(amounts.penalty) || 0);
    const actualCharges = amounts.charges || {};
    const actualChargesTotal = Object.values(actualCharges).reduce(
        (sum, amount) => sum + Math.max(0, parseFloat(amount) || 0),
        0
    );

    const meetingDate = normalizeDateOnly(meeting?.meetingDate);
    const meetingSequence = meeting?.meetingSequence || 1;
    const gapDays = meeting?.gapDays ?? 0;
    const demandStatus = meeting?.demandStatus || "NORMAL_DEMAND";
    const isMissingDemand = demandStatus === "MISSING_DEMAND";

    const carryMode = previousData?.carryForwardMode;
    const rb = previousData?.revenueObligations;
    const fb = previousData?.financialBalances;

    const mk = meetingKeyString(gid, meetingDate, meetingSequence);

    const allActiveLoans = await LoanMaster.find({
        groupId: gid,
        memberId: memberId.toString(),
        transactionType: "Loan",
        status: "approved",
    })
        .select("date createdAt amount time_period installment_amount loan_rate_snapshot yogdanAmount")
        .sort({ date: 1 })
        .lean();

    const memberLoanPaid = member?.loanDetails?.loanPaid || 0;
    const isExistingMember = member?.isExistingMember || false;

    let totalLoanAmount = 0;
    if (allActiveLoans.length > 0) {
        const principal = allActiveLoans.reduce((s, l) => s + (l.amount || 0), 0);
        totalLoanAmount =
            isExistingMember && memberLoanPaid > 0
                ? principal + memberLoanPaid
                : principal;
    } else {
        totalLoanAmount = member?.loanDetails?.amount || 0;
    }

    const loanPaidBefore =
        carryMode === "BALANCE" && fb?.loan != null
            ? fb.loan
            : await getCumulativePaymentsBeforeMeeting(
                  gid,
                  memberId,
                  meetingDate,
                  meetingSequence,
                  "loan",
                  excludeRecoveryId
              );

    const totalLoanPaid = memberLoanPaid + loanPaidBefore;
    const remainingLoan = Math.max(0, totalLoanAmount - totalLoanPaid);

    let loanCurrDemand = 0;
    const loanPrevDemand = previousData?.loan?.unpaidDemand || 0;

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
            groupDoc?.meeting_date_1_day && groupDoc?.meeting_date_2_day;
        loanCurrDemand = hasTwoMeetings
            ? monthlyInstallment / 2
            : monthlyInstallment;
    }

    const loanTotalDemand = loanPrevDemand + loanCurrDemand;
    const loanUnpaidDemand = Math.min(
        remainingLoan,
        Math.max(0, loanTotalDemand - actualLoan)
    );

    const principalForLoanAtMeeting = (loan) => {
        let loansBeforeThis = 0;
        for (const l of allActiveLoans) {
            if (l._id.toString() === loan._id.toString()) break;
            loansBeforeThis += l.amount || 0;
        }
        const loanAmount = loan.amount || 0;
        const paidForPreviousLoans = Math.min(totalLoanPaid, loansBeforeThis);
        const paidForThisLoan = Math.max(
            0,
            Math.min(totalLoanPaid - paidForPreviousLoans, loanAmount)
        );
        return Math.max(0, loanAmount - paidForThisLoan);
    };

    const ledgerPrev = await getLastRecoveredMeetingBefore(
        gid,
        meetingDate,
        meetingSequence,
        excludeRecoveryId
    );
    const ledgerPreviousMeetingDate = ledgerPrev?.meetingDate ?? null;

    const {
        perLoan: loanSnapshots,
        totalInterest: periodInterest,
        debugRows: interestDebugRows,
    } = computeInterestForMeeting({
        groupDoc,
        loans: allActiveLoans,
        meeting: {
            meetingDate,
            meetingSequence,
            gapDays,
            demandStatus,
        },
        ledgerPreviousMeetingDate,
        principalForLoanAtMeeting,
        includeDebug: !!options.includeInterestDayDebug,
    });

    const interestPrevDemand = previousData?.interest?.unpaidDemand || 0;

    const overdueInterest = member?.loanDetails?.overdueInterest || 0;
    const interestPaidBefore = await getCumulativePaymentsBeforeMeeting(
        gid,
        memberId,
        meetingDate,
        meetingSequence,
        "interest",
        excludeRecoveryId
    );
    let remainingOverdueInterest = Math.max(
        0,
        overdueInterest - interestPaidBefore
    );

    /**
     * Double-count guard (SNAPSHOT carry-forward):
     * `interestPrevDemand` is last meeting's unpaid interest (already inclusive of overdue that was in demand).
     * `loanDetails.overdueInterest` is a parallel opening balance that is NOT reduced when snapshots are carried
     * (see historical recoverySideEffects gap). When prev unpaid fully covers stale overdue, omit overdue from curr.
     */
    if (
        carryMode === "SNAPSHOT" &&
        remainingOverdueInterest > 0 &&
        roundDemand(interestPrevDemand) >= roundDemand(remainingOverdueInterest)
    ) {
        remainingOverdueInterest = 0;
    }

    let interestCurrDemand = periodInterest + remainingOverdueInterest;
    if (remainingLoan <= 0) {
        interestCurrDemand = remainingOverdueInterest;
    }

    const interestTotalDemand = interestPrevDemand + interestCurrDemand;
    const interestUnpaidDemand = Math.max(
        0,
        interestTotalDemand - actualInterest
    );

    const savingPerMember =
        member.isExistingMember && member.saving_per_member_snapshot
            ? member.saving_per_member_snapshot
            : groupDoc?.saving_per_member || 0;

    const openingSaving = member?.openingSaving || 0;
    const savingPaidBefore =
        carryMode === "BALANCE" && fb?.saving != null
            ? fb.saving
            : await getCumulativePaymentsBeforeMeeting(
                  gid,
                  memberId,
                  meetingDate,
                  meetingSequence,
                  "saving",
                  excludeRecoveryId
              );
    const totalSavingPaid = openingSaving + savingPaidBefore;

    const savingPrevDemand = previousData?.saving?.unpaidDemand || 0;
    const savingCurrDemand = savingPerMember;
    const savingTotalDemand = savingPrevDemand + savingCurrDemand;
    const savingUnpaidDemand = Math.max(
        0,
        savingTotalDemand - actualSaving
    );

    const allActiveFDs = await FDMaster.find({
        groupId: gid,
        memberId: memberId.toString(),
        status: { $in: ["active", "matured"] },
    })
        .sort({ date: 1 })
        .lean();

    const memberFdAmount = member?.fdDetails?.amount || 0;
    let totalFdAmount = 0;
    if (allActiveFDs.length > 0) {
        const fdPrincipal = allActiveFDs.reduce(
            (sum, fd) => sum + Math.max(0, parseFloat(fd.amount) || 0),
            0
        );
        totalFdAmount =
            isExistingMember && memberFdAmount > 0
                ? fdPrincipal + memberFdAmount
                : fdPrincipal;
    } else {
        totalFdAmount = Math.max(0, parseFloat(memberFdAmount) || 0);
    }

    const fdPaidBefore = await getCumulativePaymentsBeforeMeeting(
        gid,
        memberId,
        meetingDate,
        meetingSequence,
        "fd",
        excludeRecoveryId
    );
    const openingFdFromMember = isExistingMember
        ? Math.max(0, parseFloat(memberFdAmount) || 0)
        : 0;
    const fdFromFDMaster =
        allActiveFDs.length > 0
            ? allActiveFDs.reduce(
                  (sum, fd) => sum + Math.max(0, parseFloat(fd.amount) || 0),
                  0
              )
            : 0;

    const totalFdPaid =
        openingFdFromMember + fdFromFDMaster + fdPaidBefore;

    const yogdanDemandData = await calculateYogdanDemand(
        gid,
        memberId,
        parsedRecovery
    );
    const yogdanTotalDemandNew = yogdanDemandData.totalDemand || 0;
    const yogdanPaidBefore = await getCumulativePaymentsBeforeMeeting(
        gid,
        memberId,
        meetingDate,
        meetingSequence,
        "yogdan",
        excludeRecoveryId
    );
    const yogdanPrevUnpaid =
        carryMode === "BALANCE" && rb?.yogdan != null
            ? rb.yogdan
            : previousData?.yogdan?.unpaidDemand || 0;
    const yogdanTotalDemandWithPrev =
        yogdanPrevUnpaid + yogdanTotalDemandNew;
    const yogdanUnpaidDemand = Math.max(
        0,
        yogdanTotalDemandWithPrev - actualYogdan
    );

    const membershipFeesData = await getMembershipFeesDemandReadOnly(
        member,
        groupDoc,
        parsedRecovery,
        gid
    );
    const shgOutstanding = membershipFeesData.memFeesSHG || 0;
    const grpOutstanding = membershipFeesData.memFeesGroup || 0;

    const memFeesSHGPrevUnpaid =
        carryMode === "BALANCE" && rb?.membershipFeesShg != null
            ? rb.membershipFeesShg
            : previousData?.memFeesSHG?.unpaidDemand || 0;
    const memFeesGroupPrevUnpaid =
        carryMode === "BALANCE" && rb?.membershipFeesGroup != null
            ? rb.membershipFeesGroup
            : previousData?.memFeesGroup?.unpaidDemand || 0;

    const memFeesSHGCurrDemand = Math.max(
        0,
        shgOutstanding - memFeesSHGPrevUnpaid
    );
    const memFeesGroupCurrDemand = Math.max(
        0,
        grpOutstanding - memFeesGroupPrevUnpaid
    );

    const memFeesSHGTotalDemand =
        memFeesSHGPrevUnpaid + memFeesSHGCurrDemand;
    const memFeesGroupTotalDemand =
        memFeesGroupPrevUnpaid + memFeesGroupCurrDemand;

    const memFeesSHGUnpaidDemand = Math.max(
        0,
        memFeesSHGTotalDemand - actualMemFeesSHG
    );
    const memFeesGroupUnpaidDemand = Math.max(
        0,
        memFeesGroupTotalDemand - actualMemFeesGroup
    );

    const unpaidPenaltyDemands = await MemberRevenueDemand.find({
        memberId: member._id,
        groupId: gid,
        revenueType: "penalty",
        $or: [{ isPaid: false }, { $expr: { $lt: ["$paidAmount", "$amount"] } }],
    }).lean();

    let penaltyTotalDemand = 0;
    let penaltyTotalPaid = 0;
    unpaidPenaltyDemands.forEach((d) => {
        penaltyTotalDemand += parseFloat(d.amount) || 0;
        penaltyTotalPaid += parseFloat(d.paidAmount) || 0;
    });
    const penaltyUnpaidBeforeThis = Math.max(
        0,
        penaltyTotalDemand - penaltyTotalPaid
    );
    const penaltyUnpaidDemand = Math.max(
        0,
        penaltyUnpaidBeforeThis - actualPenalty
    );

    const chargesDueData = await calculateChargesDue(
        member,
        groupDoc,
        parsedRecovery,
        gid
    );
    const chargesTotalDemand = Object.values(chargesDueData).reduce(
        (sum, amount) => sum + Math.max(0, parseFloat(amount) || 0),
        0
    );

    const chargesPrevUnpaid = previousData?.charges?.unpaidDemand || {};
    const chargesPrevUnpaidTotal = Object.values(chargesPrevUnpaid).reduce(
        (sum, amount) => sum + Math.max(0, parseFloat(amount) || 0),
        0
    );

    const chargesUnpaidDemand = {};
    let chargesUnpaidTotal = 0;
    const allChargeNames = new Set([
        ...Object.keys(chargesPrevUnpaid || {}),
        ...Object.keys(chargesDueData || {}),
    ]);

    for (const chargeName of allChargeNames) {
        const prevUnpaid = Math.max(
            0,
            parseFloat(chargesPrevUnpaid[chargeName]) || 0
        );
        const currDue = Math.max(
            0,
            parseFloat(chargesDueData[chargeName]) || 0
        );
        const actualPaidCharge = Math.max(
            0,
            parseFloat(actualCharges[chargeName]) || 0
        );
        const totalDemandCharge = prevUnpaid + currDue;
        const unpaid = Math.max(0, totalDemandCharge - actualPaidCharge);
        if (unpaid > 0) {
            chargesUnpaidDemand[chargeName] = unpaid;
            chargesUnpaidTotal += unpaid;
        }
    }

    const interestSchedule = {
        meetingDateYmd: toYmd(meetingDate),
        meetingSequence,
        formula:
            "Each row is THIS meeting’s slice only. Accrual start = the latest prior RECOVERED RecoveryMaster meeting date for the group (skipped/missing meetings are not used as anchors); if none exists yet, the window uses this loan’s disbursement date only. Per loan: max(ledger anchor, disbursement) through this meeting date — principal × annual rate × days ÷ (100 × 365). Overdue on the member is separate below.",
        summary: {
            interestPrevDemand: roundDemand(interestPrevDemand),
            overdueStoredOnMember: roundDemand(overdueInterest),
            interestPaidBeforeThisMeeting: roundDemand(interestPaidBefore),
            remainingOverdueInCurr: roundDemand(remainingOverdueInterest),
            meetingPeriodInterest: roundDemand(periodInterest),
            interestCurrDemand: roundDemand(interestCurrDemand),
            interestTotalDemand: roundDemand(interestTotalDemand),
        },
        meetingAccrualByLoan: (loanSnapshots || [])
            .filter((row) => {
                const pr = Number(row.principalSnapshot) || 0;
                if (pr <= 0) return false;
                const d = row.daysCounted ?? 0;
                const int = Number(row.interestComputed) || 0;
                return d > 0 || roundDemand(int) !== 0;
            })
            .map((row, idx) => ({
                rowIndex: idx + 1,
                loanId: row.loanId != null ? String(row.loanId) : "",
                loanDateYmd: row.loanDisburseDateYmd || null,
                purpose: row.loanPurpose ? String(row.loanPurpose).slice(0, 160) : "",
                accrualFromYmd: toYmd(row.loanStartCutoff),
                accrualToYmd: toYmd(row.loanEndCutoff),
                startDateYmd: toYmd(row.loanStartCutoff),
                endDateYmd: toYmd(row.loanEndCutoff),
                days: row.daysCounted ?? 0,
                principal: roundDemand(row.principalSnapshot),
                ratePercent:
                    typeof row.interestRateSnapshot === "number" &&
                    !Number.isNaN(row.interestRateSnapshot)
                        ? row.interestRateSnapshot
                        : parseFloat(row.interestRateSnapshot) || 0,
                interest: roundDemand(row.interestComputed),
            })),
    };

    const memberIdStr = memberId?.toString?.() || String(memberId);
    const adjustmentLogs = await LoanAdjustmentLog.find({
        groupId: gid,
        memberId: memberIdStr,
    }).lean();
    let memberCredit = 0;
    let deficitAmount = 0;
    for (const log of adjustmentLogs) {
        memberCredit += Math.max(0, parseFloat(log.memberCredit) || 0);
        deficitAmount += Math.max(0, parseFloat(log.deficitAmount) || 0);
    }

    const demandDetails = {
        loan: {
            prevDemand: roundDemand(loanPrevDemand),
            currDemand: roundDemand(loanCurrDemand),
            totalDemand: roundDemand(loanTotalDemand),
            actualPaid: roundDemand(actualLoan),
            unpaidDemand: roundDemand(loanUnpaidDemand),
            openingBalance: roundDemand(totalLoanPaid),
            closingBalance: roundDemand(totalLoanPaid + actualLoan),
        },
        interest: {
            prevDemand: roundDemand(interestPrevDemand),
            currDemand: roundDemand(interestCurrDemand),
            totalDemand: roundDemand(interestTotalDemand),
            actualPaid: roundDemand(actualInterest),
            unpaidDemand: roundDemand(interestUnpaidDemand),
            openingBalance: roundDemand(interestPaidBefore),
            closingBalance: roundDemand(interestPaidBefore + actualInterest),
            missingPeriods: [],
        },
        interestSchedule,
        saving: {
            prevDemand: roundDemand(savingPrevDemand),
            currDemand: roundDemand(savingCurrDemand),
            totalDemand: roundDemand(savingTotalDemand),
            actualPaid: roundDemand(actualSaving),
            unpaidDemand: roundDemand(savingUnpaidDemand),
            openingBalance: roundDemand(totalSavingPaid),
            closingBalance: roundDemand(totalSavingPaid + actualSaving),
        },
        fd: {
            prevDemand: 0,
            currDemand: 0,
            totalDemand: 0,
            unpaidDemand: 0,
            actualPaid: roundDemand(actualFd),
            openingBalance: roundDemand(totalFdPaid),
            closingBalance: roundDemand(totalFdPaid + actualFd),
        },
        yogdan: {
            prevDemand: roundDemand(yogdanPrevUnpaid),
            currDemand: roundDemand(yogdanTotalDemandNew),
            totalDemand: roundDemand(yogdanTotalDemandWithPrev),
            actualPaid: roundDemand(actualYogdan),
            unpaidDemand: roundDemand(yogdanUnpaidDemand),
            openingBalance: roundDemand(yogdanPaidBefore),
            closingBalance: roundDemand(yogdanPaidBefore + actualYogdan),
        },
        memFeesSHG: {
            prevDemand: roundDemand(memFeesSHGPrevUnpaid),
            currDemand: roundDemand(memFeesSHGCurrDemand),
            totalDemand: roundDemand(memFeesSHGTotalDemand),
            actualPaid: roundDemand(actualMemFeesSHG),
            unpaidDemand: roundDemand(memFeesSHGUnpaidDemand),
        },
        memFeesGroup: {
            prevDemand: roundDemand(memFeesGroupPrevUnpaid),
            currDemand: roundDemand(memFeesGroupCurrDemand),
            totalDemand: roundDemand(memFeesGroupTotalDemand),
            actualPaid: roundDemand(actualMemFeesGroup),
            unpaidDemand: roundDemand(memFeesGroupUnpaidDemand),
        },
        charges: {
            chargesDue: Object.fromEntries(
                Object.entries(chargesDueData || {}).map(([k, v]) => [
                    k,
                    roundDemand(v),
                ])
            ),
            chargesTotalDemand: roundDemand(chargesTotalDemand),
            chargesPrevUnpaid: Object.fromEntries(
                Object.entries(chargesPrevUnpaid || {}).map(([k, v]) => [
                    k,
                    roundDemand(v),
                ])
            ),
            chargesPrevUnpaidTotal: roundDemand(chargesPrevUnpaidTotal),
            actualPaid: Object.fromEntries(
                Object.entries(actualCharges || {}).map(([k, v]) => [
                    k,
                    roundDemand(v),
                ])
            ),
            actualPaidTotal: roundDemand(actualChargesTotal),
            unpaidDemand: Object.fromEntries(
                Object.entries(chargesUnpaidDemand || {}).map(([k, v]) => [
                    k,
                    roundDemand(v),
                ])
            ),
            unpaidDemandTotal: roundDemand(chargesUnpaidTotal),
        },
        penalty: {
            prevDemand: 0,
            currDemand: roundDemand(penaltyTotalDemand),
            totalDemand: roundDemand(penaltyTotalDemand),
            actualPaid: roundDemand(actualPenalty),
            unpaidDemand: roundDemand(penaltyUnpaidDemand),
        },
        loanAdjustment: {
            memberCredit: roundDemand(memberCredit),
            deficitAmount: roundDemand(deficitAmount),
        },
        totalUnpaidBeforeAdjustment: roundDemand(
            loanUnpaidDemand +
                interestUnpaidDemand +
                savingUnpaidDemand +
                yogdanUnpaidDemand +
                memFeesSHGUnpaidDemand +
                memFeesGroupUnpaidDemand +
                chargesUnpaidTotal +
                penaltyUnpaidDemand
        ),
    };

    if (isMissingDemand) {
        demandDetails.missingDemand = {
            loan: { ...demandDetails.loan },
            interest: { ...demandDetails.interest },
            saving: { ...demandDetails.saving },
            yogdan: { ...demandDetails.yogdan },
        };
    }

    const totalBase = demandDetails.totalUnpaidBeforeAdjustment || 0;
    demandDetails.effectiveTotalUnpaidAfterAdjustment = roundDemand(
        Math.max(0, totalBase - memberCredit) + deficitAmount
    );

    if (interestDebugRows && interestDebugRows.length > 0) {
        demandDetails._debugInterestDays = interestDebugRows;
    }

    const publicResult = {
        demandDetails,
        meetingKey: mk,
        demandStatus,
        isMissingDemand,
        gapDays,
        loanSnapshots,
    };
    Object.defineProperty(publicResult, "__caps", {
        value: {
            remainingLoanPrincipal: remainingLoan,
            demandSnapshotVersion: DEMAND_SNAPSHOT_VERSION,
        },
        enumerable: false,
    });
    return publicResult;
}

/** Non-enumerable caps for recoveryWriter (not part of public demand output). */
export function getWriterDemandCaps(engine) {
    return engine?.__caps || {
        remainingLoanPrincipal: 0,
        demandSnapshotVersion: DEMAND_SNAPSHOT_VERSION,
    };
}
