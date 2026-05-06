import mongoose from "mongoose";

/**
 * MEETING UNIQUENESS: meetingKey = groupId + meetingDate + meetingSequence
 * IMMUTABILITY: isFinalized snapshots are read-only (enforced via hooks + recoveryWriter)
 */

export class RecoverySnapshotImmutableError extends Error {
    constructor(recoveryId) {
        super(`Recovery snapshot is immutable: ${recoveryId}`);
        this.name = "RecoverySnapshotImmutableError";
        this.code = "RECOVERY_SNAPSHOT_IMMUTABLE";
    }
}

const LoanSnapshotRowSchema = new mongoose.Schema({
    loanId: { type: mongoose.Schema.Types.ObjectId, ref: "LoanMaster" },
    principalSnapshot: { type: Number, default: 0 },
    interestRateSnapshot: { type: Number, default: 0 },
    daysCounted: { type: Number, default: 0 },
    interestComputed: { type: Number, default: 0 },
    loanStartCutoff: { type: Date },
    loanEndCutoff: { type: Date },
    loanDisburseDateYmd: { type: String },
    loanPurpose: { type: String },
}, { _id: false });

const RecoveryMasterSchema = new mongoose.Schema({
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GroupMaster",
        required: true,
    },
    groupName: { type: String, required: true },
    groupCode: { type: String },

    // Recovery session details — legacy `date` kept for backward-compatible reads
    date: { type: Date, required: true },
    recoveryDate: { type: Date },
    MeetingDate: { type: Date },
    meetingDate: { type: Date },
    meetingSequence: { type: Number, default: 1, enum: [1, 2] },
    meetingStatus: {
        type: String,
        enum: ["RECOVERED", "SKIPPED_MEETING"],
        default: "RECOVERED",
    },
    gapDays: { type: Number },
    demandStatus: {
        type: String,
        enum: ["NORMAL_DEMAND", "MISSING_DEMAND"],
    },
    clientRequestId: { type: String },
    isFinalized: { type: Boolean, default: false },
    demandSnapshotVersion: { type: Number, default: 1 },
    finalizedAt: { type: Date },
    finalizedBy: { type: String },
    memberCount: { type: Number, default: 0 },
    groupPhoto: { type: String },

    // Individual member recoveries
    recoveries: [{
        memberId: { type: String, required: true },
        memberCode: { type: String, required: true },
        memberName: { type: String, required: true },
        attendance: { type: String, enum: ["present", "absent"], default: "present" },
        recoveryByOther: { type: Boolean, default: false },
        otherMemberId: { type: String },
        loanSnapshots: { type: [LoanSnapshotRowSchema], default: [] },
        amounts: {
            saving: { type: Number, default: 0 },
            loan: { type: Number, default: 0 },
            interest: { type: Number, default: 0 },
            yogdan: { type: Number, default: 0 },
            memFeesSHG: { type: Number, default: 0 },
            memFeesSamiti: { type: Number, default: 0 },
            memFeesGroup: { type: Number, default: 0 },
            penalty: { type: Number, default: 0 },
            other: { type: Number, default: 0 },
            fd: { type: Number, default: 0 },
            charges: { type: mongoose.Schema.Types.Mixed, default: {} },
        },
        fd_time_period: { type: Number },
        fd_rate_snapshot: { type: Number },
        paymentMode: {
            cash: { type: Boolean, default: false },
            online: { type: Boolean, default: false },
        },
        onlineRef: { type: String },
        bankId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "BankMaster",
        },
        screenshot: { type: String },
        total: { type: Number, default: 0 },
        demandDetails: {
            loan: {
                prevDemand: { type: Number, default: 0 },
                currDemand: { type: Number, default: 0 },
                totalDemand: { type: Number, default: 0 },
                actualPaid: { type: Number, default: 0 },
                unpaidDemand: { type: Number, default: 0 },
                openingBalance: { type: Number, default: 0 },
                closingBalance: { type: Number, default: 0 },
            },
            interest: {
                prevDemand: { type: Number, default: 0 },
                currDemand: { type: Number, default: 0 },
                totalDemand: { type: Number, default: 0 },
                actualPaid: { type: Number, default: 0 },
                unpaidDemand: { type: Number, default: 0 },
                openingBalance: { type: Number, default: 0 },
                closingBalance: { type: Number, default: 0 },
            },
            saving: {
                prevDemand: { type: Number, default: 0 },
                currDemand: { type: Number, default: 0 },
                totalDemand: { type: Number, default: 0 },
                actualPaid: { type: Number, default: 0 },
                unpaidDemand: { type: Number, default: 0 },
                openingBalance: { type: Number, default: 0 },
                closingBalance: { type: Number, default: 0 },
            },
            fd: {
                prevDemand: { type: Number, default: 0 },
                currDemand: { type: Number, default: 0 },
                totalDemand: { type: Number, default: 0 },
                actualPaid: { type: Number, default: 0 },
                unpaidDemand: { type: Number, default: 0 },
                openingBalance: { type: Number, default: 0 },
                closingBalance: { type: Number, default: 0 },
            },
            yogdan: {
                prevDemand: { type: Number, default: 0 },
                currDemand: { type: Number, default: 0 },
                totalDemand: { type: Number, default: 0 },
                actualPaid: { type: Number, default: 0 },
                unpaidDemand: { type: Number, default: 0 },
                openingBalance: { type: Number, default: 0 },
                closingBalance: { type: Number, default: 0 },
            },
            memFeesSHG: {
                prevDemand: { type: Number, default: 0 },
                currDemand: { type: Number, default: 0 },
                totalDemand: { type: Number, default: 0 },
                actualPaid: { type: Number, default: 0 },
                unpaidDemand: { type: Number, default: 0 },
            },
            memFeesGroup: {
                prevDemand: { type: Number, default: 0 },
                currDemand: { type: Number, default: 0 },
                totalDemand: { type: Number, default: 0 },
                actualPaid: { type: Number, default: 0 },
                unpaidDemand: { type: Number, default: 0 },
            },
            penalty: {
                prevDemand: { type: Number, default: 0 },
                currDemand: { type: Number, default: 0 },
                totalDemand: { type: Number, default: 0 },
                actualPaid: { type: Number, default: 0 },
                unpaidDemand: { type: Number, default: 0 },
            },
            charges: {
                prevDemand: { type: mongoose.Schema.Types.Mixed, default: {} },
                currDemand: { type: mongoose.Schema.Types.Mixed, default: {} },
                totalDemand: { type: Number, default: 0 },
                actualPaid: { type: mongoose.Schema.Types.Mixed, default: {} },
                unpaidDemand: { type: mongoose.Schema.Types.Mixed, default: {} },
                unpaidDemandTotal: { type: Number, default: 0 },
            },
            missingDemand: { type: mongoose.Schema.Types.Mixed },
        },
    }],

    totals: {
        totalCash: { type: Number, default: 0 },
        totalOnline: { type: Number, default: 0 },
        totalAmount: { type: Number, default: 0 },
    },

    cashDenominations: {
        note200: { type: Number, default: 0 },
        note500: { type: Number, default: 0 },
        note100: { type: Number, default: 0 },
        note50: { type: Number, default: 0 },
        note20: { type: Number, default: 0 },
        note10: { type: Number, default: 0 },
        note5: { type: Number, default: 0 },
        note2: { type: Number, default: 0 },
        note1: { type: Number, default: 0 },
    },

    status: { type: String, enum: ["approved", "rejected"], default: "approved" },

    approvalStatus: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "approved",
    },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    rejectedBy: { type: String },
    rejectedAt: { type: Date },
    rejectionReason: { type: String },

    createdBy: { type: String },
    journalEntryId: { type: String },

}, {
    timestamps: true,
});

