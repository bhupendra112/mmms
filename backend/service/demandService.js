import { GroupMaster, Member, LoanMaster, RecoveryMaster, MemberRevenueDemand, FDMaster } from "../model/index.js";
import PaymentMaster from "../model/PaymentMaster.js";

const toNumber = (value) => {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value) => Math.round(toNumber(value) * 100) / 100;

const getRecoveryMemberMatch = (memberId) => ({
    $or: [{ "recoveries.memberId": String(memberId) }, { "recoveries.memberId": memberId }],
});

export const getSavingBalance = async ({ groupId, memberId }) => {
    if (!groupId) return 0;

    if (memberId) {
        const member = await Member.findById(memberId).select("openingSaving openingSavingAdjustments").lean();
        const opening = toNumber(member?.openingSaving);
        const adjustments = Array.isArray(member?.openingSavingAdjustments)
            ? member.openingSavingAdjustments.reduce((sum, item) => sum + toNumber(item.amount), 0)
            : 0;

        const recoverySavings = await RecoveryMaster.aggregate([
            { $match: { groupId, ...getRecoveryMemberMatch(memberId) } },
            { $unwind: "$recoveries" },
            { $match: { $or: [{ "recoveries.memberId": String(memberId) }, { "recoveries.memberId": memberId }] } },
            { $group: { _id: null, total: { $sum: { $ifNull: ["$recoveries.amounts.saving", 0] } } } },
        ]);

        const withdrawals = await PaymentMaster.aggregate([
            { $match: { groupId, memberId, paymentType: "saving_withdrawal", status: { $in: ["approved", "completed"] } } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
        ]);

        return round2(opening + adjustments + toNumber(recoverySavings[0]?.total) - toNumber(withdrawals[0]?.total));
    }

    const members = await Member.find({ group: groupId }).select("openingSaving openingSavingAdjustments").lean();
    const openingTotal = members.reduce((sum, member) => {
        const adjustments = Array.isArray(member?.openingSavingAdjustments)
            ? member.openingSavingAdjustments.reduce((s, item) => s + toNumber(item.amount), 0)
            : 0;
        return sum + toNumber(member?.openingSaving) + adjustments;
    }, 0);

    const recoverySavings = await RecoveryMaster.aggregate([
        { $match: { groupId } },
        { $unwind: "$recoveries" },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$recoveries.amounts.saving", 0] } } } },
    ]);

    const withdrawals = await PaymentMaster.aggregate([
        { $match: { groupId, paymentType: "saving_withdrawal", status: { $in: ["approved", "completed"] } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    return round2(openingTotal + toNumber(recoverySavings[0]?.total) - toNumber(withdrawals[0]?.total));
};

export const getLoanOutstanding = async ({ groupId, memberId }) => {
    if (!groupId) return 0;

    const loanMatch = {
        groupId,
        transactionType: "Loan",
        status: "approved",
        ...(memberId ? { memberId: String(memberId) } : {}),
    };
    const recoveryMatch = {
        groupId,
        ...(memberId ? getRecoveryMemberMatch(memberId) : {}),
    };

    const [loanAgg, recoveredAgg] = await Promise.all([
        LoanMaster.aggregate([{ $match: loanMatch }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
        RecoveryMaster.aggregate([
            { $match: recoveryMatch },
            { $unwind: "$recoveries" },
            ...(memberId
                ? [{ $match: { $or: [{ "recoveries.memberId": String(memberId) }, { "recoveries.memberId": memberId }] } }]
                : []),
            { $group: { _id: null, total: { $sum: { $ifNull: ["$recoveries.amounts.loan", 0] } } } },
        ]),
    ]);

    return round2(Math.max(0, toNumber(loanAgg[0]?.total) - toNumber(recoveredAgg[0]?.total)));
};

export const getCurrentBalances = async ({ groupId, memberId }) => {
    if (!groupId) {
        throw new Error("groupId is required");
    }

    const [savingBalance, loanOutstanding, group] = await Promise.all([
        getSavingBalance({ groupId, memberId }),
        getLoanOutstanding({ groupId, memberId }),
        GroupMaster.findById(groupId).select("loan_rate").lean(),
    ]);

    const loanR = round2(loanOutstanding);
    const loanRate = toNumber(group?.loan_rate);
    const interestMemberScoped = Boolean(memberId);
    const interestDemand = interestMemberScoped ? round2((loanR * loanRate) / 1200) : 0;

    return {
        savingBalance: round2(savingBalance),
        loanOutstanding: loanR,
        interestDemand,
        loanRate,
        interestMemberScoped,
    };
};

export const getGroupFinanceSummary = async ({ groupId }) => {
    if (!groupId) {
        throw new Error("groupId is required");
    }

    const [members, loans, recoveries, fds] = await Promise.all([
        Member.find({ group: groupId }).select("openingSaving openingYogdan loanDetails.overdueInterest").lean(),
        LoanMaster.find({ groupId }).select("status transactionType amount").lean(),
        RecoveryMaster.find({ groupId }).select("status approvalStatus totals recoveries date recoveryDate").lean(),
        FDMaster.find({ groupId }).select("approvalStatus status amount").lean(),
    ]);

    const includedRecoveries = recoveries.filter((recovery) => {
        if (!recovery || recovery.status === "rejected") return false;
        if (recovery.approvalStatus === "rejected" || recovery.approvalStatus === "pending") return false;
        return true;
    });

    let totalSavings = 0;
    let totalYogdan = 0;
    let totalRecovery = 0;
    let totalLoanRecovered = 0;

    members.forEach((member) => {
        totalSavings += round2(member?.openingSaving);
        totalYogdan += round2(member?.openingYogdan);
    });

    includedRecoveries.forEach((recovery) => {
        totalRecovery += round2(recovery?.totals?.totalAmount);
        if (!Array.isArray(recovery.recoveries)) return;
        recovery.recoveries.forEach((memberRec) => {
            const amounts = memberRec?.amounts || {};
            totalSavings += round2(amounts.saving);
            totalYogdan += round2(amounts.yogdan);
            totalLoanRecovered += round2(amounts.loan);
        });
    });

    let totalLoanDisbursed = 0;
    loans.forEach((loan) => {
        if (loan?.status === "approved" && loan?.transactionType === "Loan") {
            totalLoanDisbursed += round2(loan.amount);
        }
    });
    const totalLoans = round2(Math.max(0, totalLoanDisbursed - totalLoanRecovered));

    const latestDemandByMember = new Map();
    includedRecoveries.forEach((recovery) => {
        const recoveryDate = new Date(recovery?.date || recovery?.recoveryDate || 0);
        (recovery.recoveries || []).forEach((memberRec) => {
            const memberId = String(memberRec?.memberId || "");
            if (!memberId) return;
            const prev = latestDemandByMember.get(memberId);
            if (!prev || recoveryDate > prev.date) {
                latestDemandByMember.set(memberId, {
                    date: recoveryDate,
                    dd: memberRec?.demandDetails || {},
                });
            }
        });
    });

    let totalInterest = 0;
    latestDemandByMember.forEach(({ dd }) => {
        const intr = dd?.interest || {};
        totalInterest += round2(intr.unpaidDemand ?? intr.unpaid ?? 0);
    });
    if (totalInterest === 0) {
        members.forEach((member) => {
            totalInterest += round2(member?.loanDetails?.overdueInterest);
        });
    }

    let totalFD = 0;
    fds.forEach((fd) => {
        if (fd?.approvalStatus === "rejected" || fd?.approvalStatus === "pending") return;
        if (fd?.status === "matured" || fd?.status === "closed") return;
        totalFD += round2(fd?.amount);
    });

    return {
        totalSavings: round2(totalSavings),
        totalLoans: round2(totalLoans),
        totalLoanDisbursed: round2(totalLoanDisbursed),
        totalLoanRecovered: round2(totalLoanRecovered),
        totalFD: round2(totalFD),
        totalInterest: round2(totalInterest),
        totalYogdan: round2(totalYogdan),
        totalRecovery: round2(totalRecovery),
    };
};

export const recalculateDemand = async ({ memberId, groupId }) => {
    if (!groupId || !memberId) {
        return {
            savingBalance: 0,
            loanOutstanding: 0,
            interestDemand: 0,
            penaltyDemand: 0,
            savingRuleDemand: 0,
        };
    }

    const [balances, group] = await Promise.all([
        getCurrentBalances({ groupId, memberId }),
        GroupMaster.findById(groupId).select("loan_rate saving_per_member").lean(),
    ]);

    const loanRate = toNumber(group?.loan_rate);
    const savingRuleDemand = round2(toNumber(group?.saving_per_member));
    const interestDemand = round2((balances.loanOutstanding * loanRate) / 1200);

    const pendingPenaltyAgg = await MemberRevenueDemand.aggregate([
        { $match: { memberId, groupId, revenueType: "penalty", isPaid: false } },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$amount", 0] } } } },
    ]);
    const penaltyDemand = round2(toNumber(pendingPenaltyAgg[0]?.total));

    return {
        savingBalance: balances.savingBalance,
        loanOutstanding: balances.loanOutstanding,
        interestDemand,
        penaltyDemand,
        savingRuleDemand,
    };
};

export const getMemberDemandClosingCaps = async ({ groupId, memberId }) => {
    if (!groupId || !memberId) {
        return { saving: 0, loan: 0, interest: 0, fd: 0 };
    }

    const latest = await RecoveryMaster.aggregate([
        { $match: { groupId, status: { $ne: "rejected" }, approvalStatus: { $nin: ["pending", "rejected"] } } },
        { $unwind: "$recoveries" },
        { $match: { $or: [{ "recoveries.memberId": String(memberId) }, { "recoveries.memberId": memberId }] } },
        { $sort: { date: -1, createdAt: -1 } },
        { $limit: 1 },
        {
            $project: {
                demandDetails: "$recoveries.demandDetails",
            },
        },
    ]);

    const dd = latest?.[0]?.demandDetails || {};
    const asCap = (value) => Math.max(0, round2(value));

    return {
        saving: asCap(dd?.saving?.closingBalance),
        loan: asCap(dd?.loan?.closingBalance),
        interest: asCap(dd?.interest?.closingBalance),
        fd: asCap(dd?.fd?.closingBalance),
    };
};
