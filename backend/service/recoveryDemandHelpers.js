/**
 * Read-only helpers for demand computation (no RecoveryMaster / MemberRevenueDemand writes).
 */

import RecoveryMaster from "../model/RecoveryMaster.js";
import LoanMaster from "../model/LoanMaster.js";
import MemberRevenueDemand from "../model/MemberRevenueDemand.js";

export async function calculateYogdanDemand(groupId, memberId, currentDate) {
    try {
        const memberIdStr = memberId?.toString?.() || String(memberId);
        const endOfDay = new Date(currentDate);
        endOfDay.setHours(23, 59, 59, 999);

        const unpaidYogdanLoans = await LoanMaster.find({
            groupId,
            memberId: memberIdStr,
            transactionType: "Loan",
            status: "approved",
            yogdanCollected: { $ne: true },
            date: { $lte: endOfDay },
        })
            .select("amount yogdanAmount yogdanCollected date")
            .sort({ date: 1 })
            .lean();

        let totalYogdanDemand = 0;
        const unpaidLoans = [];

        for (const loan of unpaidYogdanLoans) {
            const loanAmount = parseFloat(loan.amount) || 0;
            const hasStored =
                loan.yogdanAmount !== undefined && loan.yogdanAmount !== null;
            const yogdanAmount = hasStored
                ? parseFloat(loan.yogdanAmount) || 0
                : loanAmount > 0
                  ? Math.round(loanAmount * 0.01 * 100) / 100
                  : 0;

            if (yogdanAmount > 0) {
                totalYogdanDemand += yogdanAmount;
                unpaidLoans.push({
                    loanId: loan._id,
                    loanAmount,
                    yogdanAmount,
                });
            }
        }

        return {
            totalDemand: Math.max(0, totalYogdanDemand),
            unpaidLoans,
        };
    } catch (error) {
        console.error("[calculateYogdanDemand]", error);
        return { totalDemand: 0, unpaidLoans: [] };
    }
}

