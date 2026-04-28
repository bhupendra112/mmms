import VoucherRange from "../model/VoucherRange.js";
import LoanMaster from "../model/LoanMaster.js";
import JournalEntry from "../model/JournalEntry.js";

export async function getActiveRange(groupId) {
    if (!groupId) return null;
    return VoucherRange.findOne({ groupId, isActive: true })
        .sort({ priority: 1, createdAt: 1 })
        .lean();
}

export async function getRangesByGroup(groupId) {
    if (!groupId) return [];
    return VoucherRange.find({ groupId })
        .sort({ priority: 1, createdAt: 1 })
        .lean();
}

export async function getActiveRanges(groupId) {
    if (!groupId) return [];
    return VoucherRange.find({ groupId, isActive: true })
        .sort({ priority: 1, createdAt: 1 })
        .lean();
}

export async function assertVoucherValidForLoan({ groupId, voucherNumber }) {
    const ranges = await getActiveRanges(groupId);
    if (!ranges.length) {
        throw new Error("No active voucher range configured for this group. Configure it in Voucher Management.");
    }
    if (!Number.isInteger(voucherNumber)) {
        throw new Error("Voucher number must be a whole number.");
    }

    const inAnyRange = ranges.some((range) => {
        const start = Math.min(range.startNumber, range.endNumber);
        const end = Math.max(range.startNumber, range.endNumber);
        return voucherNumber >= start && voucherNumber <= end;
    });

    if (!inAnyRange) {
        throw new Error("Voucher number does not belong to any active voucher range for this group.");
    }

    const [loanUsed, journalUsed] = await Promise.all([
        LoanMaster.findOne({
            groupId,
            voucherNumber,
        })
            .select("_id")
            .lean(),
        JournalEntry.findOne({
            groupId,
            voucherNumber,
        })
            .select("_id")
            .lean(),
    ]);
    if (loanUsed || journalUsed) {
        throw new Error("This voucher number is already in use for this group.");
    }
}

export async function suggestNextVoucherNumber(groupId) {
    const ranges = await getActiveRanges(groupId);
    if (!ranges.length) {
        throw new Error("No active voucher range configured for this group.");
    }

    const [loanUsedDocs, journalUsedDocs] = await Promise.all([
        LoanMaster.find({
            groupId,
            voucherNumber: { $exists: true, $ne: null },
        })
            .select("voucherNumber")
            .lean(),
        JournalEntry.find({
            groupId,
            voucherNumber: { $exists: true, $ne: null },
        })
            .select("voucherNumber")
            .lean(),
    ]);
    const usedDocs = [...loanUsedDocs, ...journalUsedDocs];
    const usedSet = new Set(
        usedDocs.map((d) => d.voucherNumber).filter((n) => Number.isInteger(n))
    );

    for (const range of ranges) {
        const start = Math.min(range.startNumber, range.endNumber);
        const end = Math.max(range.startNumber, range.endNumber);
        if (!Number.isFinite(start) || !Number.isFinite(end)) {
            continue;
        }
        for (let n = start; n <= end; n += 1) {
            if (!usedSet.has(n)) return n;
        }
    }

    throw new Error("All voucher ranges exhausted");
}

export async function setActiveRangeForGroup(groupId, startNumber, endNumber, priority = 0) {
    const s = parseInt(String(startNumber), 10);
    const e = parseInt(String(endNumber), 10);
    const p = Number.isFinite(Number(priority)) ? Number(priority) : 0;
    if (!Number.isFinite(s) || !Number.isFinite(e)) {
        throw new Error("startNumber and endNumber must be valid numbers.");
    }
    if (!Number.isInteger(s) || !Number.isInteger(e)) {
        throw new Error("startNumber and endNumber must be whole numbers.");
    }
    if (s < 0 || e < 0) {
        throw new Error("Voucher numbers cannot be negative.");
    }

    const start = Math.min(s, e);
    const end = Math.max(s, e);
    const existingRanges = await VoucherRange.find({ groupId })
        .select("startNumber endNumber")
        .lean();

    for (const existing of existingRanges) {
        const existingStart = Math.min(existing.startNumber, existing.endNumber);
        const existingEnd = Math.max(existing.startNumber, existing.endNumber);
        const overlaps = start <= existingEnd && end >= existingStart;
        if (overlaps) {
            throw new Error(
                `Voucher range overlaps with existing range ${existingStart}-${existingEnd}.`
            );
        }
    }

    const doc = await VoucherRange.create({
        groupId,
        startNumber: s,
        endNumber: e,
        priority: p,
        isActive: true,
    });
    return doc;
}

const SOURCE_PREFIX_MAP = {
    LOAN: "LOAN",
    RECOVERY: "REC",
    PAYMENT: "PAY",
    CASH_BANK: "CB",
    JV_MANUAL: "JV",
};

export async function generateJournalVoucherNo({ groupId, sourceType, date = new Date(), session } = {}) {
    if (!groupId) {
        throw new Error("groupId is required to generate journal voucher number.");
    }

    const prefix = SOURCE_PREFIX_MAP[sourceType] || "JV";
    const voucherDate = date instanceof Date ? date : new Date(date);
    const year = Number.isNaN(voucherDate.getTime()) ? new Date().getFullYear() : voucherDate.getFullYear();
    const voucherPrefix = `${prefix}-${year}`;
    const voucherPattern = new RegExp(`^${voucherPrefix}-\\d+$`);
    const findOptions = session ? { session } : {};

    const lastVoucher = await JournalEntry.findOne(
        { groupId, voucherNo: { $regex: voucherPattern } },
        null,
        findOptions
    )
        .sort({ voucherNo: -1 })
        .select("voucherNo")
        .lean();

    let nextSequence = 1;
    if (lastVoucher?.voucherNo) {
        const parts = String(lastVoucher.voucherNo).split("-");
        const parsed = parseInt(parts[parts.length - 1], 10);
        if (Number.isInteger(parsed)) {
            nextSequence = parsed + 1;
        }
    }

    const sequence = String(nextSequence).padStart(6, "0");
    return `${voucherPrefix}-${sequence}`;
}
