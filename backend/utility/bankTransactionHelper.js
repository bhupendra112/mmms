import BankTransaction from "../model/BankTransaction.js";
import BankMaster from "../model/BankMaster.js";

/**
 * Helper function to create a bank transaction receipt record
 * @param {Object} options - Transaction details
 * @param {String} options.bankId - Bank ID
 * @param {String} options.groupId - Group ID
 * @param {String} options.transactionType - Type: 'fd', 'recovery', 'loan', 'expense', 'payment', 'cash_to_bank', 'bank_to_bank', 'other'
 * @param {Number} options.amount - Transaction amount
 * @param {Date} options.date - Transaction date
 * @param {String} options.onlineRef - Online payment reference (optional)
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
 * @param {String} options.cashToBankId - CashToBank ID if transactionType is 'cash_to_bank' (optional)
 * @param {String} options.memberId - Member ID (optional)
 * @param {String} options.memberCode - Member code (optional)
 * @param {String} options.memberName - Member name (optional)
 * @param {String} options.status - Override default status (optional, "pending" or "verified")
 * @param {Boolean} options.isDebit - For bank_to_bank transactions: true for debit (source bank), false for credit (destination bank) (optional)
 * @returns {Promise<Object>} Created bank transaction record
 */
export const createBankTransactionRecord = async (options) => {
    try {
        const {
            bankId,
            groupId,
            transactionType,
            amount,
            date,
            onlineRef,
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
            status: overrideStatus,
            isDebit,
            session,
        } = options;

        // Validate required fields
        if (!bankId || !groupId || !transactionType || !amount) {
            console.warn("BankTransaction: Missing required fields, skipping record creation");
            return null;
        }

        // Get bank details
        const bank = await BankMaster.findById(bankId);
        if (!bank) {
            console.warn(`BankTransaction: Bank not found for ID ${bankId}, skipping record creation`);
            return null;
        }

        // Get group details (import dynamically to avoid circular dependency)
        const { GroupMaster } = await import("../model/index.js");
        const group = await GroupMaster.findById(groupId);
        if (!group) {
            console.warn(`BankTransaction: Group not found for ID ${groupId}, skipping record creation`);
            return null;
        }

        // Determine default status based on transaction type
        // FD and recovery transactions are typically verified immediately (member gives money to group)
        // Expense and loan transactions are also verified immediately (group pays money out)
        // Payment transactions are verified immediately when created by admin (group pays money to members)
        // Cash to bank conversions are verified when approved (admin has verified the conversion)
        // Bank to bank conversions are verified when approved (admin has verified the conversion)
        // Other transactions may need verification
        // Use overrideStatus if provided, otherwise use default logic
        const defaultStatus = overrideStatus || (
            (transactionType === "fd" || 
             transactionType === "recovery" || 
             transactionType === "expense" || 
             transactionType === "loan" ||
             transactionType === "payment" ||
             transactionType === "cash_to_bank" ||
             transactionType === "bank_to_bank") ? "verified" : "pending"
        );

        // Create bank transaction record
        const createOptions = session ? { session } : {};
        const bankTransaction = await BankTransaction.create({
            bankId: bank._id,
            bankName: bank.bank_name,
            accountNo: bank.account_no,
            groupId: group._id,
            groupName: group.group_name,
            groupCode: group.group_code,
            transactionType,
            amount: parseFloat(amount),
            date: date || new Date(),
            onlineRef: onlineRef || null,
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
            status: defaultStatus,
            createdBy: createdBy || "admin",
            isDebit: isDebit !== undefined ? isDebit : false, // Default to false (credit) if not specified
            // Auto-verify FD and recovery transactions
            verifiedBy: defaultStatus === "verified" ? (createdBy || "admin") : null,
            verifiedAt: defaultStatus === "verified" ? new Date() : null,
        }, createOptions);

        // Update bank balance if transaction is verified
        // FD, recovery, expense, and loan are verified immediately, so balance updates right away
        if (bankTransaction.status === "verified") {
            // Determine if transaction is credit (money in) or debit (money out)
            // Credits: recovery (money collected from members), fd (FD created - member gives money to group), cash_to_bank (cash deposited), bank_to_bank (destination bank - money transferred in)
            // Debits: loan (money given to members), expense (expense paid), payment (FD maturity/saving withdrawal - group gives money to members), bank_to_bank (source bank - money transferred out)
            // For bank_to_bank, use the isDebit field to determine if it's a credit or debit
            let isCredit;
            if (transactionType === "bank_to_bank") {
                isCredit = !bankTransaction.isDebit; // If isDebit is true, it's a debit (not credit)
            } else {
                isCredit = transactionType === "recovery" || transactionType === "fd" || transactionType === "cash_to_bank";
            }
            console.log("[BANK_TRANSACTION] Updating bank balance for verified transaction:", {
                transactionType,
                amount: parseFloat(amount),
                bankId: bank._id.toString(),
                isCredit: isCredit,
                willAddToBalance: isCredit,
                willRemoveFromBalance: !isCredit,
                currentBalanceBefore: bank.current_balance || 0
            });

            const balanceBefore = bank.current_balance || 0;
            await bank.recalculateBalance();
            const balanceAfter = bank.current_balance || 0;
            
            console.log("[BANK_TRANSACTION] Bank balance updated:", {
                balanceBefore,
                balanceAfter,
                difference: balanceAfter - balanceBefore,
                expectedDifference: isCredit ? parseFloat(amount) : -parseFloat(amount)
            });
        } else {
            console.log("[BANK_TRANSACTION] Transaction is pending, balance will be updated when verified:", {
                transactionType,
                status: bankTransaction.status,
                amount: parseFloat(amount)
            });
        }

        return bankTransaction;
    } catch (error) {
        // Log error but don't throw - we don't want to break the main transaction
        console.error("Error creating bank transaction record:", error);
        return null;
    }
};

