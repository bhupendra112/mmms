import VoucherRange from "../model/VoucherRange.js";
import LoanMaster from "../model/LoanMaster.js";

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

    const used = await LoanMaster.findOne({
        groupId,
        voucherNumber,
    })
        .select("_id")
        .lean();
    if (used) {
        throw new Error("This voucher number is already in use for this group.");
    }
}

export async function suggestNextVoucherNumber(groupId) {
    const ranges = await getActiveRanges(groupId);
    if (!ranges.length) {
        throw new Error("No active voucher range configured for this group.");
    }

    const usedDocs = await LoanMaster.find({
        groupId,
        voucherNumber: { $exists: true, $ne: null },
    })
        .select("voucherNumber")
        .lean();
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