RecoveryMasterSchema.index({ groupId: 1, date: 1 }, { unique: true });
RecoveryMasterSchema.index(
    { groupId: 1, meetingDate: 1, meetingSequence: 1 },
    {
        unique: true,
        partialFilterExpression: { meetingDate: { $exists: true, $type: "date" } },
    }
);
RecoveryMasterSchema.index(
    { groupId: 1, clientRequestId: 1 },
    {
        unique: true,
        partialFilterExpression: { clientRequestId: { $exists: true, $type: "string", $ne: "" } },
    }
);
RecoveryMasterSchema.index({ 'recoveries.memberId': 1, date: 1 });
RecoveryMasterSchema.index({ groupId: 1, date: 1, 'recoveries.memberId': 1 });

/** Only non-financial metadata may change once isFinalized is true. */
const ALLOW_FINALIZED_META = new Set(["groupPhoto"]);

function collectAffectedTopLevelKeys(update) {
    const keys = new Set();
    if (!update || typeof update !== "object") return keys;
    for (const op of [
        "$set",
        "$unset",
        "$inc",
        "$push",
        "$pull",
        "$mul",
        "$rename",
        "$pop",
        "$min",
        "$max",
        "$setOnInsert",
        "$currentDate",
    ]) {
        if (update[op] && typeof update[op] === "object") {
            for (const k of Object.keys(update[op])) {
                keys.add(String(k).split(".")[0]);
            }
        }
    }
    for (const k of Object.keys(update)) {
        if (!k.startsWith("$")) keys.add(String(k).split(".")[0]);
    }
    return keys;
}

