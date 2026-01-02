import mongoose from "mongoose";
import CashTransaction from "../model/CashTransaction.js";
import { GroupMaster } from "../model/index.js";
import { addCashAmountInternal, removeCashAmountInternal } from "../controller/admin/cashAmountController.js";

/**
 * Helper function to create a cash transaction record
 * @param {Object} options - Transaction details
 * @param {String} options.groupId - Group ID
 * @param {String} options.transactionType - Type: 'fd', 'recovery', 'loan', 'expense', 'payment', 'bank_to_cash', 'other'
 * @param {Number} options.amount - Transaction amount
 * @param {Date} options.date - Transaction date
 * @param {String} options.description - Description/remarks (optional)
 * @param {String} options.receipt - Receipt image (base64 or URL) (optional)
 * @param {String} options.receiptFileName - Receipt filename (optional)
 * @param {String} options.createdBy - Creator ID (optional)
 * @param {String} options.fdId - FD ID if transactionType is 'fd' (optional)
 * @param {String} options.recoveryId - Recovery ID if transactionType is 'recovery' (optional)
 * @param {String} options.recoveryMemberId - Member ID from recovery (optional)
 * @param {String} options.loanId - Loan ID if transactionType is 'loan' (optional)
 * @param {String} options.expenseId - Expense ID if transactionType is 'expense' (optional)
 * @param {String} options.paymentId - Payment ID if transactionType is 'payment' (optional)
 * @param {String} options.cashToBankId - CashToBank ID if transactionType is 'bank_to_cash' (optional)
 * @param {String} options.memberId - Member ID (optional)
 * @param {String} options.memberCode - Member code (optional)
 * @param {String} options.memberName - Member name (optional)
 * @returns {Promise<Object>} Created cash transaction record
 */
