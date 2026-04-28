import JournalEntry from "../model/JournalEntry.js";
import JournalLine from "../model/JournalLine.js";
import { generateJournalVoucherNo } from "./voucherService.js";

const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

const validateLines = (lines = []) => {
    if (!Array.isArray(lines) || lines.length < 2) {
        throw new Error("Journal requires at least two lines.");
    }

    let totalDebit = 0;
    let totalCredit = 0;

    const normalized = lines.map((line, index) => {
        const debit = round2(line?.debit);
        const credit = round2(line?.credit);

        if (debit < 0 || credit < 0) {
            throw new Error(`Negative debit/credit is not allowed at line ${index + 1}.`);
        }
        if (debit > 0 && credit > 0) {
            throw new Error(`A line cannot have both debit and credit at line ${index + 1}.`);
        }
        if (debit <= 0 && credit <= 0) {
            throw new Error(`A line must have either debit or credit at line ${index + 1}.`);
        }
        if (!line?.accountHead) {
            throw new Error(`accountHead is required at line ${index + 1}.`);
        }

        totalDebit += debit;
        totalCredit += credit;

        return {
            accountHead: String(line.accountHead).trim(),
            accountHeadCode: line.accountHeadCode || "",
            debit,
            credit,
            memberId: line.memberId || undefined,
            bankId: line.bankId || undefined,
            notes: line.notes || "",
        };
    });

    totalDebit = round2(totalDebit);
    totalCredit = round2(totalCredit);
    if (totalDebit !== totalCredit) {
        throw new Error(`Journal is not balanced. debit=${totalDebit}, credit=${totalCredit}`);
    }

    return { normalized, totalDebit, totalCredit };
};

export const postJournal = async ({
    groupId,
    date,
    sourceType,
    sourceId,
    lines,
    voucherNumber,
    createdBy,
    session,
}) => {
    if (!groupId) throw new Error("groupId is required");
    if (!sourceType) throw new Error("sourceType is required");
    if (!sourceId) throw new Error("sourceId is required");
    if (!date) throw new Error("date is required");

    const journalDate = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(journalDate.getTime())) {
        throw new Error("Invalid journal date");
    }

    const { normalized, totalDebit, totalCredit } = validateLines(lines);
    const voucherNo = Number.isInteger(voucherNumber)
        ? String(voucherNumber)
        : await generateJournalVoucherNo({ groupId, sourceType, date: journalDate, session });

    const createOptions = session ? { session } : {};

    const entry = await JournalEntry.create(
        [
            {
                voucherNo,
                ...(Number.isInteger(voucherNumber) ? { voucherNumber } : {}),
                groupId,
                date: journalDate,
                sourceType,
                sourceId,
                status: "POSTED",
                totalDebit,
                totalCredit,
                createdBy: createdBy || "system",
            },
        ],
        createOptions
    );

    const savedEntry = entry[0];
    const linesToInsert = normalized.map((line) => ({
        ...line,
        entryId: savedEntry.entryId,
    }));
    await JournalLine.insertMany(linesToInsert, createOptions);

    return {
        entryId: savedEntry.entryId,
        voucherNo: savedEntry.voucherNo,
    };
};
