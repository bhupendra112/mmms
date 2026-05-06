/**
 * Ledger spine for meeting-based finance: anchors off persisted RecoveryMaster rows,
 * not the calendar template alone. Used for loan interest accrual windows (see interestEngine).
 */

import mongoose from "mongoose";
import RecoveryMaster from "../model/RecoveryMaster.js";
import { normalizeDateOnly, compareMeetings } from "./meetingResolver.js";

/** Skip drafts, rejects, placeholders; tolerate legacy docs without isFinalized. */
function rowQualifiesForInterestAnchor(rec) {
    if (!rec?.meetingDate) return false;
    if (rec.meetingStatus === "SKIPPED_MEETING") return false;
    if (rec.status === "rejected" || rec.approvalStatus === "rejected") return false;
    // New drafts intentionally unfinalized; legacy rows often omit the field.
    if (rec.isFinalized === false) return false;
    return true;
}

/**
 * Latest finalized RECOVERED session strictly BEFORE (cutoffMeetingDate, cutoffSequence)
 * on the group's RecoveryMaster ledger. Same-day seq uses compareMeetings ordering.
 *
 * @returns {{ meetingDate: Date, meetingSequence: number } | null}
 */
export async function getLastRecoveredMeetingBefore(
    groupId,
    cutoffMeetingDate,
    cutoffSequence = 1,
    excludeRecoveryMasterId = null
) {
    const gid =
        typeof groupId === "string"
            ? new mongoose.Types.ObjectId(groupId)
            : groupId;

    const cutoffDt = normalizeDateOnly(cutoffMeetingDate);
    if (!cutoffDt) return null;

    const cutoff = {
        meetingDate: cutoffDt,
        meetingSequence: cutoffSequence || 1,
    };
    const excludeStr = excludeRecoveryMasterId?.toString?.() ?? null;

    const sessions = await RecoveryMaster.find({
        groupId: gid,
        meetingDate: { $exists: true, $ne: null },
    })
        .select(
            "_id meetingDate meetingSequence meetingStatus status approvalStatus isFinalized"
        )
        .lean();

    let best = null;

    for (const r of sessions) {
        if (!rowQualifiesForInterestAnchor(r)) continue;
        if (excludeStr && r._id && String(r._id) === excludeStr) continue;

        const cand = {
            meetingDate: normalizeDateOnly(r.meetingDate),
            meetingSequence: r.meetingSequence || 1,
        };
        if (!cand.meetingDate) continue;

        if (compareMeetings(cand, cutoff) >= 0) continue;

        if (!best || compareMeetings(cand, best) > 0) {
            best = cand;
        }
    }

    return best;
}