export const createCashTransactionRecord = async (options) => {
    console.log("[CASH_TRANSACTION] createCashTransactionRecord called with:", {
        transactionType: options?.transactionType,
        amount: options?.amount,
        groupId: options?.groupId,
        hasGroupId: !!options?.groupId,
        hasTransactionType: !!options?.transactionType,
        hasAmount: !!options?.amount
    });

    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'cashTransactionHelper.js:29', message: 'createCashTransactionRecord entry', data: { transactionType: options?.transactionType, amount: options?.amount, groupId: options?.groupId?.toString() }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(() => { });
    // #endregion

    try {
        const {
            groupId,
            transactionType,
            amount,
            date,
            description,
            receipt,
            receiptFileName,
            createdBy,
            fdId,
            recoveryId,
            recoveryMemberId,
            loanId,
            expenseId,
            paymentId,
            cashToBankId,
            memberId,
            memberCode,
            memberName,
        } = options;

        // Validate required fields
        if (!groupId || !transactionType || !amount) {
            console.warn("[CASH_TRANSACTION] Missing required fields, skipping record creation:", {
                hasGroupId: !!groupId,
                hasTransactionType: !!transactionType,
                hasAmount: !!amount,
                groupId,
                transactionType,
                amount
            });

            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'cashTransactionHelper.js:53', message: 'Validation failed - missing fields', data: { hasGroupId: !!groupId, hasTransactionType: !!transactionType, hasAmount: !!amount }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(() => { });
            // #endregion

            return null;
        }

        // Get group details
        console.log("[CASH_TRANSACTION] Looking up group:", groupId);
        const group = await GroupMaster.findById(groupId);
        if (!group) {
            console.warn(`[CASH_TRANSACTION] Group not found for ID ${groupId}, skipping record creation`);

            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'cashTransactionHelper.js:59', message: 'Group not found', data: { groupId: groupId?.toString() }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(() => { });
            // #endregion

            return null;
        }
        console.log("[CASH_TRANSACTION] Group found:", group.group_name, group._id);

        // Create cash transaction record first
        const transactionAmount = parseFloat(amount);
        const cashTransaction = await CashTransaction.create({
            groupId: group._id,
            groupName: group.group_name,
            groupCode: group.group_code,
            transactionType,
            amount: transactionAmount,
            date: date || new Date(),
            description: description || null,
            receipt: receipt || null,
            receiptFileName: receiptFileName || null,
            fdId: fdId || null,
            recoveryId: recoveryId || null,
            recoveryMemberId: recoveryMemberId || null,
            loanId: loanId || null,
            expenseId: expenseId || null,
            paymentId: paymentId || null,
            cashToBankId: cashToBankId || null,
            memberId: memberId || null,
            memberCode: memberCode || null,
            memberName: memberName || null,
            status: "verified", // Cash transactions are typically verified immediately
            createdBy: createdBy || "admin",
            verifiedBy: createdBy || "admin",
            verifiedAt: new Date(),
        });

        // Determine if transaction is credit (money in) or debit (money out)
        // Credits: recovery (money collected from members), fd (FD created - member gives money to group), bank_to_cash (bank converted to cash)
        // Debits: loan (money given to members), expense (expense paid), payment (FD maturity/saving withdrawal - group gives money to members), other (cash to bank)
        const isCredit = transactionType === "recovery" ||
            transactionType === "fd" ||
            transactionType === "bank_to_cash";

        console.log("[CASH_TRANSACTION] Transaction details:", {
            transactionType,
            amount: transactionAmount,
            isCredit,
            groupId: group._id.toString(),
            willAddCash: isCredit,
            willRemoveCash: !isCredit
        });

        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'cashTransactionHelper.js:132', message: 'Transaction type classification', data: { transactionType: transactionType, amount: transactionAmount, isCredit: isCredit, willAddCash: isCredit, willRemoveCash: !isCredit, groupId: group._id.toString() }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'FD_FIX' }) }).catch(() => { });
        // #endregion

        // Update CashAmount using controller methods
        // This will update both CashAmount and GroupMaster's current_cash_balance
        try {
            if (isCredit) {
                // Add cash amount (recovery, bank_to_cash)
                console.log("[CASH_TRANSACTION] Calling addCashAmountInternal for credit transaction");

                // #region agent log
                fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'cashTransactionHelper.js:98', message: 'Calling addCashAmountInternal', data: { groupId: group._id.toString(), amount: transactionAmount, transactionType }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C' }) }).catch(() => { });
                // #endregion

                const addResult = await addCashAmountInternal(group._id, transactionAmount);
                console.log("[CASH_TRANSACTION] addCashAmountInternal result:", addResult);

                // #region agent log
                fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'cashTransactionHelper.js:100', message: 'addCashAmountInternal completed', data: { success: !!addResult, cashAmount: addResult?.cashAmount, groupCashBalance: addResult?.groupCashBalance }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C' }) }).catch(() => { });
                // #endregion
            } else {
                // Remove cash amount (loan, expense, payment, other)
                // NOTE: FD is NOT here - it's a credit transaction (member gives money to group)
                console.log("[CASH_TRANSACTION] Calling removeCashAmountInternal for debit transaction");

                // #region agent log
                fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'cashTransactionHelper.js:105', message: 'Calling removeCashAmountInternal', data: { groupId: group._id.toString(), amount: transactionAmount, transactionType }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C' }) }).catch(() => { });
                // #endregion

                const removeResult = await removeCashAmountInternal(group._id, transactionAmount);
                console.log("[CASH_TRANSACTION] removeCashAmountInternal result:", removeResult);

                // #region agent log
                fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'cashTransactionHelper.js:107', message: 'removeCashAmountInternal completed', data: { success: !!removeResult, cashAmount: removeResult?.cashAmount, groupCashBalance: removeResult?.groupCashBalance }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C' }) }).catch(() => { });
                // #endregion
            }
        } catch (error) {
            // Log error but don't throw - we don't want to break the main transaction
            console.error("[CASH_TRANSACTION] Error updating CashAmount:", error);

            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'cashTransactionHelper.js:110', message: 'Error updating CashAmount', data: { error: error.message, stack: error.stack }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C' }) }).catch(() => { });
            // #endregion
        }

        // NOTE: We don't recalculate balance here because addCashAmountInternal/removeCashAmountInternal already updated it correctly
        // The recalculateCashBalance() method uses opening_cash_balance which might have incorrect values
        // Instead, we rely on the direct updates made by addCashAmountInternal/removeCashAmountInternal
        console.log("[CASH_TRANSACTION] Skipping recalculateCashBalance - using direct update from add/remove functions");

        // Just verify CashAmount exists and is in sync with GroupMaster
        const CashAmount = mongoose.model("CashAmount");
        let cashAmount = await CashAmount.findOne({ group: group._id });

        // Refresh group to get latest balance
        await group.populate();
        const currentGroupBalance = group.current_cash_balance || 0;

        if (!cashAmount) {
            // Create CashAmount to match current GroupMaster balance
            console.log("[CASH_TRANSACTION] Creating new CashAmount record to match GroupMaster balance");
            cashAmount = await CashAmount.create({
                group: group._id,
                amount: currentGroupBalance
            });
        } else {
            // Check if there's a significant discrepancy (more than 0.01 difference)
            const difference = Math.abs(cashAmount.amount - currentGroupBalance);
            if (difference > 0.01) {
                console.log("[CASH_TRANSACTION] CashAmount discrepancy detected, syncing:", {
                    cashAmountValue: cashAmount.amount,
                    groupMasterBalance: currentGroupBalance,
                    difference: difference
                });
                cashAmount.amount = currentGroupBalance;
                await cashAmount.save();
            } else {
                console.log("[CASH_TRANSACTION] CashAmount is in sync with GroupMaster:", cashAmount.amount);
            }
        }

        console.log("[CASH_TRANSACTION] Final CashAmount:", cashAmount.amount);
        console.log("[CASH_TRANSACTION] GroupMaster current_cash_balance:", currentGroupBalance);
        console.log("[CASH_TRANSACTION] Cash transaction created successfully:", cashTransaction._id);

        return cashTransaction;
    } catch (error) {
        // Log error but don't throw - we don't want to break the main transaction
        console.error("Error creating cash transaction record:", error);
        return null;
    }
};

