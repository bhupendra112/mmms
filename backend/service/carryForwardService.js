/**
 * Carry-forward: Tier 1 RecoveryMaster snapshot → Tier 2 balances + open revenue → Tier 3 zeros.
 * NO WRITES.
 */

import mongoose from "mongoose";
import RecoveryMaster from "../model/RecoveryMaster.js";
import MemberRevenueDemand from "../model/MemberRevenueDemand.js";
import {
    meetingKeyString,
    normalizeDateOnly,
    compareMeetings,
} from "./meetingResolver.js";
import { getCumulativePaymentsBeforeMeeting } from "./recoveryPaymentTotals.js";

function emptyPreviousShape() {
    return {
        carryForwardMode: "ZERO",
        financialBalances: { loan: 0, saving: 0 },
        revenueObligations: {
            membershipFeesShg: 0,
            membershipFeesGroup: 0,
            yogdan: 0,
            penalty: 0,
        },
        loan: { unpaidDemand: 0, actualPaid: 0 },
        interest: { unpaidDemand: 0, actualPaid: 0 },
        saving: { unpaidDemand: 0, actualPaid: 0, totalDemand: 0 },
        yogdan: { unpaidDemand: 0, actualPaid: 0 },
        memFeesSHG: { unpaidDemand: 0, actualPaid: 0 },
        memFeesGroup: { unpaidDemand: 0, actualPaid: 0 },
        penalty: { unpaidDemand: 0, actualPaid: 0 },
        charges: { unpaidDemand: {}, actualPaid: {} },
        _tier: 3,
    };
}

function demandDetailsToPrevious(memberRecovery) {
    const dd = memberRecovery?.demandDetails || {};
    const amt = memberRecovery?.amounts || {};
    return {
        carryForwardMode: "SNAPSHOT",
        financialBalances: {
            loan:
                dd.loan?.openingBalance != null
                    ? dd.loan.openingBalance
                    : amt.loan ?? 0,
            saving:
                dd.saving?.openingBalance != null
                    ? dd.saving.openingBalance
                    : amt.saving ?? 0,
        },
        revenueObligations: {
            membershipFeesShg: dd.memFeesSHG?.unpaidDemand ?? 0,
            membershipFeesGroup: dd.memFeesGroup?.unpaidDemand ?? 0,
            yogdan: dd.yogdan?.unpaidDemand ?? 0,
            penalty: dd.penalty?.unpaidDemand ?? 0,
        },
        loan: {
            unpaidDemand: dd.loan?.unpaidDemand ?? 0,
            actualPaid: dd.loan?.actualPaid ?? amt.loan ?? 0,
        },
        interest: {
            unpaidDemand: dd.interest?.unpaidDemand ?? 0,
            actualPaid: dd.interest?.actualPaid ?? amt.interest ?? 0,
        },
        saving: {
            unpaidDemand: dd.saving?.unpaidDemand ?? 0,
            actualPaid: dd.saving?.actualPaid ?? amt.saving ?? 0,
            totalDemand: dd.saving?.totalDemand ?? 0,
        },
        yogdan: {
            unpaidDemand: dd.yogdan?.unpaidDemand ?? 0,
            actualPaid: dd.yogdan?.actualPaid ?? amt.yogdan ?? 0,
        },
        memFeesSHG: {
            unpaidDemand: dd.memFeesSHG?.unpaidDemand ?? 0,
            actualPaid: dd.memFeesSHG?.actualPaid ?? amt.memFeesSHG ?? 0,
        },
        memFeesGroup: {
            unpaidDemand: dd.memFeesGroup?.unpaidDemand ?? 0,
            actualPaid: dd.memFeesGroup?.actualPaid ?? amt.memFeesGroup ?? 0,
        },
        penalty: {
            unpaidDemand: dd.penalty?.unpaidDemand ?? 0,
            actualPaid: dd.penalty?.actualPaid ?? amt.penalty ?? 0,
        },
        charges: {
            unpaidDemand:
                typeof dd.charges?.unpaidDemand === "object"
                    ? dd.charges.unpaidDemand
                    : {},
            actualPaid: amt.charges || {},
        },
        _tier: 1,
    };
}

/**
 * @param {{ groupId: any, memberId: any, prevMeeting: object|null, groupDoc?: object }} p
 */
