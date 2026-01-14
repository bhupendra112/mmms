import mongoose from "mongoose";
import { CashAmount, GroupMaster } from '../../model/index.js';
import apiResponse from "../../utility/apiResponse.js";
import message from "../../utility/message.js";
import { verifyGroupAccess } from "../../utility/groupAccessHelper.js";

/**
 * Internal helper function to add cash amount (can be called directly)
 * @param {String} groupId - Group ID (ObjectId or string)
 * @param {Number} amount - Amount to add
 * @returns {Promise<Object>} Updated cash amount info
 */
export const addCashAmountInternal = async (groupId, amount) => {
    console.log("[CASH_AMOUNT] addCashAmountInternal called:", { groupId, amount, groupIdType: typeof groupId });

    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'cashAmountController.js:12', message: 'addCashAmountInternal entry', data: { groupId: groupId?.toString(), amount }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D' }) }).catch(() => { });
    // #endregion

    try {
        // Convert groupId to ObjectId
        let groupObjectId;
        if (groupId instanceof mongoose.Types.ObjectId) {
            groupObjectId = groupId;
        } else {
            try {
                groupObjectId = new mongoose.Types.ObjectId(groupId);
            } catch (error) {
                console.error("[CASH_AMOUNT] Invalid group ID format:", groupId, error);
                throw new Error("Invalid group ID format");
            }
        }

        // Verify group exists
        console.log("[CASH_AMOUNT] Looking up group:", groupObjectId);
        const group = await GroupMaster.findById(groupObjectId);
        if (!group) {
            console.error("[CASH_AMOUNT] Group not found:", groupObjectId);
            throw new Error("Group not found");
        }
        console.log("[CASH_AMOUNT] Group found:", group.group_name);

        // Find or create CashAmount record
        let cashAmount = await CashAmount.findOne({ group: groupObjectId });
        console.log("[CASH_AMOUNT] Existing CashAmount:", cashAmount ? { amount: cashAmount.amount } : "NOT FOUND");

        // Get current balance from CashAmount if exists, otherwise from GroupMaster
        let currentBalance = 0;
        if (cashAmount) {
            currentBalance = cashAmount.amount || 0;
        } else {
            // If CashAmount doesn't exist, calculate from opening balance + transactions
            await group.recalculateCashBalance();
            currentBalance = group.current_cash_balance || 0;
        }

        console.log("[CASH_AMOUNT] Current balance before adding:", currentBalance);

        if (!cashAmount) {
            // Create new CashAmount record, initialize with current balance + amount to add
            const newAmount = currentBalance + amount;
            console.log("[CASH_AMOUNT] Creating new CashAmount:", { currentBalance, amount, newAmount });
            cashAmount = await CashAmount.create({
                group: groupObjectId,
                amount: newAmount
            });
            console.log("[CASH_AMOUNT] CashAmount created:", cashAmount.amount);
        } else {
            // Add to existing amount
            const oldAmount = cashAmount.amount || 0;
            const newAmount = oldAmount + amount;
            console.log("[CASH_AMOUNT] Updating existing CashAmount:", { oldAmount, amount, newAmount });
            cashAmount.amount = newAmount;
            await cashAmount.save();
            console.log("[CASH_AMOUNT] CashAmount updated:", cashAmount.amount);
        }

        // Update GroupMaster's current_cash_balance
        // Use current balance as base, then add the new amount
        const newGroupBalance = currentBalance + amount;
        group.current_cash_balance = newGroupBalance;
        await group.save();
        console.log("[CASH_AMOUNT] GroupMaster balance updated:", { currentBalance, amount, newBalance: newGroupBalance });

        const result = {
            cashAmount: cashAmount.amount,
            groupCashBalance: group.current_cash_balance
        };

        console.log("[CASH_AMOUNT] addCashAmountInternal result:", result);

        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'cashAmountController.js:56', message: 'addCashAmountInternal success', data: result, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D' }) }).catch(() => { });
        // #endregion

        return result;
    } catch (error) {
        console.error("[CASH_AMOUNT] Error adding cash amount internally:", error);

        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'cashAmountController.js:58', message: 'addCashAmountInternal error', data: { error: error.message, stack: error.stack }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D' }) }).catch(() => { });
        // #endregion

        throw error;
    }
};