async function assertFinalizeMetaOnlyOrReject(query, model, updateLike, opts = {}) {
    const session = opts.session || undefined;
    let q = model.findOne(query).select({ isFinalized: 1, _id: 1 });
    if (session) q = q.session(session);
    const doc = await q.lean();
    if (!doc?.isFinalized) return;

    const keys = collectAffectedTopLevelKeys(updateLike || {});
    for (const k of keys) {
        if (!ALLOW_FINALIZED_META.has(k)) {
            throw new RecoverySnapshotImmutableError(doc._id);
        }
    }
}

RecoveryMasterSchema.pre("findOneAndUpdate", async function () {
    const opts = this.getOptions() || {};
    await assertFinalizeMetaOnlyOrReject(
        this.getQuery(),
        this.model,
        this.getUpdate() || {},
        { session: opts.session }
    );
});

RecoveryMasterSchema.pre("updateOne", async function () {
    await assertFinalizeMetaOnlyOrReject(
        this.getQuery(),
        this.model,
        this.getUpdate() || {}
    );
});

RecoveryMasterSchema.pre("replaceOne", async function () {
    const rep = this.getUpdate() || {};
    await assertFinalizeMetaOnlyOrReject(this.getQuery(), this.model, rep);
});

RecoveryMasterSchema.pre("save", async function () {
    if (this.isNew) return;
    const existing = await mongoose
        .model("RecoveryMaster")
        .findById(this._id)
        .select({ isFinalized: 1 })
        .lean();
    if (!existing?.isFinalized) return;

    for (const path of this.modifiedPaths()) {
        const top = path.split(".")[0];
        if (!ALLOW_FINALIZED_META.has(top)) {
            throw new RecoverySnapshotImmutableError(this._id);
        }
    }
});

RecoveryMasterSchema.pre("deleteOne", { document: false, query: true }, async function () {
    const doc = await this.model
        .findOne(this.getQuery())
        .select({ isFinalized: 1, _id: 1 })
        .lean();
    if (doc?.isFinalized) {
        throw new RecoverySnapshotImmutableError(doc._id);
    }
});

RecoveryMasterSchema.pre("findOneAndDelete", async function () {
    const doc = await this.model
        .findOne(this.getQuery())
        .select({ isFinalized: 1, _id: 1 })
        .lean();
    if (doc?.isFinalized) {
        throw new RecoverySnapshotImmutableError(doc._id);
    }
});

const RecoveryMaster = mongoose.model("RecoveryMaster", RecoveryMasterSchema);
export default RecoveryMaster;
