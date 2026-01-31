import GroupLedger from "../model/GroupLedger.js";
import GroupMaster from "../model/GroupMaster.js";
import IncomeExpenseHead from "../model/IncomeExpenseHead.js";
import ExpenseMaster from "../model/ExpenseMaster.js";
import { INCOME_EXPENSE_HEADS_SEED } from "../config/incomeExpenseHeadsSeed.js";

/**
 * Normalize item/head name for matching: trim, collapse spaces, case-insensitive, ignore punctuation like . and '
 */
export function normalizeItemName(str) {
    if (!str || typeof str !== "string") return "";
    return str
        .trim()
        .replace(/['.]/g, "")
        .replace(/\s+/g, " ")
        .toUpperCase();
}

/**
 * Ensure IncomeExpenseHead collection has seed data (upsert by itemName + nature).
 * Always upsert from seed so new/updated rows (e.g. PENALTY, PENALTY FROM MEMBERS) are present.
 */
export async function seedIncomeExpenseHeads() {
    for (const row of INCOME_EXPENSE_HEADS_SEED) {
        await IncomeExpenseHead.findOneAndUpdate(
            { itemName: row.itemName, nature: row.nature },
            { $set: row },
            { upsert: true, new: true }
        );
    }
}

/**
 * Get mapping: normalized ItemName -> { itemName, ledgerCode, headerName, headerCode, nature }
 * Uses DB first; if empty, uses seed in-memory for matching.
 */
async function getMapping() {
    await seedIncomeExpenseHeads();
    const heads = await IncomeExpenseHead.find({}).lean();
    const map = new Map();
    for (const h of heads) {
        const key = normalizeItemName(h.itemName);
        if (!key) continue;
        map.set(key, {
            itemName: h.itemName,
            ledgerCode: h.ledgerCode,
            headerName: h.headerName,
            headerCode: h.headerCode,
            nature: h.nature,
        });
    }
    return map;
}

/**
 * Build Income/Expense report for a group and date range.
 * Transaction source: GroupLedger (section income/expense) - each entry has headName and amount.
 * Matching: normalize headName to ItemName (LedgerCode is not stored in GroupLedger, so we match by name only).
 */
export async function buildIncomeExpenseReport(groupId, fromDate, toDate) {
    const mapping = await getMapping();

    // GroupMaster charges: head name -> entryType (income | expense). expense = Expenditure.
    const group = await GroupMaster.findById(groupId).select("charges").lean();
    const chargeMap = new Map();
    if (group?.charges?.length) {
        for (const c of group.charges) {
            const key = normalizeItemName(c.name);
            if (key) chargeMap.set(key, { name: c.name, entryType: c.entryType || "expense" });
        }
    }

    const dateFilter =
        fromDate && toDate
            ? { date: { $gte: new Date(fromDate), $lte: new Date(toDate) } }
            : {};

    const ledgerEntries = await GroupLedger.find({
        groupId,
        section: { $in: ["income", "expense", "expenditure"] },
        ...dateFilter,
    })
        .lean();

    // For entries from ExpenseMaster, use entryType from the master (expense/expenditure = expenditure).
    const expenseRefIds = [...new Set(ledgerEntries.filter((e) => e.referenceModel === "ExpenseMaster" && e.referenceId).map((e) => e.referenceId))];
    const expenseEntryTypeMap = new Map();
    if (expenseRefIds.length > 0) {
        const docs = await ExpenseMaster.find({ _id: { $in: expenseRefIds } }).select("entryType").lean();
        for (const d of docs) expenseEntryTypeMap.set(d._id.toString(), d.entryType);
    }

    const incomeByHeader = new Map(); // headerName -> { headerCode, items: Map(itemName -> { ledgerCode, amount }) }
    const expenditureByHeader = new Map();
    const unmapped = [];

    const CHARGES_INCOME_HEADER = "GROUP CHARGES (INCOME)";
    const CHARGES_EXPENDITURE_HEADER = "GROUP CHARGES (EXPENDITURE)";
    const OTHER_INCOME_HEADER = "OTHER INCOME";
    const OTHER_EXPENDITURE_HEADER = "OTHER EXPENDITURE";

    for (const entry of ledgerEntries) {
        const rawName = entry.headName || "";
        const normalized = normalizeItemName(rawName);
        const amount = Number(entry.amount) || 0;
        const dateStr = entry.date ? new Date(entry.date).toISOString().slice(0, 10) : "";

        // 2) ExpenseMaster first: create a new head per headName (no matching). So fee and charges always show as separate expenditure headers.
        if (entry.referenceModel === "ExpenseMaster") {
            let effectiveSection = entry.section;
            if (entry.referenceId) {
                const masterEntryType = expenseEntryTypeMap.get(entry.referenceId.toString());
                if (masterEntryType !== undefined) effectiveSection = masterEntryType;
            }
            if (effectiveSection === "expenditure") effectiveSection = "expense";
            const isIncome = effectiveSection === "income";
            const target = isIncome ? incomeByHeader : expenditureByHeader;
            const headName = (rawName && String(rawName).trim()) || "(blank)";
            const headerCode = isIncome ? 1 : 2;
            if (!target.has(headName)) {
                target.set(headName, { headerName: headName, headerCode, items: new Map() });
            }
            const header = target.get(headName);
            const itemKey = entry._id ? String(entry._id) : `${entry.referenceId || ""}-${rawName}-${dateStr}`;
            if (!header.items.has(itemKey)) {
                header.items.set(itemKey, { itemName: headName, ledgerCode: null, amount: 0 });
            }
            header.items.get(itemKey).amount += amount;
            continue;
        }

        // 1) GroupMaster charges (non-ExpenseMaster): use charge.entryType (income | expense). expense and expenditure = Expenditure.
        const chargeDef = chargeMap.get(normalized);
        if (chargeDef) {
            const chargeEntryType = chargeDef.entryType === "expenditure" ? "expense" : chargeDef.entryType;
            const isIncome = chargeEntryType === "income";
            const target = isIncome ? incomeByHeader : expenditureByHeader;
            const headerName = isIncome ? CHARGES_INCOME_HEADER : CHARGES_EXPENDITURE_HEADER;
            const headerCode = isIncome ? 1 : 2;
            if (!target.has(headerName)) {
                target.set(headerName, { headerName, headerCode, items: new Map() });
            }
            const header = target.get(headerName);
            const itemName = chargeDef.name;
            if (!header.items.has(itemName)) {
                header.items.set(itemName, { itemName, ledgerCode: null, amount: 0 });
            }
            header.items.get(itemName).amount += amount;
            continue;
        }

        // 3) Other entries: use ledger section and IncomeExpenseHead mapping.
        let effectiveSection = entry.section;
        if (entry.referenceModel === "ExpenseMaster" && entry.referenceId) {
            const masterEntryType = expenseEntryTypeMap.get(entry.referenceId.toString());
            if (masterEntryType !== undefined) effectiveSection = masterEntryType;
        }
        if (effectiveSection === "expenditure") effectiveSection = "expense";
        const isIncome = effectiveSection === "income";
        const target = isIncome ? incomeByHeader : expenditureByHeader;

        const info = mapping.get(normalized);
        if (info) {
            if (!target.has(info.headerName)) {
                target.set(info.headerName, {
                    headerName: info.headerName,
                    headerCode: info.headerCode,
                    items: new Map(),
                });
            }
            const header = target.get(info.headerName);
            if (!header.items.has(info.itemName)) {
                header.items.set(info.itemName, { itemName: info.itemName, ledgerCode: info.ledgerCode, amount: 0 });
            }
            header.items.get(info.itemName).amount += amount;
        } else {
            if (entry.referenceModel === "ExpenseMaster") {
                // Create a new head per headName (no matching needed); each ExpenseMaster entry gets its own header so none is missing
                const headName = (rawName && String(rawName).trim()) || "(blank)";
                const headerCode = isIncome ? 1 : 2;
                if (!target.has(headName)) {
                    target.set(headName, { headerName: headName, headerCode, items: new Map() });
                }
                const header = target.get(headName);
                const itemKey = entry._id ? String(entry._id) : `${entry.referenceId || ""}-${rawName}-${dateStr}`;
                if (!header.items.has(itemKey)) {
                    header.items.set(itemKey, { itemName: headName, ledgerCode: null, amount: 0 });
                }
                header.items.get(itemKey).amount += amount;
            } else {
                unmapped.push({
                    sourceName: rawName || "(blank)",
                    amount,
                    date: dateStr,
                    bucket: isIncome ? "income" : "expenditure",
                });
            }
        }
    }

    const toHeaderList = (byHeader) => {
        return Array.from(byHeader.values())
            .map((h) => ({
                headerName: h.headerName,
                headerCode: h.headerCode,
                total: Array.from(h.items.values()).reduce((s, i) => s + i.amount, 0),
                items: Array.from(h.items.values())
                    .map((i) => ({ itemName: i.itemName, ledgerCode: i.ledgerCode, amount: Math.round(i.amount * 100) / 100 }))
                    .sort((a, b) => (a.itemName || "").localeCompare(b.itemName || "")),
            }))
            .sort((a, b) => (a.headerName || "").localeCompare(b.headerName || ""));
    };

    const incomeHeaders = toHeaderList(incomeByHeader);
    const expenditureHeaders = toHeaderList(expenditureByHeader);

    const unmappedIncomeTotal = unmapped.filter((u) => u.bucket === "income").reduce((s, u) => s + u.amount, 0);
    const unmappedExpenditureTotal = unmapped.filter((u) => u.bucket === "expenditure").reduce((s, u) => s + u.amount, 0);

    const totalIncome = incomeHeaders.reduce((s, h) => s + h.total, 0) + unmappedIncomeTotal;
    const totalExpenditure = expenditureHeaders.reduce((s, h) => s + h.total, 0) + unmappedExpenditureTotal;
    const surplusOrDeficit = totalIncome - totalExpenditure;

    const fromStr = fromDate ? new Date(fromDate).toISOString().slice(0, 10) : null;
    const toStr = toDate ? new Date(toDate).toISOString().slice(0, 10) : null;

    const unmappedRounded = unmapped.map((u) => ({ ...u, amount: Math.round(u.amount * 100) / 100 }));

    // Heads from GroupMaster.charges with entryType and paid amount (for showing in UI)
    const chargesHeads = [];
    if (group?.charges?.length) {
        const incomeCharges = incomeHeaders.find((h) => h.headerName === CHARGES_INCOME_HEADER);
        const expenditureCharges = expenditureHeaders.find((h) => h.headerName === CHARGES_EXPENDITURE_HEADER);
        for (const c of group.charges) {
            const entryType = c.entryType || "expense";
            const items = entryType === "income" ? incomeCharges?.items : expenditureCharges?.items;
            const item = items?.find((i) => i.itemName === c.name);
            const paidAmount = item ? Math.round(item.amount * 100) / 100 : 0;
            chargesHeads.push({
                headName: c.name,
                entryType,
                paidAmount,
            });
        }
    }

    return {
        groupId: groupId.toString(),
        fromDate: fromStr,
        toDate: toStr,
        income: {
            total: Math.round(totalIncome * 100) / 100,
            headers: incomeHeaders.map((h) => ({ ...h, total: Math.round(h.total * 100) / 100 })),
        },
        expenditure: {
            total: Math.round(totalExpenditure * 100) / 100,
            headers: expenditureHeaders.map((h) => ({ ...h, total: Math.round(h.total * 100) / 100 })),
        },
        surplusOrDeficit: Math.round(surplusOrDeficit * 100) / 100,
        chargesHeads,
        unmapped: {
            count: unmapped.length,
            total: Math.round((unmappedIncomeTotal + unmappedExpenditureTotal) * 100) / 100,
            incomeTotal: Math.round(unmappedIncomeTotal * 100) / 100,
            expenditureTotal: Math.round(unmappedExpenditureTotal * 100) / 100,
            items: unmappedRounded,
        },
    };
}