/**
 * Internal helper function to remove cash amount (can be called directly)
 * @param {String} groupId - Group ID (ObjectId or string)
 * @param {Number} amount - Amount to remove
 * @returns {Promise<Object>} Updated cash amount info
 */
export const removeCashAmountInternal = async (groupId, amount) => {
    try {
        // Convert groupId to ObjectId
        let groupObjectId;
        if (groupId instanceof mongoose.Types.ObjectId) {
            groupObjectId = groupId;
        } else {
            try {
                groupObjectId = new mongoose.Types.ObjectId(groupId);
            } catch (error) {
                throw new Error("Invalid group ID format");
            }
        }

        // Verify group exists
        const group = await GroupMaster.findById(groupObjectId);
        if (!group) {
            throw new Error("Group not found");
        }

        // Find CashAmount record
        let cashAmount = await CashAmount.findOne({ group: groupObjectId });

        // Get current balance from CashAmount if exists, otherwise from GroupMaster
        let currentBalance = 0;
        if (cashAmount) {
            currentBalance = cashAmount.amount || 0;
        } else {
            // If CashAmount doesn't exist, calculate from opening balance + transactions
            await group.recalculateCashBalance();
            currentBalance = group.current_cash_balance || 0;
        }

        console.log("[CASH_AMOUNT] Current balance before removing:", currentBalance);

        if (!cashAmount) {
            // Create new record with current balance - amount to remove
            const newAmount = Math.max(0, currentBalance - amount);
            console.log("[CASH_AMOUNT] Creating new CashAmount (remove):", { currentBalance, amount, newAmount });
            cashAmount = await CashAmount.create({
                group: groupObjectId,
                amount: newAmount
            });
        } else {
            // Remove from existing amount
            const oldAmount = cashAmount.amount || 0;
            const newAmount = Math.max(0, oldAmount - amount);
            console.log("[CASH_AMOUNT] Updating existing CashAmount (remove):", { oldAmount, amount, newAmount });
            cashAmount.amount = newAmount;
            await cashAmount.save();
        }

        // Update GroupMaster's current_cash_balance
        const newGroupBalance = Math.max(0, currentBalance - amount);
        group.current_cash_balance = newGroupBalance;
        await group.save();
        console.log("[CASH_AMOUNT] GroupMaster balance updated (remove):", { currentBalance, amount, newBalance: newGroupBalance });

        return {
            cashAmount: cashAmount.amount,
            groupCashBalance: group.current_cash_balance
        };
    } catch (error) {
        console.error("Error removing cash amount internally:", error);
        throw error;
    }
};

/**
 * Add cash amount to a group (manual adjustment)
 * This will also update GroupMaster's current_cash_balance
 */
export const addCashAmount = async (req, res) => {
    try {
        const { amount, group_id } = req.body;
        if (!amount || !group_id) {
            return apiResponse.error(res, message.MISSING_FIELDS || "Missing required fields");
        }

        // Validate amount
        const amountValue = parseFloat(amount);
        if (isNaN(amountValue) || amountValue <= 0) {
            return apiResponse.error(res, "Invalid amount. Must be a positive number.", 400);
        }

        // Use internal helper function
        const result = await addCashAmountInternal(group_id, amountValue);
        return apiResponse.success(res, message.CASH_AMOUNT_ADDED || "Cash amount added successfully", result);
    } catch (error) {
        console.error("Error adding cash amount:", error);
        return apiResponse.error(res, error.message, 500);
    }
}

/**
 * Remove cash amount from a group (manual adjustment)
 * This will also update GroupMaster's current_cash_balance
 */