export async function calculateChargesDue(member, group, currentDate, groupId) {
    try {
        if (!group.charges || group.charges.length === 0) {
            return {};
        }

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

        const currentYear = parsedDate.getFullYear();
        const currentMonth = parsedDate.getMonth();
        const currentDay = parsedDate.getDate();

        const joinDate = member.Dt_Join || member.Member_Dt || member.createdAt;
        const joinYear = joinDate ? new Date(joinDate).getFullYear() : currentYear;
        const joinMonth = joinDate ? new Date(joinDate).getMonth() : currentMonth;
        const joinDay = joinDate ? new Date(joinDate).getDate() : currentDay;

        const dateStart = new Date(parsedDate);
        dateStart.setHours(0, 0, 0, 0);

        const previousRecoveries = await RecoveryMaster.find({
            groupId,
            date: { $lt: dateStart },
        })
            .sort({ date: 1 })
            .lean();

        const chargePayments = {};
        for (const recovery of previousRecoveries) {
            const memRec = recovery.recoveries?.find(
                (r) =>
                    r.memberId === member._id.toString() ||
                    r.memberId?.toString() === member._id.toString()
            );
            if (memRec && memRec.amounts?.charges) {
                Object.keys(memRec.amounts.charges).forEach((chargeName) => {
                    if (!chargePayments[chargeName]) {
                        chargePayments[chargeName] = 0;
                    }
                    chargePayments[chargeName] +=
                        memRec.amounts.charges[chargeName] || 0;
                });
            }
        }

        const chargesDue = {};
        const activeCharges = group.charges.filter((c) => c.isActive !== false);

        for (const charge of activeCharges) {
            const chargeStartDate = new Date(charge.startDate);
            const chargeStartYear = chargeStartDate.getFullYear();
            const chargeStartMonth = chargeStartDate.getMonth();
            const chargeStartDay = chargeStartDate.getDate();

            if (charge.type === "one-time") {
                const chargePaid = chargePayments[charge.name] || 0;
                if (chargePaid < charge.amount) {
                    chargesDue[charge.name] = charge.amount - chargePaid;
                }
            } else if (charge.type === "recurring") {
                if (charge.frequency === "yearly") {
                    let cycleStartYear = chargeStartYear;
                    if (
                        currentYear > chargeStartYear ||
                        (currentYear === chargeStartYear &&
                            currentMonth > chargeStartMonth) ||
                        (currentYear === chargeStartYear &&
                            currentMonth === chargeStartMonth &&
                            currentDay >= chargeStartDay)
                    ) {
                        cycleStartYear = currentYear;
                    } else {
                        cycleStartYear = currentYear - 1;
                    }

                    const currentCycleStart = new Date(
                        cycleStartYear,
                        chargeStartMonth,
                        chargeStartDay
                    );

                    const memberJoinedBeforeCycle =
                        joinYear < cycleStartYear ||
                        (joinYear === cycleStartYear &&
                            joinMonth < chargeStartMonth) ||
                        (joinYear === cycleStartYear &&
                            joinMonth === chargeStartMonth &&
                            joinDay < chargeStartDay);

                    const isCycleStart =
                        currentYear === cycleStartYear &&
                        currentMonth === chargeStartMonth &&
                        currentDay >= chargeStartDay;

                    let paidForCurrentCycle = false;
                    for (const recovery of previousRecoveries) {
                        const memRec = recovery.recoveries?.find(
                            (r) =>
                                r.memberId === member._id.toString() ||
                                r.memberId?.toString() === member._id.toString()
                        );
                        if (memRec && memRec.amounts?.charges?.[charge.name] > 0) {
                            const recoveryDate = new Date(recovery.date);
                            if (recoveryDate >= currentCycleStart) {
                                paidForCurrentCycle = true;
                                break;
                            }
                        }
                    }

                    if (
                        isCycleStart ||
                        (!paidForCurrentCycle &&
                            (memberJoinedBeforeCycle || parsedDate >= currentCycleStart))
                    ) {
                        chargesDue[charge.name] = charge.amount;
                    }
                } else if (charge.frequency === "monthly") {
                    let cycleStartYear = chargeStartYear;
                    let cycleStartMonth = chargeStartMonth;

                    if (
                        currentYear > chargeStartYear ||
                        (currentYear === chargeStartYear &&
                            currentMonth > chargeStartMonth) ||
                        (currentYear === chargeStartYear &&
                            currentMonth === chargeStartMonth &&
                            currentDay >= chargeStartDay)
                    ) {
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
                        cycleStartMonth = 11;
                    }

                    const currentCycleStart = new Date(
                        cycleStartYear,
                        cycleStartMonth,
                        chargeStartDay
                    );
                    const nextCycleStart = new Date(
                        cycleStartYear,
                        cycleStartMonth + 1,
                        chargeStartDay
                    );

                    let paidForCurrentCycle = false;
                    for (const recovery of previousRecoveries) {
                        const memRec = recovery.recoveries?.find(
                            (r) =>
                                r.memberId === member._id.toString() ||
                                r.memberId?.toString() === member._id.toString()
                        );
                        if (memRec && memRec.amounts?.charges?.[charge.name] > 0) {
                            const recoveryDate = new Date(recovery.date);
                            if (
                                recoveryDate >= currentCycleStart &&
                                recoveryDate < nextCycleStart
                            ) {
                                paidForCurrentCycle = true;
                                break;
                            }
                        }
                    }

                    if (!paidForCurrentCycle && parsedDate >= currentCycleStart) {
                        chargesDue[charge.name] = charge.amount;
                    }
                }
            }
        }

        return chargesDue;
    } catch (error) {
        console.error("[calculateChargesDue]", error);
        return {};
    }
}

/** Membership amounts from existing unpaid MemberRevenueDemand rows only (no creates). */
export async function getMembershipFeesDemandReadOnly(member, groupDoc, parsedDate, groupId) {
    try {
        const unpaidShg = await MemberRevenueDemand.findOne({
            memberId: member._id,
            groupId,
            revenueType: "membership_fees_shg",
            $or: [{ isPaid: false }, { $expr: { $lt: ["$paidAmount", "$amount"] } }],
        })
            .sort({ demandDate: 1 })
            .lean();

        const unpaidGrp = await MemberRevenueDemand.findOne({
            memberId: member._id,
            groupId,
            revenueType: "membership_fees_group",
            $or: [{ isPaid: false }, { $expr: { $lt: ["$paidAmount", "$amount"] } }],
        })
            .sort({ demandDate: 1 })
            .lean();

        const dueShg = unpaidShg
            ? Math.max(
                  0,
                  (parseFloat(unpaidShg.amount) || 0) -
                      (parseFloat(unpaidShg.paidAmount) || 0)
              )
            : 0;
        const dueGrp = unpaidGrp
            ? Math.max(
                  0,
                  (parseFloat(unpaidGrp.amount) || 0) -
                      (parseFloat(unpaidGrp.paidAmount) || 0)
              )
            : 0;

        return {
            memFeesSHG: Math.max(0, dueShg),
            memFeesGroup: Math.max(0, dueGrp),
        };
    } catch (e) {
        console.error("[getMembershipFeesDemandReadOnly]", e);
        return { memFeesSHG: 0, memFeesGroup: 0 };
    }
}
