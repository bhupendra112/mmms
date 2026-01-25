import mongoose from "mongoose";

const BankMasterSchema = new mongoose.Schema({
    bank_name: { type: String, required: true },
    account_no: { type: String, required: true, unique: true },

    branch_name: { type: String },
    ifsc: { type: String },
    short_name: { type: String },

    ac_open_date: { type: Date },

    account_type: { type: String, enum: ["Saving", "CC", "FD"], required: true },

    opening_balance: { type: Number },
    open_indicator: { type: String },
    cc_limit: { type: Number },
    dp_limit: { type: Number },

    open_bal_curr: { type: Number },
    fd_mat_dt: { type: Date },

    open_ind_curr: { type: String },

    flg_acclosed: { type: String },
    acclosed_dt: { type: Date },

    govt_linked: { type: String, enum: ["Yes", "No"], default: "No" },
    govt_project_type: { type: String, enum: ["NRLM", "Other", ""], default: "" },

    // 🔗 Optional: Link bank account to group
    group_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GroupMaster",
        required: false,
    },

    // Current balance (calculated from opening_balance + transactions)
    // This is updated automatically when transactions are created/updated/deleted
    current_balance: {
        type: Number,
        default: 0
    },
}, { timestamps: true });

// Static method to calculate current balance from opening balance + all transactions
// CC accounts: base = cc_limit (available credit); Saving/FD: base = opening_balance
BankMasterSchema.statics.calculateCurrentBalance = async function (bankId) {
    const BankTransaction = mongoose.model("BankTransaction");

    const bank = await this.findById(bankId);
    if (!bank) {
        throw new Error("Bank not found");
    }

    const isCC = bank.account_type === "CC";
    const baseBalance = isCC && (bank.cc_limit !== undefined && bank.cc_limit !== null)
        ? (bank.cc_limit || 0)
        : (bank.opening_balance || 0);

    // Get all verified transactions for this bank
    const transactions = await BankTransaction.find({
        bankId: bankId,
        status: "verified" // Only count verified transactions
    }).sort({ date: 1, createdAt: 1 }); // Sort by date and creation time

    // Calculate balance: base + credits - debits (CC: remaining limit; Saving/FD: cash balance)
    let balance = baseBalance;

    for (const transaction of transactions) {
        const amount = transaction.amount || 0;

        // Determine if transaction is credit (money in) or debit (money out)
        // Credits: recovery (money collected from members), fd (FD created - member gives money to group), cash_to_bank (cash deposited), bank_to_bank (destination bank - money coming in)
        // Debits: loan (money given to members), expense (expense paid), payment (FD maturity/saving withdrawal - group gives money to members), bank_to_bank (source bank - money going out)
        let isCredit;
        if (transaction.transactionType === "bank_to_bank") {
            // For bank_to_bank, check isDebit field to determine if it's a debit or credit
            isCredit = !transaction.isDebit;
        } else {
            isCredit = transaction.transactionType === "recovery" ||
                transaction.transactionType === "fd" ||
                transaction.transactionType === "cash_to_bank";
        }

        if (isCredit) {
            balance += amount; // Money comes in
        } else {
            balance -= amount; // Money goes out
        }
    }

    return balance;
};

// Instance method to recalculate and update current balance
// CC: base = cc_limit; Saving/FD: base = opening_balance
BankMasterSchema.methods.recalculateBalance = async function () {
    const BankTransaction = mongoose.model("BankTransaction");

    const isCC = this.account_type === "CC";
    const baseBalance = isCC && (this.cc_limit !== undefined && this.cc_limit !== null)
        ? (this.cc_limit || 0)
        : (this.opening_balance || 0);

    // Get all verified transactions for this bank
    const transactions = await BankTransaction.find({
        bankId: this._id,
        status: "verified"
    }).sort({ date: 1, createdAt: 1 });

    let balance = baseBalance;

    for (const transaction of transactions) {
        const amount = transaction.amount || 0;
        let isCredit;
        if (transaction.transactionType === "bank_to_bank") {
            isCredit = !transaction.isDebit;
        } else {
            isCredit = transaction.transactionType === "recovery" ||
                transaction.transactionType === "fd" ||
                transaction.transactionType === "cash_to_bank";
        }

        if (isCredit) {
            balance += amount;
        } else {
            balance -= amount;
        }
    }

    this.current_balance = balance;
    await this.save();

    return balance;
};

// Static method to calculate available balance (current balance - pending debits + pending credits)
// This shows the balance available after accounting for pending transactions
BankMasterSchema.statics.calculateAvailableBalance = async function (bankId) {
    const BankTransaction = mongoose.model("BankTransaction");

    // Get current balance (from verified transactions)
    const currentBalance = await this.calculateCurrentBalance(bankId);

    // Get all pending transactions for this bank
    const pendingTransactions = await BankTransaction.find({
        bankId: bankId,
        status: "pending" // Only pending transactions
    });

    // Calculate pending adjustments
    let pendingDebits = 0; // Money going out (will reduce available balance)
    let pendingCredits = 0; // Money coming in (will increase available balance)

    for (const transaction of pendingTransactions) {
        const amount = transaction.amount || 0;

        // Determine if transaction is credit (money in) or debit (money out)
        // Credits: recovery (money collected from members), fd (FD created - member gives money to group), cash_to_bank (cash deposited), bank_to_bank (destination bank - money coming in)
        // Debits: loan (money given to members), expense (expense paid), payment (FD maturity/saving withdrawal - group gives money to members), bank_to_bank (source bank - money going out)
        let isCredit;
        if (transaction.transactionType === "bank_to_bank") {
            // For bank_to_bank, check isDebit field to determine if it's a debit or credit
            isCredit = !transaction.isDebit;
        } else {
            isCredit = transaction.transactionType === "recovery" ||
                transaction.transactionType === "fd" ||
                transaction.transactionType === "cash_to_bank";
        }

        if (isCredit) {
            pendingCredits += amount; // Money coming in
        } else {
            pendingDebits += amount; // Money going out
        }
    }

    // Available balance = current balance - pending debits + pending credits
    const availableBalance = currentBalance - pendingDebits + pendingCredits;

    return {
        currentBalance,
        availableBalance: Math.max(0, availableBalance), // Don't allow negative
        pendingDebits,
        pendingCredits
    };
};

export default mongoose.model("BankMaster", BankMasterSchema);