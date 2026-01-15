import mongoose from "mongoose";

const GroupMasterSchema = new mongoose.Schema({
    group_name: { type: String, required: true },
    group_code: { type: String, required: true }, // Not unique - same code can exist in different villages/clusters

    cluster_name: { type: String },
    cluster_code: { type: String },
    village: { type: String },
    place: { type: String }, // Location/place associated with admin

    no_members: { type: Number },
    formation_date: { type: Date },

    cluster: { type: String },

    saving_per_member: { type: Number },
    Mship_Group: { type: Number }, // Membership Group amount (changed from String to Number)
    membership_fees: { type: Number },

    mitan_name: { type: String },

    meeting_date_1_day: { type: Number, min: 1, max: 31 },
    meeting_date_2_day: { type: Number, min: 1, max: 31 },
    meeting_date_2_time: { type: String },

    sahyog_rashi: { type: String },
    shar_capital: { type: String },
    other: { type: String },

    remark: { type: String },

    govt_linked: { type: String, enum: ["Yes", "No"], default: "No" },
    govt_project_type: { type: String, enum: ["NRLM", "Other", ""], default: "" },
    // Single bank ref kept for backward compatibility (deprecated)
    bankmaster: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BankMaster"
    },
    // ✅ Multiple bank accounts per group
    bankmasters: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "BankMaster"
    }],

    // Group login fields
    loginEnabled: { type: Boolean, default: true },
    lastLoginAt: { type: Date },

    // Financial rates
    saving_rate: { type: Number }, // Rate for saving (interest rate percentage)
    fd_rate: { type: Number }, // Fixed Deposit interest rate percentage
    loan_rate: { type: Number }, // Loan interest rate percentage
    
    // Cash balance tracking
    opening_cash_balance: { type: Number, default: 0 }, // Opening cash balance for the group
    current_cash_balance: { type: Number, default: 0 }, // Current cash balance (updated automatically)

    // Extra charges/fees that can be added by admin
    charges: [{
        name: { type: String, required: true }, // Name of the charge
        amount: { type: Number, required: true }, // Amount to be charged
        type: { type: String, enum: ["one-time", "recurring"], required: true }, // Charge type
        startDate: { type: Date, required: true }, // Start date for the charge cycle
        frequency: { type: String, enum: ["yearly", "monthly"], default: "yearly" }, // Frequency for recurring charges
        isActive: { type: Boolean, default: true }, // Whether the charge is currently active
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    }],
}, { timestamps: true });

// Static method to calculate current cash balance from opening balance + all cash transactions
GroupMasterSchema.statics.calculateCurrentCashBalance = async function(groupId) {
    const CashTransaction = mongoose.model("CashTransaction");
    
    // Get opening cash balance
    const group = await this.findById(groupId);
    if (!group) {
        throw new Error("Group not found");
    }
    
    const openingCashBalance = group.opening_cash_balance || 0;
    
    // Get all verified cash transactions for this group
    const transactions = await CashTransaction.find({
        groupId: groupId,
        status: "verified" // Only count verified transactions
    }).sort({ date: 1, createdAt: 1 }); // Sort by date and creation time
    
    // Calculate balance: opening + credits - debits
    let balance = openingCashBalance;
    
    for (const transaction of transactions) {
        const amount = transaction.amount || 0;
        
        // Determine if transaction is credit (money in) or debit (money out)
        // Credits: recovery (money collected from members), fd (FD created - member gives money to group), bank_to_cash (bank converted to cash)
        // Debits: loan (money given to members), expense (expense paid), payment (FD maturity/saving withdrawal - group gives money to members)
        const isCredit = transaction.transactionType === "recovery" || 
                        transaction.transactionType === "fd" ||
                        transaction.transactionType === "bank_to_cash";
        
        if (isCredit) {
            balance += amount; // Money comes in
        } else {
            balance -= amount; // Money goes out
        }
    }
    
    return balance;
};

// Instance method to recalculate and update current cash balance
GroupMasterSchema.methods.recalculateCashBalance = async function() {
    const CashTransaction = mongoose.model("CashTransaction");
    
    const openingCashBalance = this.opening_cash_balance || 0;
    
    // Get all verified cash transactions for this group
    const transactions = await CashTransaction.find({
        groupId: this._id,
        status: "verified"
    }).sort({ date: 1, createdAt: 1 });
    
    // Calculate balance
    let balance = openingCashBalance;
    
    for (const transaction of transactions) {
        const amount = transaction.amount || 0;
        // Determine if transaction is credit (money in) or debit (money out)
        // Credits: recovery (money collected from members), fd (FD created - member gives money to group), bank_to_cash (bank converted to cash)
        // Debits: loan (money given to members), expense (expense paid), payment (FD maturity/saving withdrawal - group gives money to members)
        const isCredit = transaction.transactionType === "recovery" || 
                        transaction.transactionType === "fd" ||
                        transaction.transactionType === "bank_to_cash";
        
        if (isCredit) {
            balance += amount; // Money comes in - ADD to balance
        } else {
            balance -= amount; // Money goes out - SUBTRACT from balance
        }
    }
    
    // Update current_cash_balance
    this.current_cash_balance = balance;
    await this.save();
    
    return balance;
};

export default mongoose.model("GroupMaster", GroupMasterSchema);