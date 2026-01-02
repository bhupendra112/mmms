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
            return null;
        }

        // Get group details
        const group = await GroupMaster.findById(groupId);
        if (!group) {
            return null;
        }

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

        // Update CashAmount using controller methods
        // This will update both CashAmount and GroupMaster's current_cash_balance
        try {
            if (isCredit) {
                // Add cash amount (recovery, bank_to_cash)
                await addCashAmountInternal(group._id, transactionAmount);
            } else {
                // Remove cash amount (loan, expense, payment, other)
                // NOTE: FD is NOT here - it's a credit transaction (member gives money to group)
                await removeCashAmountInternal(group._id, transactionAmount);
            }
        } catch (error) {
            // Log error but don't throw - we don't want to break the main transaction
            console.error("[CASH_TRANSACTION] Error updating CashAmount:", error);
        }

        // NOTE: We don't recalculate balance here because addCashAmountInternal/removeCashAmountInternal already updated it correctly
        // The recalculateCashBalance() method uses opening_cash_balance which might have incorrect values
        // Instead, we rely on the direct updates made by addCashAmountInternal/removeCashAmountInternal

        // Just verify CashAmount exists and is in sync with GroupMaster
        const CashAmount = mongoose.model("CashAmount");
        let cashAmount = await CashAmount.findOne({ group: group._id });

        // Refresh group to get latest balance
        await group.populate();
        const currentGroupBalance = group.current_cash_balance || 0;

        if (!cashAmount) {
            // Create CashAmount to match current GroupMaster balance
            cashAmount = await CashAmount.create({
                group: group._id,
                amount: currentGroupBalance
            });
        } else {
            // Check if there's a significant discrepancy (more than 0.01 difference)
            const difference = Math.abs(cashAmount.amount - currentGroupBalance);
            if (difference > 0.01) {
                cashAmount.amount = currentGroupBalance;
                await cashAmount.save();
            }
        }

        return cashTransaction;
    } catch (error) {
        // Log error but don't throw - we don't want to break the main transaction
        console.error("Error creating cash transaction record:", error);
        return null;
    }
};

