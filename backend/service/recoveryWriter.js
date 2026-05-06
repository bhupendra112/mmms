/**
 * ONLY WRITER: inserts/updates RecoveryMaster, lazy SKIPPED_MEETING materialization,
 * idempotent finalize via clientRequestId (checked FIRST), snapshot versioning, then side effects.
 * clientRequestId: mandatory non-empty string (caller generates UUID if missing).
 */

import mongoose from "mongoose";
import RecoveryMaster from "../model/RecoveryMaster.js";
import Member from "../model/Member.js";
import {
    resolveMeetingForRecovery,
    getPreviousMeeting,
    normalizeDateOnly,
    getNextMeetingDate,
    meetingKeyString,
    listScheduledMeetingsStrictlyBetween,
} from "./meetingResolver.js";
import { getCarryForward } from "./carryForwardService.js";
import {
    calculateDemandDetailsPure,
    DEMAND_SNAPSHOT_VERSION,
    getWriterDemandCaps,
} from "./demandEngine.js";
import { processRecoveryTransactions } from "./recoverySideEffects.js";

const roundDemand = (n) =>
    typeof n === "number" && !Number.isNaN(n)
        ? Math.round(n)
        : Math.round(parseFloat(n) || 0);

export function validateRecoveryDemandCapsExtended(
    demandDetails,
    amounts,
    meta = {}
) {
    if (!demandDetails || !amounts) return null;

    const interest = roundDemand(parseFloat(amounts.interest) || 0);
    const maxInterest = roundDemand(demandDetails.interest?.totalDemand ?? 0);
    if (interest > maxInterest) {
        return `Interest on loan cannot exceed demand of ₹${maxInterest.toLocaleString()}`;
    }

    const saving = roundDemand(parseFloat(amounts.saving) || 0);
    const maxSaving = roundDemand(demandDetails.saving?.totalDemand ?? 0);
    if (saving > maxSaving) {
        return `Saving cannot exceed demand of ₹${maxSaving.toLocaleString()}`;
    }

    const yog = roundDemand(parseFloat(amounts.yogdan) || 0);
    const maxYog = roundDemand(demandDetails.yogdan?.totalDemand ?? 0);
    if (yog > maxYog) {
        return `Yogdan cannot exceed demand of ₹${maxYog.toLocaleString()}`;
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

    const pen = roundDemand(parseFloat(amounts.penalty) || 0);
    const maxPen = roundDemand(demandDetails.penalty?.totalDemand ?? 0);
    if (pen > maxPen) {
        return `Penalty cannot exceed demand of ₹${maxPen.toLocaleString()}`;
    }

    const loanPaid = roundDemand(parseFloat(amounts.loan) || 0);
    const rem =
        meta.remainingLoanPrincipal != null
            ? Math.max(0, meta.remainingLoanPrincipal)
            : Infinity;
    if (loanPaid > rem + 0.01) {
        return `Loan recovery cannot exceed remaining principal (₹${rem.toLocaleString()})`;
    }

    const charges = amounts.charges || {};
    const dueCharges = demandDetails.charges?.chargesDue || {};
    for (const [name, paid] of Object.entries(charges)) {
        const p = roundDemand(parseFloat(paid) || 0);
        const maxC = roundDemand(dueCharges[name] ?? 0);
        const prevU = roundDemand(
            demandDetails.charges?.chargesPrevUnpaid?.[name] ?? 0
        );
        const maxTotal = prevU + maxC;
        if (p > maxTotal + 0.01) {
            return `Charge "${name}" cannot exceed demand of ₹${maxTotal.toLocaleString()}`;
        }
    }

    return null;
}

function recoveryRowTotal(rec) {
    const amounts = rec.amounts || {};
    const chargesTotal = amounts.charges
        ? Object.values(amounts.charges).reduce((s, x) => s + (parseFloat(x) || 0), 0)
        : 0;
    return roundDemand(
        (amounts.saving || 0) +
            (amounts.loan || 0) +
            (amounts.fd || 0) +
            (amounts.interest || 0) +
            (amounts.yogdan || 0) +
            (amounts.memFeesSHG || 0) +
            (amounts.memFeesSamiti || 0) +
            (amounts.memFeesGroup || 0) +
            (amounts.penalty || 0) +
            (amounts.other || 0) +
            chargesTotal
    );
}

function ledgerTxnInfraRejected(e) {
    const msg = String(e?.message || "");
    const code = e?.code;
    return (
        code === 20 ||
        msg.includes("Transaction numbers are only allowed") ||
        /multi-document transactions are not supported/i.test(msg) ||
        (msg.includes("replica set") && msg.includes("member"))
    );
}

async function getLastFinalizedMeetingAnchor(groupId, session = null) {
    let q = RecoveryMaster.find({
        groupId,
        isFinalized: true,
        meetingDate: { $exists: true, $ne: null },
    }).sort({ meetingDate: -1, meetingSequence: -1 }).limit(1);
    if (session) q = q.session(session);
    const rows = await q.lean();
    const row = rows[0];
    return row?.meetingDate
        ? {
              meetingDate: row.meetingDate,
              meetingSequence: row.meetingSequence || 1,
          }
        : null;
}

async function resolveSkippedMeetingSlots(
    groupId,
    groupDoc,
    currentMeeting,
    session = null
) {
    const anchor = await getLastFinalizedMeetingAnchor(groupId, session);
    if (!anchor) return [];

    const scheduled = listScheduledMeetingsStrictlyBetween(
        groupDoc,
        anchor,
        currentMeeting
    );

    const out = [];
    for (const mt of scheduled) {
        let q = RecoveryMaster.findOne({
            groupId,
            meetingDate: mt.meetingDate,
            meetingSequence: mt.meetingSequence || 1,
        }).select("_id");
        if (session) q = q.session(session);
        const ex = await q.lean();
        if (!ex) out.push(mt);
        if (out.length > 120) break;
    }
    return out;
}

async function withRecoveryLedgerTransaction(body) {
    let session;
    try {
        session = await mongoose.startSession();
        await session.withTransaction(() => body(session));
    } catch (e) {
        if (session) await session.endSession();
        session = null;
        if (ledgerTxnInfraRejected(e)) {
            await body(null);
            return;
        }
        throw e;
    } finally {
        if (session) await session.endSession();
    }
}

async function materializeSkippedMeetings({ groupDoc, meetings, actor, session }) {
    const groupId = groupDoc._id;
    const members = await Member.find({ group: groupId }).lean();

    for (const mt of meetings) {
        const prev = getPreviousMeeting({
            groupDoc,
            meetingDate: mt.meetingDate,
            meetingSequence: mt.meetingSequence,
        });

        const recoveries = [];
        for (const member of members) {
            const prevData = await getCarryForward({
                groupId,
                memberId: member._id,
                prevMeeting: prev,
                groupDoc,
            });

            const meetingResolved = {
                meetingDate: mt.meetingDate,
                meetingSequence: mt.meetingSequence || 1,
                gapDays: 30,
                demandStatus: "MISSING_DEMAND",
            };

            const engine = await calculateDemandDetailsPure({
                groupDoc,
                groupId,
                memberId: member._id,
                member,
                meeting: meetingResolved,
                prevMeeting: prev,
                previousData: prevData,
                actualAmounts: {},
                excludeRecoveryId: null,
                recoveryDate: mt.meetingDate,
                options: {},
            });

            recoveries.push({
                memberId: member._id.toString(),
                memberCode: member.Member_Id || "",
                memberName: member.Member_Nm || "",
                attendance: "absent",
                recoveryByOther: false,
                amounts: {
                    saving: 0,
                    loan: 0,
                    interest: 0,
                    yogdan: 0,
                    memFeesSHG: 0,
                    memFeesSamiti: 0,
                    memFeesGroup: 0,
                    penalty: 0,
                    other: 0,
                    fd: 0,
                    charges: {},
                },
                total: 0,
                demandDetails: engine.demandDetails,
                loanSnapshots: engine.loanSnapshots || [],
            });
        }

        let existsQ = RecoveryMaster.findOne({
            groupId,
            meetingDate: mt.meetingDate,
            meetingSequence: mt.meetingSequence || 1,
        }).select("_id");
        if (session) existsQ = existsQ.session(session);
        if (await existsQ.lean()) continue;

        const doc = {
            groupId,
            groupName: groupDoc.group_name,
            groupCode: groupDoc.group_code,
            date: normalizeDateOnly(mt.meetingDate),
            meetingDate: mt.meetingDate,
            meetingSequence: mt.meetingSequence || 1,
            recoveryDate: null,
            gapDays: 30,
            demandStatus: "MISSING_DEMAND",
            meetingStatus: "SKIPPED_MEETING",
            isFinalized: true,
            demandSnapshotVersion: DEMAND_SNAPSHOT_VERSION,
            finalizedAt: new Date(),
            finalizedBy: actor || "system-skipped",
            recoveries,
            memberCount: recoveries.length,
            totals: { totalCash: 0, totalOnline: 0, totalAmount: 0 },
            status: "approved",
            approvalStatus: "approved",
            createdBy: actor || "system-skipped",
        };
        try {
            if (session) {
                await RecoveryMaster.create([doc], { session });
            } else {
                await RecoveryMaster.create(doc);
            }
        } catch (e) {
            if (e.code === 11000) {
                console.warn(
                    "[recoveryWriter] skipped meeting insert race (meetingKey exists)",
                    meetingKeyString(groupId, mt.meetingDate, mt.meetingSequence)
                );
            } else {
                throw e;
            }
        }
    }
}

/**
 * Finalize an approved recovery session (finance-grade ledger path).
 */
export async function finalizeRecovery({
    groupDoc,
    payload,
    parsedDate,
    clientRequestId,
    actor = "admin",
}) {
    const cid =
        clientRequestId != null ? String(clientRequestId).trim() : "";
    if (!cid) {
        const err = new Error("clientRequestId is required for ledger finalize.");
        err.code = "CLIENT_REQUEST_ID_REQUIRED";
        throw err;
    }

    const groupId = groupDoc._id;

    const existingIdem = await RecoveryMaster.findOne({
        groupId,
        clientRequestId: cid,
    }).lean();
    if (existingIdem) {
        return { recovery: existingIdem, idempotent: true };
    }

    const meeting = resolveMeetingForRecovery({
        groupDoc,
        recoveryDate: parsedDate,
    });
    const prevMeetingForCurrent = getPreviousMeeting({
        groupDoc,
        meetingDate: meeting.meetingDate,
        meetingSequence: meeting.meetingSequence,
    });

    const recoveriesOut = [];
    for (const rec of payload.recoveries || []) {
        if (!rec.memberId) continue;
        const member = await Member.findById(rec.memberId).lean();
        if (!member) continue;

        const prevData = await getCarryForward({
            groupId,
            memberId: rec.memberId,
            prevMeeting: prevMeetingForCurrent,
            groupDoc,
        });

        const engine = await calculateDemandDetailsPure({
            groupDoc,
            groupId,
            memberId: rec.memberId,
            member,
            meeting,
            prevMeeting: prevMeetingForCurrent,
            previousData: prevData,
            actualAmounts: rec.amounts || {},
            excludeRecoveryId: null,
            recoveryDate: parsedDate,
            options: {},
        });

        const { remainingLoanPrincipal } = getWriterDemandCaps(engine);

        const capErr = validateRecoveryDemandCapsExtended(
            engine.demandDetails,
            rec.amounts || {},
            { remainingLoanPrincipal }
        );
        if (capErr) {
            const err = new Error(capErr);
            err.code = "RECOVERY_CAP_VALIDATION";
            throw err;
        }

        const merged = {
            ...rec,
            demandDetails: engine.demandDetails,
            loanSnapshots: engine.loanSnapshots || [],
            total: rec.total != null ? rec.total : recoveryRowTotal(rec),
        };
        recoveriesOut.push(merged);
    }

    let totalCash = 0;
    let totalOnline = 0;
    let totalAmount = 0;
    for (const r of recoveriesOut) {
        const t = roundDemand(r.total ?? recoveryRowTotal(r));
        totalAmount += t;
        if (r.paymentMode?.cash) totalCash += t;
        if (r.paymentMode?.online) totalOnline += t;
    }

    const filter = {
        groupId,
        meetingDate: meeting.meetingDate,
        meetingSequence: meeting.meetingSequence || 1,
        $or: [{ isFinalized: { $ne: true } }, { isFinalized: { $exists: false } }],
    };

    const setDoc = {
        groupName: payload.groupName || groupDoc.group_name,
        groupCode: payload.groupCode || groupDoc.group_code,
        date: normalizeDateOnly(meeting.meetingDate),
        recoveryDate: parsedDate,
        meetingDate: meeting.meetingDate,
        meetingSequence: meeting.meetingSequence || 1,
        gapDays: meeting.gapDays,
        demandStatus: meeting.demandStatus,
        meetingStatus: "RECOVERED",
        clientRequestId: cid,
        isFinalized: true,
        demandSnapshotVersion: DEMAND_SNAPSHOT_VERSION,
        finalizedAt: new Date(),
        finalizedBy: actor,
        recoveries: recoveriesOut,
        memberCount: recoveriesOut.length,
        totals: payload.totals || {
            totalCash: roundDemand(totalCash),
            totalOnline: roundDemand(totalOnline),
            totalAmount: roundDemand(totalAmount),
        },
        cashDenominations: payload.cashDenominations,
        groupPhoto: payload.groupPhoto,
        status: "approved",
        approvalStatus: "approved",
        createdBy: actor,
        nextMeetingDate: getNextMeetingDate(parsedDate, groupDoc),
    };

    let recovery;

    await withRecoveryLedgerTransaction(async (session) => {
        const skippedChain = await resolveSkippedMeetingSlots(
            groupId,
            groupDoc,
            meeting,
            session
        );
        if (skippedChain.length) {
            await materializeSkippedMeetings({
                groupDoc,
                meetings: skippedChain,
                actor,
                session,
            });
        }

        try {
            const opts = {
                new: true,
                upsert: true,
                runValidators: true,
                setDefaultsOnInsert: true,
            };
            if (session) opts.session = session;

            recovery = await RecoveryMaster.findOneAndUpdate(
                filter,
                { $set: setDoc },
                opts
            );
        } catch (e) {
            if (e.code === 11000) {
                let qExisting = RecoveryMaster.findOne({
                    groupId,
                    meetingDate: meeting.meetingDate,
                    meetingSequence: meeting.meetingSequence || 1,
                }).lean();
                if (session) qExisting = qExisting.session(session);
                const existing = await qExisting;
                if (existing?.isFinalized) {
                    const err = new Error(
                        "Recovery for this meeting is already finalized and cannot be overwritten."
                    );
                    err.code = "RECOVERY_MEETING_LOCKED";
                    throw err;
                }
            }
            throw e;
        }
    });

    await processRecoveryTransactions(recovery, groupDoc, parsedDate, actor);

    return { recovery, idempotent: false };
}
