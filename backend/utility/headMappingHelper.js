import { GroupMaster, ExpenseMaster } from "../model/index.js";

/**
 * Default head mappings with their accounting sections
 * Based on business rules:
 * - Saving take -> assets (money collected from members)
 * - Saving return -> liability (money returned to members)
 * - FD -> assets (FD deposits)
 * - FD Return -> liability (FD maturity payouts)
 * - Loan Distribute -> liability (money given to members)
 * - Loan Recover -> assets (money recovered from members)
 * - Member Fee Group -> income
 * - Member Fee (SHG/Samiti) -> income
 * - Yogdan Pay -> liability (group owes yogdan)
 * - Yogdan Recover -> liability (yogdan collected, reduces liability)
 * - Group Expenses -> expense
 * - Interest to Bank CC -> expense
 * - Interest from Bank -> income
 * - Interest Income -> income
 */
export const DEFAULT_HEAD_MAPPINGS = {
    "Saving": { section: "assets", headType: "groupMaster" },
    "Saving Take": { section: "assets", headType: "groupMaster" },
    "Saving Return": { section: "liability", headType: "groupMaster" },
    "FD": { section: "assets", headType: "groupMaster" },
    "FD Return": { section: "liability", headType: "groupMaster" },
    "Loan Distribute": { section: "liability", headType: "groupMaster" },
    "Loan Recover": { section: "assets", headType: "groupMaster" },
    "Member Fee Group": { section: "income", headType: "groupMaster" },
    "Member Fee": { section: "income", headType: "groupMaster" },
    "Member Fee SHG": { section: "income", headType: "groupMaster" },
    "Member Fee Samiti": { section: "income", headType: "groupMaster" },
    "Yogdan Pay": { section: "liability", headType: "groupMaster" },
    "Yogdan Recover": { section: "liability", headType: "groupMaster" },
    "Group Expenses": { section: "expense", headType: "expenseMaster" },
    "Interest to Bank CC": { section: "expense", headType: "expenseMaster" },
    "Interest from Bank": { section: "income", headType: "expenseMaster" },
    "Interest Income": { section: "income", headType: "groupMaster" },
};

/**
 * Normalize head name for consistent mapping
 * @param {string} headName - Raw head name
 * @returns {string} Normalized head name
 */
export const normalizeHeadName = (headName) => {
    if (!headName || typeof headName !== 'string') {
        return "";
    }

    // Normalize common variations
    const normalized = headName.trim();

    // Map common variations to standard names
    const variations = {
        "saving": "Saving",
        "savings": "Saving",
        "saving take": "Saving Take",
        "saving return": "Saving Return",
        "fd": "FD",
        "fixed deposit": "FD",
        "fd return": "FD Return",
        "loan": "Loan Distribute",
        "loan distribute": "Loan Distribute",
        "loan recover": "Loan Recover",
        "loan recovery": "Loan Recover",
        "member fee": "Member Fee",
        "membership fee": "Member Fee",
        "member fee group": "Member Fee Group",
        "membership fee group": "Member Fee Group",
        "yogdan": "Yogdan Recover",
        "yogdan pay": "Yogdan Pay",
        "yogdan recover": "Yogdan Recover",
        "expense": "Group Expenses",
        "expenses": "Group Expenses",
        "group expense": "Group Expenses",
        "interest": "Interest Income",
        "interest income": "Interest Income",
        "interest from bank": "Interest from Bank",
        "interest to bank": "Interest to Bank CC",
        "interest to bank cc": "Interest to Bank CC",
    };

    const lower = normalized.toLowerCase();
    return variations[lower] || normalized;
};

/**
 * Get head mapping (section and headType) for a given head name
 * @param {string} headName - Head name (will be normalized)
 * @returns {Object} { section, headType } or null if not found
 */
export const getHeadMapping = (headName) => {
    const normalized = normalizeHeadName(headName);
    return DEFAULT_HEAD_MAPPINGS[normalized] || null;
};

/**
 * Find or create a head in GroupMaster.charges
 * @param {string} groupId - Group ID
 * @param {string} headName - Head name
 * @param {string} section - Accounting section (income, expense, assets, liability)
 * @returns {Promise<Object>} { headId, headType } - headId is the charge._id
 */
export const findOrCreateHead = async (groupId, headName, section) => {
    try {
        const normalized = normalizeHeadName(headName);
        const mapping = getHeadMapping(normalized);
        const finalSection = section || mapping?.section || "expense";

        const group = await GroupMaster.findById(groupId);
        if (!group) {
            throw new Error("Group not found");
        }

        // Try to find existing charge with matching name and section
        if (group.charges && group.charges.length > 0) {
            const existingCharge = group.charges.find(
                charge =>
                    (charge.name?.toLowerCase() === normalized.toLowerCase() ||
                        charge.headName?.toLowerCase() === normalized.toLowerCase()) &&
                    charge.entryType === finalSection
            );

            if (existingCharge) {
                // Update headName if not set
                if (!existingCharge.headName) {
                    existingCharge.headName = normalized;
                    await group.save();
                }
                return {
                    headId: existingCharge._id,
                    headType: "groupMaster",
                    headName: normalized,
                    section: finalSection
                };
            }
        }

        // Create new charge if not found
        // Only create if it's a system-defined head (exists in DEFAULT_HEAD_MAPPINGS)
        if (mapping) {
            const newCharge = {
                name: normalized,
                amount: 0, // Default amount, will be updated by actual transactions
                type: "one-time", // Default type
                startDate: new Date(),
                frequency: "yearly",
                isActive: true,
                entryType: finalSection,
                headName: normalized,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            if (!group.charges) {
                group.charges = [];
            }

            group.charges.push(newCharge);
            await group.save();

            const createdCharge = group.charges[group.charges.length - 1];
            return {
                headId: createdCharge._id,
                headType: "groupMaster",
                headName: normalized,
                section: finalSection
            };
        }

        // If not a system-defined head, return null (will use expenseMaster instead)
        return null;
    } catch (error) {
        console.error("[HEAD_MAPPING_HELPER] Error in findOrCreateHead:", error);
        throw error;
    }
};

/**
 * Find or create a head in ExpenseMaster
 * @param {string} groupId - Group ID
 * @param {string} expenseType - Expense type name
 * @param {string} section - Accounting section
 * @returns {Promise<Object>} { headId, headType } - headId is the ExpenseMaster._id
 */
export const findOrCreateExpenseHead = async (groupId, expenseType, section) => {
    try {
        // Try to find existing expense with same type and section
        const existingExpense = await ExpenseMaster.findOne({
            groupId,
            expenseType: expenseType.trim(),
            entryType: section
        }).lean();

        if (existingExpense) {
            return {
                headId: existingExpense._id,
                headType: "expenseMaster",
                headName: expenseType.trim(),
                section: section
            };
        }

        // For expense heads, we don't auto-create master records
        // Instead, use the expense itself as the head
        // This will be handled in the posting service
        return {
            headId: null, // Will be set when expense is created
            headType: "expenseMaster",
            headName: expenseType.trim(),
            section: section
        };
    } catch (error) {
        console.error("[HEAD_MAPPING_HELPER] Error in findOrCreateExpenseHead:", error);
        throw error;
    }
};
