/**
 * Loan Recalculation Service
 * Deterministic, idempotent recalculation of loan state after parameter changes.
 * Does NOT modify RecoveryMaster or ledger history.
 */

import LoanMaster from "../model/LoanMaster.js";
import RecoveryMaster from "../model/RecoveryMaster.js";
import GroupMaster from "../model/GroupMaster.js";

/**
 * Simple interest for a period: (principal * rate * days) / (100 * daysInYear)
 */
function interestForPeriod(principal, rate, startDate, endDate) {
    if (!principal || principal <= 0 || !rate || rate < 0) return 0;
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    if (end <= start) return 0;
    const days = Math.floor((end - start) / (1000 * 60 * 60 * 24));
    const daysInYear = end.getFullYear() % 4 === 0 ? 366 : 365;
    return Math.max(0, (principal * rate * days) / (100 * daysInYear));
}

/**
 * Parse date (DD/MM/YYYY or ISO)
 */
function parseAsOfDate(asOfDate) {
    if (asOfDate instanceof Date && !isNaN(asOfDate.getTime())) {
        const d = new Date(asOfDate);
        d.setHours(23, 59, 59, 999);
        return d;
    }
    if (typeof asOfDate === "string" && asOfDate.includes("/")) {
        const parts = asOfDate.split("/");
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            const d = new Date(year, month, day);
            d.setHours(23, 59, 59, 999);
            return d;
        }
    }
    const d = new Date(asOfDate);
    d.setHours(23, 59, 59, 999);
    return d;
}

/**
 * Recalculate loan state for a single loan as of a given date.
 * Uses member's recoveries and allocates principal (FIFO) and interest (proportional by loan amount).
 *
 * @param {string|ObjectId} loanId - LoanMaster _id
 * @param {Date|string} asOfDate - Calculate state as of this date (inclusive)
 * @param {Object} [overrides] - Optional { date, amount, time_period, loan_rate_snapshot } for preview without saving
 * @returns {Promise<{
 *   recalculatedPrincipalDue: number,
 *   recalculatedInterestDue: number,
 *   totalDue: number,
 *   totalPaid: number,
 *   overpayment: number,
 *   underpayment: number,
 *   outstanding: number,
 *   principalPaid: number,
 *   interestPaid: number,
 *   loan?: object,
 *   memberId?: string
 * }>}
 */