export async function getCarryForward({ groupId, memberId, prevMeeting, groupDoc = null }) {
    try {
        if (!prevMeeting?.meetingDate) {
            return emptyPreviousShape();
        }

        const gid =
            typeof groupId === "string"
                ? new mongoose.Types.ObjectId(groupId)
                : groupId;
        const mid = memberId?.toString?.() || String(memberId);

        const session = await RecoveryMaster.findOne({
            groupId: gid,
            meetingDate: prevMeeting.meetingDate,
            meetingSequence: prevMeeting.meetingSequence || 1,
        }).lean();

        if (session) {
            const row = session.recoveries?.find(
                (r) => String(r.memberId) === mid
            );
            if (row) {
                return demandDetailsToPrevious(row);
            }
        }

        /** Tier 2 — balances + open revenue */
        const cutoffDate = normalizeDateOnly(prevMeeting.meetingDate);
        const cutoffSeq = prevMeeting.meetingSequence || 1;

        const legacySession = await RecoveryMaster.find({
            groupId: gid,
        })
            .sort({ date: -1, meetingSequence: -1 })
            .limit(40)
            .lean();

        let tier1Fallback = null;
        for (const rec of legacySession) {
            if (!rec.meetingDate) continue;
            const cmp = compareMeetings(
                {
                    meetingDate: rec.meetingDate,
                    meetingSequence: rec.meetingSequence || 1,
                },
                {
                    meetingDate: cutoffDate,
                    meetingSequence: cutoffSeq,
                }
            );
            if (cmp === 0) {
                const row = rec.recoveries?.find((r) => String(r.memberId) === mid);
                if (row) {
                    tier1Fallback = demandDetailsToPrevious(row);
                    break;
                }
            }
        }

        if (tier1Fallback) return tier1Fallback;

        const loanPaidBefore = await getCumulativePaymentsBeforeMeeting(
            gid,
            mid,
            cutoffDate,
            cutoffSeq,
            "loan",
            null
        );
        const savingPaidBefore = await getCumulativePaymentsBeforeMeeting(
            gid,
            mid,
            cutoffDate,
            cutoffSeq,
            "saving",
            null
        );
        const fdPaidBefore = await getCumulativePaymentsBeforeMeeting(
            gid,
            mid,
            cutoffDate,
            cutoffSeq,
            "fd",
            null
        );

        const openDemands = await MemberRevenueDemand.find({
            memberId: mid,
            groupId: gid,
            $or: [{ isPaid: false }, { $expr: { $lt: ["$paidAmount", "$amount"] } }],
        }).lean();

        let memShg = 0;
        let memGrp = 0;
        let yogUnpaid = 0;
        let penUnpaid = 0;

        for (const d of openDemands) {
            const due =
                Math.max(0, (parseFloat(d.amount) || 0) - (parseFloat(d.paidAmount) || 0));
            if (due <= 0) continue;
            if (d.revenueType === "membership_fees_shg") memShg += due;
            else if (d.revenueType === "membership_fees_group") memGrp += due;
            else if (d.revenueType === "yogdan") yogUnpaid += due;
            else if (d.revenueType === "penalty") penUnpaid += due;
        }

        const financialBalances = {
            loan: loanPaidBefore,
            saving: savingPaidBefore,
        };
        const revenueObligations = {
            membershipFeesShg: memShg,
            membershipFeesGroup: memGrp,
            yogdan: yogUnpaid,
            penalty: penUnpaid,
        };
        return {
            carryForwardMode: "BALANCE",
            financialBalances,
            revenueObligations,
            loan: {
                unpaidDemand: 0,
                actualPaid: 0,
                _openingHint: loanPaidBefore,
            },
            interest: { unpaidDemand: 0, actualPaid: 0 },
            saving: {
                unpaidDemand: 0,
                actualPaid: 0,
                totalDemand: 0,
                _openingHint: savingPaidBefore,
            },
            yogdan: { unpaidDemand: yogUnpaid, actualPaid: 0 },
            memFeesSHG: { unpaidDemand: memShg, actualPaid: 0 },
            memFeesGroup: { unpaidDemand: memGrp, actualPaid: 0 },
            penalty: { unpaidDemand: penUnpaid, actualPaid: 0 },
            charges: { unpaidDemand: {}, actualPaid: {} },
            _tier: 2,
        };
    } catch (e) {
        console.error("[getCarryForward]", e);
        return emptyPreviousShape();
    }
}

export { meetingKeyString };
