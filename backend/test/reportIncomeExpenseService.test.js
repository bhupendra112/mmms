/**
 * Unit tests for Income/Expense report mapping:
 * - normalizeItemName (ledgerCode match + normalized name match)
 * - unmapped case
 * Run: node backend/test/reportIncomeExpenseService.test.js
 */
import assert from "assert";
import { normalizeItemName } from "../service/reportIncomeExpenseService.js";
import { INCOME_EXPENSE_HEADS_SEED } from "../config/incomeExpenseHeadsSeed.js";

function buildMapFromSeed() {
    const map = new Map();
    for (const h of INCOME_EXPENSE_HEADS_SEED) {
        const key = normalizeItemName(h.itemName);
        if (key) map.set(key, h);
    }
    return map;
}

// --- normalizeItemName ---
assert.strictEqual(normalizeItemName("  INTEREST PAID ON MEMBER SAVINGS  "), "INTEREST PAID ON MEMBER SAVINGS");
assert.strictEqual(normalizeItemName("interest paid on member savings"), "INTEREST PAID ON MEMBER SAVINGS");
assert.strictEqual(normalizeItemName("INTEREST PAID ON MEMBER'S F.D."), "INTEREST PAID ON MEMBERS FD");
assert.strictEqual(normalizeItemName("AUDIT FEES"), "AUDIT FEES");
assert.strictEqual(normalizeItemName(""), "");
assert.strictEqual(normalizeItemName("  multiple   spaces  "), "MULTIPLE SPACES");

// --- normalized name match (seed) ---
const mapping = buildMapFromSeed();
const m1 = mapping.get(normalizeItemName("INTEREST PAID ON MEMBER SAVINGS"));
assert(m1, "INTEREST PAID ON MEMBER SAVINGS should match");
assert.strictEqual(m1.headerName, "INTEREST PAID TO MEMBERS");
assert.strictEqual(m1.ledgerCode, 212);
assert.strictEqual(m1.nature, "EXPENDITURE");

const m2 = mapping.get(normalizeItemName("AUDIT FEES"));
assert(m2, "AUDIT FEES should match");
assert.strictEqual(m2.headerName, "GROUP EXPENSES");
assert.strictEqual(m2.nature, "EXPENDITURE");

const m3 = mapping.get(normalizeItemName("INTEREST ON GENERAL LOAN"));
assert(m3, "INTEREST ON GENERAL LOAN should match");
assert.strictEqual(m3.headerName, "INTEREST RECD ON MEMBER LOAN");
assert.strictEqual(m3.nature, "INCOME");

const m4 = mapping.get(normalizeItemName("MEMBER FEE GROUP"));
assert(m4, "MEMBER FEE GROUP (alias) should match");
assert.strictEqual(m4.headerName, "COLLECTION FROM MEMBER");

// --- unmapped case ---
const unmappedKey = normalizeItemName("SOME UNKNOWN HEAD XYZ");
assert(!mapping.get(unmappedKey), "Unknown head should not match (unmapped)");

console.log("All reportIncomeExpenseService mapping tests passed.");
