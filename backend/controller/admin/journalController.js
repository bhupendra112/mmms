import apiResponse from "../../utility/apiResponse.js";
import JournalEntry from "../../model/JournalEntry.js";
import JournalLine from "../../model/JournalLine.js";
import { postJournal } from "../../service/journalPostingService.js";
import { getGroupFinanceSummary, getMemberDemandClosingCaps, recalculateDemand } from "../../service/demandService.js";
import { assertVoucherValidForLoan } from "../../service/voucherService.js";

const JV_ALLOWED_HEADS = new Set(["SAVINGS_LIABILITY", "LOAN_RECEIVABLE", "INTEREST_INCOME", "FD_LIABILITY"]);
const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

const getCapByHead = (head, caps) => {
    if (head === "SAVINGS_LIABILITY") return round2(caps?.saving);
    if (head === "LOAN_RECEIVABLE") return round2(caps?.loan);
    if (head === "INTEREST_INCOME") return round2(caps?.interest);
    if (head === "FD_LIABILITY") return round2(caps?.fd);
    return 0;
};

export const createJV = async (req, res) => {
    try {
        const { groupId, date, voucherNumber, lines } = req.body || {};

        if (!groupId || !date || voucherNumber === undefined || voucherNumber === null || voucherNumber === "" || !Array.isArray(lines)) {
            return apiResponse.error(res, "groupId, date, voucherNumber and lines are required", 400);
        }

        const parsedVoucherNumber = parseInt(String(voucherNumber).trim(), 10);
        if (!Number.isInteger(parsedVoucherNumber)) {
            return apiResponse.error(res, "voucherNumber must be a whole number", 400);
        }

        try {
            await assertVoucherValidForLoan({ groupId, voucherNumber: parsedVoucherNumber });
        } catch (ve) {
            return apiResponse.error(res, ve.message || "Invalid voucher", 400);
        }

        const firstMemberId = lines.find((line) => line?.memberId)?.memberId;
        if (!firstMemberId) {
            return apiResponse.error(res, "memberId is required in JV lines", 400);
        }

        const hasMissingMember = lines.some((line) => !line?.memberId);
        if (hasMissingMember) {
            return apiResponse.error(res, "memberId is required on every JV line", 400);
        }

        const hasMultipleMembers = new Set(lines.map((line) => String(line?.memberId || "")).filter(Boolean)).size > 1;
        if (hasMultipleMembers) {
            return apiResponse.error(res, "All JV lines must belong to one member only", 400);
        }

        const demandCaps = await getMemberDemandClosingCaps({ groupId, memberId: firstMemberId });
        let debitLineCount = 0;
        let creditLineCount = 0;
        let totalDebit = 0;
        let totalCredit = 0;

        for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i] || {};
            const head = String(line.accountHead || "").toUpperCase();
            if (!JV_ALLOWED_HEADS.has(head)) {
                return apiResponse.error(res, `Invalid accountHead at line ${i + 1}. Allowed heads: SAVINGS_LIABILITY, LOAN_RECEIVABLE, INTEREST_INCOME, FD_LIABILITY`, 400);
            }
            const debit = round2(line.debit || 0);
            const credit = round2(line.credit || 0);
            if (debit > 0) debitLineCount += 1;
            if (credit > 0) creditLineCount += 1;
            totalDebit = round2(totalDebit + debit);
            totalCredit = round2(totalCredit + credit);
            const cap = getCapByHead(head, demandCaps);
            if (debit > cap) {
                return apiResponse.error(
                    res,
                    `Debit for ${head} at line ${i + 1} cannot exceed demand closing balance (${cap.toFixed(2)})`,
                    400
                );
            }
        }

        if (debitLineCount === 0 || creditLineCount === 0) {
            return apiResponse.error(res, "JV must contain at least one debit line and one credit line", 400);
        }
        if (creditLineCount !== 1) {
            return apiResponse.error(res, "JV must contain exactly one credit line (balancing line)", 400);
        }
        if (totalDebit !== totalCredit) {
            return apiResponse.error(res, "Debit and credit totals must be equal", 400);
        }

        const { entryId, voucherNo } = await postJournal({
            groupId,
            date,
            sourceType: "JV_MANUAL",
            sourceId: groupId,
            lines: lines.map((line) => ({
                accountHead: line.accountHead,
                accountHeadCode: line.accountHeadCode || "",
                debit: line.debit || 0,
                credit: line.credit || 0,
                memberId: line.memberId || undefined,
                bankId: line.bankId || undefined,
                notes: line.notes || "",
            })),
            voucherNumber: parsedVoucherNumber,
            createdBy: req.user?.id || "admin",
        });

        const demandImpactHeads = new Set([
            "LOAN_RECEIVABLE",
            "SAVINGS_LIABILITY",
            "INTEREST_INCOME",
            "FD_LIABILITY",
        ]);

        const impactedMemberIds = [
            ...new Set(
                lines
                    .filter((line) => demandImpactHeads.has(String(line?.accountHead || "").toUpperCase()))
                    .map((line) => line?.memberId)
                    .filter(Boolean)
            ),
        ];

        await Promise.all(
            impactedMemberIds.map((memberId) => recalculateDemand({ memberId, groupId }))
        );

        return apiResponse.success(res, "Journal voucher created successfully", { entryId, voucherNo });
    } catch (error) {
        return apiResponse.error(res, error.message || "Failed to create journal voucher", 500);
    }
};

export const getJVBalancePreview = async (req, res) => {
    try {
        const { groupId } = req.query;
        if (!groupId) {
            return apiResponse.error(res, "groupId is required", 400);
        }

        const financeSummary = await getGroupFinanceSummary({ groupId });
        return apiResponse.success(res, "JV balance preview fetched successfully", {
            financeSummary,
        });
    } catch (error) {
        return apiResponse.error(res, error.message || "Failed to fetch balance preview", 500);
    }
};

export const listJV = async (req, res) => {
    try {
        const { groupId, sourceType, status, fromDate, toDate, page = 1, limit = 20 } = req.query;
        const filter = {};

        if (groupId) filter.groupId = groupId;
        if (sourceType) filter.sourceType = sourceType;
        if (status) filter.status = status;
        if (fromDate || toDate) {
            filter.date = {};
            if (fromDate) filter.date.$gte = new Date(fromDate);
            if (toDate) filter.date.$lte = new Date(toDate);
        }

        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
        const skip = (parsedPage - 1) * parsedLimit;

        const [entries, total] = await Promise.all([
            JournalEntry.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(parsedLimit).lean(),
            JournalEntry.countDocuments(filter),
        ]);

        return apiResponse.success(res, "Journal vouchers fetched successfully", {
            entries,
            pagination: {
                total,
                page: parsedPage,
                limit: parsedLimit,
                totalPages: Math.ceil(total / parsedLimit),
            },
        });
    } catch (error) {
        return apiResponse.error(res, error.message || "Failed to fetch journal vouchers", 500);
    }
};

export const getJVByEntryId = async (req, res) => {
    try {
        const { entryId } = req.params;
        if (!entryId) {
            return apiResponse.error(res, "entryId is required", 400);
        }

        const entry = await JournalEntry.findOne({ entryId }).lean();
        if (!entry) {
            return apiResponse.error(res, "Journal voucher not found", 404);
        }

        const lines = await JournalLine.find({ entryId }).lean();
        return apiResponse.success(res, "Journal voucher detail fetched successfully", { ...entry, lines });
    } catch (error) {
        return apiResponse.error(res, error.message || "Failed to fetch journal voucher detail", 500);
    }
};