export const removeCashAmount = async (req, res) => {
    try {
        const { group_id } = req.params;
        const { amount } = req.body;

        if (!group_id) {
            return apiResponse.error(res, message.MISSING_FIELDS || "Missing group ID");
        }
        if (!amount) {
            return apiResponse.error(res, message.MISSING_FIELDS || "Missing amount");
        }

        // Validate amount
        const amountValue = parseFloat(amount);
        if (isNaN(amountValue) || amountValue <= 0) {
            return apiResponse.error(res, "Invalid amount. Must be a positive number.", 400);
        }

        // Use internal helper function
        const result = await removeCashAmountInternal(group_id, amountValue);
        return apiResponse.success(res, message.CashAmount_REMOVED || "Cash amount removed successfully", result);
    } catch (error) {
        console.error("Error removing cash amount:", error);
        return apiResponse.error(res, error.message, 500);
    }
}

/**
 * Get cash amount for a group
 * Returns both CashAmount record and GroupMaster's current_cash_balance
 */
export const getCashAmount = async (req, res) => {
    try {
        const { group_id } = req.params;
        if (!group_id) {
            return apiResponse.error(res, message.MISSING_FIELDS || "Missing group ID");
        }

        // Convert group_id to ObjectId
        let groupObjectId;
        try {
            groupObjectId = new mongoose.Types.ObjectId(group_id);
        } catch (error) {
            return apiResponse.error(res, "Invalid group ID format", 400);
        }

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;
        
        // Verify group access
        const accessCheck = await verifyGroupAccess(groupObjectId, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
        }
        const group = accessCheck.group;

        // Get CashAmount record (create if doesn't exist, sync with group balance)
        let cashAmount = await CashAmount.findOne({ group: groupObjectId });

        if (!cashAmount) {
            // Create new record with current group balance
            cashAmount = await CashAmount.create({
                group: groupObjectId,
                amount: group.current_cash_balance || 0
            });
        } else {
            // Sync CashAmount with GroupMaster's current balance if they differ significantly
            // (This handles cases where cash transactions updated GroupMaster but not CashAmount)
            const groupBalance = group.current_cash_balance || 0;
            if (Math.abs(cashAmount.amount - groupBalance) > 0.01) {
                // Sync them - prefer GroupMaster as source of truth
                cashAmount.amount = groupBalance;
                await cashAmount.save();
            }
        }

        return apiResponse.success(res, message.CASH_AMOUNT_FETCHED || "Cash amount fetched successfully", {
            cashAmount: cashAmount.amount,
            groupCashBalance: group.current_cash_balance || 0,
            openingCashBalance: group.opening_cash_balance || 0
        });
    } catch (error) {
        console.error("Error getting cash amount:", error);
        return apiResponse.error(res, error.message, 500);
    }
}

/**
 * Sync CashAmount with GroupMaster's current_cash_balance
 * Useful for reconciliation
 */
export const syncCashAmount = async (req, res) => {
    try {
        const { group_id } = req.params;
        if (!group_id) {
            return apiResponse.error(res, message.MISSING_FIELDS || "Missing group ID");
        }

        // Convert group_id to ObjectId
        let groupObjectId;
        try {
            groupObjectId = new mongoose.Types.ObjectId(group_id);
        } catch (error) {
            return apiResponse.error(res, "Invalid group ID format", 400);
        }

        // Get group and recalculate balance
        const group = await GroupMaster.findById(groupObjectId);
        if (!group) {
            return apiResponse.error(res, "Group not found", 404);
        }

        // Recalculate group cash balance from transactions
        await group.recalculateCashBalance();

        // Update or create CashAmount record
        let cashAmount = await CashAmount.findOne({ group: groupObjectId });
        if (!cashAmount) {
            cashAmount = await CashAmount.create({
                group: groupObjectId,
                amount: group.current_cash_balance || 0
            });
        } else {
            cashAmount.amount = group.current_cash_balance || 0;
            await cashAmount.save();
        }

        return apiResponse.success(res, "Cash amount synced successfully", {
            cashAmount: cashAmount.amount,
            groupCashBalance: group.current_cash_balance || 0
        });
    } catch (error) {
        console.error("Error syncing cash amount:", error);
        return apiResponse.error(res, error.message, 500);
    }
}