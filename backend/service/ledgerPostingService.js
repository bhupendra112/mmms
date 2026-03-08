import GroupLedger from "../model/GroupLedger.js";
import { getHeadMapping, findOrCreateHead, findOrCreateExpenseHead, normalizeHeadName } from "../utility/headMappingHelper.js";

/**
 * Post a transaction to the unified ledger
 * @param {Object} options - Transaction details
 * @param {Object} options.sourceDoc - Source document (RecoveryMaster, LoanMaster, etc.)
 * @param {string} options.headName - Normalized head name
 * @param {string} options.headType - "groupMaster" | "expenseMaster"
 * @param {ObjectId} options.headId - ID from GroupMaster.charges or ExpenseMaster
 * @param {string} options.section - Accounting section (income, expense, assets, liability)
 * @param {number} options.amount - Transaction amount
 * @param {string} options.direction - "in" | "out"
 * @param {ObjectId} options.groupId - Group ID (required)
 * @param {ObjectId} options.memberId - Member ID (optional)
 * @param {Date} options.date - Transaction date
 * @param {string} options.notes - Notes/description (optional)
 * @param {string} options.paymentMode - "Cash" | "Bank" (optional)
 * @param {ObjectId} options.bankId - Bank ID (optional)
 * @param {string} options.referenceModel - Model name (e.g., "RecoveryMaster")
 * @param {ObjectId} options.referenceId - Source document ID
 * @param {string} options.createdBy - Creator ID (optional)
 * @returns {Promise<Object>} Created or updated ledger entry
 */
export const postTransaction = async (options) => {
    try {
        const {
            sourceDoc,
            headName,
            headType,
            headId,
            section,
            amount,
            direction,
            groupId,
            memberId,
            date,
            notes,
            paymentMode,
            bankId,
            referenceModel,
            referenceId,
            createdBy,
            session,
        } = options;

        // Validate required fields
        if (!groupId || !headName || !section || !direction || !amount || !date || !referenceModel || !referenceId) {
            console.error("[LEDGER_POSTING] Missing required fields:", {
                groupId: !!groupId,
                headName: !!headName,
                section: !!section,
                direction: !!direction,
                amount: !!amount,
                date: !!date,
                referenceModel: !!referenceModel,
                referenceId: !!referenceId
            });
            return null;
        }

        // Normalize head name
        const normalizedHeadName = normalizeHeadName(headName);

        // Determine section if not provided (use mapping)
        let finalSection = section;
        if (!finalSection) {
            const mapping = getHeadMapping(normalizedHeadName);
            finalSection = mapping?.section || "expense";
        }

        // Determine headType if not provided
        let finalHeadType = headType;
        if (!finalHeadType) {
            const mapping = getHeadMapping(normalizedHeadName);
            finalHeadType = mapping?.headType || "groupMaster";
        }

        // Find or create head if headId not provided
        let finalHeadId = headId;
        if (!finalHeadId) {
            if (finalHeadType === "groupMaster") {
                const headInfo = await findOrCreateHead(groupId, normalizedHeadName, finalSection, session);
                if (headInfo) {
                    finalHeadId = headInfo.headId;
                    finalHeadType = headInfo.headType;
                } else {
                    // If head creation failed, use a default approach
                    console.warn(`[LEDGER_POSTING] Could not create head for ${normalizedHeadName}, using fallback`);
                    // For now, we'll still create the ledger entry but without headId
                    // This allows backward compatibility
                }
            } else if (finalHeadType === "expenseMaster") {
                // For expenses, the headId will be the expense document itself
                // This is handled when the expense is created
            }
        }

        // Deduplication: RecoveryMaster has multiple entries per recovery (one per head per member); others are one per reference.
        let existingEntry;
        const findOptions = session ? { session } : {};
        if (referenceModel === "RecoveryMaster") {
            existingEntry = await GroupLedger.findOne({
                referenceModel,
                referenceId,
                headName: normalizedHeadName,
                ...(memberId ? { memberId } : {})
            }, null, findOptions);
            if (normalizedHeadName.toLowerCase().includes("penalty")) {
                console.log("[LEDGER_POSTING] RecoveryMaster penalty:", { headName: normalizedHeadName, amount, section: finalSection, existingEntry: !!existingEntry, memberId: memberId?.toString?.() });
            }
        } else {
            existingEntry = await GroupLedger.findOne({
                referenceModel,
                referenceId
            }, null, findOptions);
        }

        const ledgerData = {
            groupId,
            memberId: memberId || undefined,
            headType: finalHeadType,
            headId: finalHeadId || undefined,
            headName: normalizedHeadName,
            section: finalSection,
            direction,
            amount: parseFloat(amount) || 0,
            date: date instanceof Date ? date : new Date(date),
            notes: notes || "",
            referenceModel,
            referenceId,
            paymentMode: paymentMode || undefined,
            bankId: bankId || undefined,
            createdBy: createdBy || "system"
        };

        let ledgerEntry;
        const writeOptions = session ? { session } : {};
        if (existingEntry) {
            // Update existing entry
            Object.assign(existingEntry, ledgerData);
            await existingEntry.save(writeOptions);
            ledgerEntry = existingEntry;
        } else {
            // Create new entry
            ledgerEntry = await GroupLedger.create(ledgerData, writeOptions);
        }

        console.log("[LEDGER_POSTING] Transaction posted:", {
            ledgerId: ledgerEntry._id,
            headName: normalizedHeadName,
            section: finalSection,
            direction,
            amount,
            referenceModel,
            referenceId
        });

        return ledgerEntry;
    } catch (error) {
        console.error("[LEDGER_POSTING] Error posting transaction:", error);
        // Don't throw - ledger posting should not break main transaction flow
        return null;
    }
};

/**
 * Remove ledger entries for a deleted transaction
 * @param {string} referenceModel - Model name
 * @param {ObjectId} referenceId - Source document ID
 * @returns {Promise<boolean>} Success status
 */
export const removeTransaction = async (referenceModel, referenceId) => {
    try {
        const result = await GroupLedger.deleteMany({
            referenceModel,
            referenceId
        });

        console.log("[LEDGER_POSTING] Removed ledger entries:", {
            referenceModel,
            referenceId,
            deletedCount: result.deletedCount
        });

        return result.deletedCount > 0;
    } catch (error) {
        console.error("[LEDGER_POSTING] Error removing transaction:", error);
        return false;
    }
};

/**
 * Update ledger entries when a transaction is modified
 * This is a wrapper that removes old entries and creates new ones
 * @param {string} referenceModel - Model name
 * @param {ObjectId} referenceId - Source document ID
 * @param {Array<Object>} newTransactions - Array of transaction options to post
 * @returns {Promise<Array>} Created ledger entries
 */
export const updateTransaction = async (referenceModel, referenceId, newTransactions) => {
    try {
        // Remove old entries
        await removeTransaction(referenceModel, referenceId);

        // Create new entries
        const results = [];
        for (const tx of newTransactions) {
            const entry = await postTransaction({
                ...tx,
                referenceModel,
                referenceId
            });
            if (entry) {
                results.push(entry);
            }
        }

        return results;
    } catch (error) {
        console.error("[LEDGER_POSTING] Error updating transaction:", error);
        return [];
    }
};
