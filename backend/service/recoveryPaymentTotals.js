/**
 * Read-only cumulative payment totals up to (but not including) a meeting cutoff.
 * Uses meetingDate/meetingSequence when present; legacy rows fall back to calendar date + sequence.
 */

import RecoveryMaster from "../model/RecoveryMaster.js";
import { normalizeDateOnly, compareMeetings } from "./meetingResolver.js";

export function isRecoveryStrictlyBeforeMeeting(recovery, cutoffMeetingDate, cutoffSequence = 1) {
    if (!recovery || !cutoffMeetingDate) return false;

    if (recovery.meetingDate) {
        return (
            compareMeetings(
                {
                    meetingDate: recovery.meetingDate,
                    meetingSequence: recovery.meetingSequence || 1,
                },
                {
                    meetingDate: cutoffMeetingDate,
                    meetingSequence: cutoffSequence || 1,
                }
            ) < 0
        );
    }

    const rd = normalizeDateOnly(recovery.date);
    const cd = normalizeDateOnly(cutoffMeetingDate);
    if (!rd || !cd) return false;
    if (rd.getTime() < cd.getTime()) return true;
    if (rd.getTime() > cd.getTime()) return false;
    return (recovery.meetingSequence || 1) < (cutoffSequence || 1);
}

/**
 * Sum payments of `type` for member across recoveries strictly before the cutoff meeting.
 */
export async function getCumulativePaymentsBeforeMeeting(
    groupId,
    memberId,
    cutoffMeetingDate,
    cutoffSequence,
    type = "loan",
    excludeRecoveryId = null
) {
    try {
        const memberIdStr = memberId?.toString?.() || String(memberId);
        const allRecoveries = await RecoveryMaster.find({ groupId })
            .sort({ meetingDate: 1, meetingSequence: 1, date: 1 })
            .lean();

        let cumulative = 0;

        for (const recovery of allRecoveries) {
            if (
                excludeRecoveryId &&
                recovery._id &&
                recovery._id.toString() === excludeRecoveryId.toString()
            ) {
                continue;
            }

            if (
                !isRecoveryStrictlyBeforeMeeting(
                    recovery,
                    cutoffMeetingDate,
                    cutoffSequence
                )
            ) {
                continue;
            }

            const memberRecovery = recovery.recoveries?.find((r) => {
                const rMemberIdStr = String(r.memberId || "");
                return rMemberIdStr === memberIdStr;
            });

            if (!memberRecovery) continue;

            const isValidRecovery =
                memberRecovery.attendance === "present" ||
                (memberRecovery.attendance === "absent" &&
                    memberRecovery.recoveryByOther === true);

            if (!isValidRecovery) continue;

            const amounts = memberRecovery.amounts || {};
            const amount =
                type === "loan"
                    ? amounts.loan || 0
                    : type === "interest"
                      ? amounts.interest || 0
                      : type === "saving"
                        ? amounts.saving || 0
                        : type === "fd"
                          ? amounts.fd || 0
                          : type === "yogdan"
                            ? amounts.yogdan || 0
                            : 0;

            cumulative += parseFloat(amount) || 0;
        }

        return cumulative;
    } catch (e) {
        console.error("[getCumulativePaymentsBeforeMeeting]", e);
        return 0;
    }
}
