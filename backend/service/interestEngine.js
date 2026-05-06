/**
 * MEETING-BOUND LOAN INTEREST ONLY (ledger spine).
 * — Principal: snapshot from principalForLoanAtMeeting.
 * — Rate: loan.loan_rate_snapshot ?? groupDoc.loan_rate.
 * — Accrual START: ledger-based — previous RECOVERED meeting date on RecoveryMaster (not calendar template jumps).
 *   If none exists → first meeting slice → floor is loan disbursement only.
 *   When a ledger anchor exists, per-loan start = max(anchor, disbursement) so interest never runs before money out.
 * — END: current meeting.meetingDate.
 * — Formula (ACT/365 simple): principal * rate * days / (100 * 365).
 */

import { normalizeDateOnly } from "./meetingResolver.js";

/** Fixed 365-day year for simple interest accrual (not leap-year-adjusted end year). */
const YEAR_DAYS = 365;

function dateToYmdOrNull(d) {
    const x = d ? normalizeDateOnly(d instanceof Date ? d : new Date(d)) : null;
    if (!x || Number.isNaN(x.getTime())) return null;
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, "0");
    const day = String(x.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

export function calculateInterestForPeriod(principal, rate, startDate, endDate, debugCollector = null) {
    if (!principal || !rate || !startDate || !endDate) return 0;

    const start = normalizeDateOnly(startDate);
    const end = normalizeDateOnly(endDate);
    if (!start || !end || end.getTime() <= start.getTime()) return 0;

    const days = Math.floor((end.getTime() - start.getTime()) / 86400000);
    const interest = (principal * rate * days) / (100 * YEAR_DAYS);

    if (Array.isArray(debugCollector)) {
        const toDateOnly = (d) => {
            const x = normalizeDateOnly(d);
            const y = x.getFullYear();
            const m = String(x.getMonth() + 1).padStart(2, "0");
            const day = String(x.getDate()).padStart(2, "0");
            return `${y}-${m}-${day}`;
        };
        debugCollector.push({
            startDate: toDateOnly(start),
            endDate: toDateOnly(end),
            days,
            daysInYear: YEAR_DAYS,
            principal,
            rate,
            interest: Math.max(0, interest),
        });
    }

    return Math.max(0, interest);
}

/**
 * @param {object} params
 * @param {object} params.groupDoc
 * @param {object[]} params.loans - LoanMaster lean docs ordered by date
 * @param {object} params.meeting - { meetingDate, meetingSequence, demandStatus? }
 * @param {Date|string|null} params.ledgerPreviousMeetingDate - Last RecoveryMaster RECOVERED meeting strictly before current; null = no ledger history (use disbursement-only floor).
 * @param {function} params.principalForLoanAtMeeting - (loan) => number remaining principal
 */
export function computeInterestForMeeting({
    groupDoc,
    loans,
    meeting,
    ledgerPreviousMeetingDate = null,
    principalForLoanAtMeeting,
    includeDebug = false,
}) {
    const groupRate = groupDoc?.loan_rate || 0;
    const perLoan = [];
    let totalInterest = 0;

    const periodEnd = normalizeDateOnly(meeting?.meetingDate);
    if (!periodEnd) {
        return { perLoan, totalInterest: 0, debugRows: includeDebug ? [] : null };
    }

    const ledgerAnchorNormalized = ledgerPreviousMeetingDate
        ? normalizeDateOnly(ledgerPreviousMeetingDate)
        : null;

    const debugCollector = includeDebug ? [] : null;
    const trace = process.env.MMMS_LEDGER_INTEREST_DEBUG === "1";

    for (const loan of loans || []) {
        const loanDisburseNorm = normalizeDateOnly(loan.date);
        const loanDisburseDateYmd = dateToYmdOrNull(loan.date);
        const loanPurpose =
            loan.purpose != null && String(loan.purpose).trim() !== ""
                ? String(loan.purpose).trim().slice(0, 160)
                : "";

        const principalSnapshot =
            typeof principalForLoanAtMeeting === "function"
                ? principalForLoanAtMeeting(loan)
                : Math.max(0, (loan.amount || 0));

        const interestRateSnapshot =
            loan.loan_rate_snapshot ?? groupRate ?? 0;

        if (principalSnapshot <= 0 || interestRateSnapshot <= 0) {
            perLoan.push({
                loanId: loan._id,
                principalSnapshot: 0,
                interestRateSnapshot,
                daysCounted: 0,
                interestComputed: 0,
                loanStartCutoff: loanDisburseNorm,
                loanEndCutoff: periodEnd,
                loanDisburseDateYmd,
                loanPurpose,
            });
            continue;
        }

        let accrualStart;
        if (ledgerAnchorNormalized) {
            accrualStart =
                loanDisburseNorm &&
                loanDisburseNorm.getTime() >
                    ledgerAnchorNormalized.getTime()
                    ? loanDisburseNorm
                    : ledgerAnchorNormalized;
        } else {
            accrualStart = loanDisburseNorm;
        }

        if (!accrualStart || periodEnd.getTime() <= accrualStart.getTime()) {
            perLoan.push({
                loanId: loan._id,
                principalSnapshot,
                interestRateSnapshot,
                daysCounted: 0,
                interestComputed: 0,
                loanStartCutoff: accrualStart || loanDisburseNorm,
                loanEndCutoff: periodEnd,
                loanDisburseDateYmd,
                loanPurpose,
            });
            continue;
        }

        const daysCounted = Math.floor(
            Math.max(0, periodEnd.getTime() - accrualStart.getTime()) / 86400000
        );

        const interestComputed = calculateInterestForPeriod(
            principalSnapshot,
            interestRateSnapshot,
            accrualStart,
            periodEnd,
            debugCollector
        );
        totalInterest += interestComputed;

        if (trace) {
            const ymd = (d) =>
                d
                    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
                    : "";
            console.log("[interestEngine] meeting-bound interest", {
                loanId: String(loan._id),
                path: "computeInterestForMeeting",
                principalSnapshot,
                rateSnapshot: interestRateSnapshot,
                accrualStart: ymd(accrualStart),
                periodEnd: ymd(periodEnd),
                daysCounted,
                computedInterest: interestComputed,
                formula: "principal * rate * days / (100 * 365)",
            });
        }

        perLoan.push({
            loanId: loan._id,
            principalSnapshot,
            interestRateSnapshot,
            daysCounted,
            interestComputed,
            loanStartCutoff: accrualStart,
            loanEndCutoff: periodEnd,
            loanDisburseDateYmd,
            loanPurpose,
        });
    }

    return {
        perLoan,
        totalInterest,
        debugRows: debugCollector,
    };
}