export async function recalculateLoanState(loanId, asOfDate, overrides = {}) {
    const asOf = parseAsOfDate(asOfDate);

    const loan = await LoanMaster.findById(loanId).lean();
    if (!loan) {
        throw new Error("Loan not found");
    }
    if (loan.transactionType !== "Loan" || loan.status !== "approved") {
        throw new Error("Loan is not an approved loan");
    }

    const memberIdStr = (loan.memberId || "").toString();
    if (!memberIdStr) {
        throw new Error("Loan has no member");
    }

    const groupId = loan.groupId;
    const groupDoc = await GroupMaster.findById(groupId).lean();
    if (!groupDoc) {
        throw new Error("Group not found");
    }

    // All approved loans for this member (same group), sorted by date
    let allLoans = await LoanMaster.find({
        groupId,
        memberId: memberIdStr,
        transactionType: "Loan",
        status: "approved",
    })
        .select("_id date amount loan_rate_snapshot")
        .sort({ date: 1 })
        .lean();

    const loanIndex = allLoans.findIndex((l) => l._id.toString() === loanId.toString());
    if (loanIndex < 0) {
        throw new Error("Loan not found in member's loans");
    }

    // Apply overrides for preview (date, amount, time_period, loan_rate_snapshot)
    const effectiveAmount = overrides.amount !== undefined && overrides.amount !== null
        ? Math.max(0, parseFloat(overrides.amount))
        : Math.max(0, parseFloat(loan.amount) || 0);
    const effectiveDate = overrides.date != null ? new Date(overrides.date) : new Date(loan.date);
    const effectiveRate = overrides.loan_rate_snapshot !== undefined && overrides.loan_rate_snapshot !== null
        ? parseFloat(overrides.loan_rate_snapshot)
        : (parseFloat(loan.loan_rate_snapshot) ?? parseFloat(groupDoc?.loan_rate) ?? 0);

    const thisLoanAmount = effectiveAmount;
    const thisLoanRate = effectiveRate;
    const thisLoanDate = new Date(effectiveDate);
    thisLoanDate.setHours(0, 0, 0, 0);

    // Total principal of all loans (for proportional interest allocation); use effective amount for this loan when overridden
    const totalPrincipalAllLoans = allLoans.reduce((s, l, i) => {
        const amt = (i === loanIndex && overrides.amount != null) ? effectiveAmount : Math.max(0, parseFloat(l.amount) || 0);
        return s + amt;
    }, 0);

    // Recoveries for group up to asOfDate, sorted by date and meetingSequence
    const recoveries = await RecoveryMaster.find({
        groupId,
        date: { $lte: asOf },
    })
        .sort({ date: 1, meetingSequence: 1 })
        .lean();

    // Build list of { date, meetingSequence, loanPaid, interestPaid } for this member
    const memberPayments = [];
    for (const rec of recoveries) {
        const recoveryDate = new Date(rec.date);
        if (recoveryDate > asOf) continue;
        const sameDay = recoveryDate.getTime() === new Date(asOf).setHours(0, 0, 0, 0);
        if (sameDay && (rec.meetingSequence || 1) > 1) continue; // if asOf is same day, only include earlier sequence

        const memberRec = (rec.recoveries || []).find(
            (r) => String(r.memberId || "") === memberIdStr
        );
        if (!memberRec) continue;

        const present = memberRec.attendance === "present" || (memberRec.attendance === "absent" && memberRec.recoveryByOther === true);
        if (!present) continue;

        const loanPaid = Math.max(0, parseFloat(memberRec.amounts?.loan) || 0);
        const interestPaid = Math.max(0, parseFloat(memberRec.amounts?.interest) || 0);
        memberPayments.push({
            date: new Date(rec.date),
            meetingSequence: rec.meetingSequence || 1,
            loanPaid,
            interestPaid,
        });
    }

    // FIFO: cumulative loan paid allocated to loans in order
    let runningLoanPaid = 0;
    let principalPaidThisLoan = 0;
    let cumulativeBeforeThisLoan = 0;
    for (let i = 0; i < loanIndex; i++) {
        cumulativeBeforeThisLoan += Math.max(0, parseFloat(allLoans[i].amount) || 0);
    }
    for (const p of memberPayments) {
        runningLoanPaid += p.loanPaid;
        const paidToPreviousLoans = Math.min(runningLoanPaid, cumulativeBeforeThisLoan);
        const paidToThisLoanSoFar = Math.max(0, Math.min(runningLoanPaid - paidToPreviousLoans, thisLoanAmount));
        principalPaidThisLoan = paidToThisLoanSoFar;
    }

    // Interest paid: proportional by loan amount
    const totalInterestPaidMember = memberPayments.reduce((s, p) => s + p.interestPaid, 0);
    const interestPaidThisLoan =
        totalPrincipalAllLoans > 0
            ? (thisLoanAmount / totalPrincipalAllLoans) * totalInterestPaidMember
            : 0;

    // Interest accrued till asOfDate (reducing balance)
    // Allocate each recovery's loan payment FIFO to get principal outstanding after each recovery
    let principalOutstanding = thisLoanAmount;
    let cumulativeMemberLoanPaid = 0;
    const principalAfterEachPayment = []; // { date, meetingSequence, principalOutstanding }
    principalAfterEachPayment.push({ date: thisLoanDate, meetingSequence: 0, principalOutstanding: thisLoanAmount });

    for (const p of memberPayments) {
        cumulativeMemberLoanPaid += p.loanPaid;
        const paidToPreviousLoans = Math.min(cumulativeMemberLoanPaid, cumulativeBeforeThisLoan);
        const paidToThisLoan = Math.max(0, Math.min(cumulativeMemberLoanPaid - paidToPreviousLoans, thisLoanAmount));
        principalOutstanding = Math.max(0, thisLoanAmount - paidToThisLoan);
        const periodEnd = new Date(p.date);
        periodEnd.setHours(0, 0, 0, 0);
        principalAfterEachPayment.push({ date: periodEnd, meetingSequence: p.meetingSequence, principalOutstanding });
    }

    // Compute interest for each period (start -> end) with principal at start
    let interestAccrued = 0;
    for (let i = 0; i < principalAfterEachPayment.length - 1; i++) {
        const periodStart = principalAfterEachPayment[i].date;
        const periodEnd = principalAfterEachPayment[i + 1].date;
        const principal = principalAfterEachPayment[i].principalOutstanding;
        if (periodEnd > periodStart && principal > 0) {
            interestAccrued += interestForPeriod(principal, thisLoanRate, periodStart, periodEnd);
        }
    }
    // Last period: last payment date -> asOf
    const lastEntry = principalAfterEachPayment[principalAfterEachPayment.length - 1];
    const endOfAsOf = new Date(asOf);
    endOfAsOf.setHours(23, 59, 59, 999);
    if (lastEntry.principalOutstanding > 0 && endOfAsOf > lastEntry.date) {
        interestAccrued += interestForPeriod(lastEntry.principalOutstanding, thisLoanRate, lastEntry.date, endOfAsOf);
    }

    const recalculatedPrincipalDue = thisLoanAmount;
    const recalculatedInterestDue = Math.round(interestAccrued * 100) / 100;
    const totalDue = Math.round((recalculatedPrincipalDue + recalculatedInterestDue) * 100) / 100;
    const totalPaid = Math.round((principalPaidThisLoan + interestPaidThisLoan) * 100) / 100;
    const overpayment = Math.max(0, Math.round((totalPaid - totalDue) * 100) / 100);
    const underpayment = Math.max(0, Math.round((totalDue - totalPaid) * 100) / 100);
    const outstanding = Math.max(0, Math.round((thisLoanAmount - principalPaidThisLoan) * 100) / 100);

    return {
        recalculatedPrincipalDue,
        recalculatedInterestDue,
        totalDue,
        totalPaid,
        overpayment,
        underpayment,
        outstanding,
        principalPaid: Math.round(principalPaidThisLoan * 100) / 100,
        interestPaid: Math.round(interestPaidThisLoan * 100) / 100,
        loan: {
            _id: loan._id,
            date: overrides.date != null ? effectiveDate : loan.date,
            amount: thisLoanAmount,
            time_period: overrides.time_period != null ? overrides.time_period : loan.time_period,
            loan_rate_snapshot: thisLoanRate,
        },
        memberId: memberIdStr,
    };
}
