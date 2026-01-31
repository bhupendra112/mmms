import mongoose from "mongoose";

const IncomeExpenseHeadSchema = new mongoose.Schema({
    /** Display name of the line item, e.g. "INTEREST PAID ON MEMBER SAVINGS" */
    itemName: {
        type: String,
        required: true,
        trim: true,
    },
    /** Ledger code for reporting, e.g. 212 */
    ledgerCode: {
        type: Number,
        required: true,
    },
    /** Header under which this item is grouped, e.g. "INTEREST PAID TO MEMBERS" */
    headerName: {
        type: String,
        required: true,
        trim: true,
    },
    /** Header code for ordering, e.g. 2 */
    headerCode: {
        type: Number,
        required: true,
    },
    /** INCOME or EXPENDITURE */
    nature: {
        type: String,
        enum: ["INCOME", "EXPENDITURE"],
        required: true,
    },
}, { timestamps: true });

IncomeExpenseHeadSchema.index({ itemName: 1, nature: 1 }, { unique: true });

export default mongoose.model("IncomeExpenseHead", IncomeExpenseHeadSchema);
