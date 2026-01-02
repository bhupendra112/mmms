import mongoose from "mongoose";

const CashAmountSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    },
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GroupMaster',
        required: true,
        unique: true
    }
})


const CashAmount = mongoose.model('CashAmount', CashAmountSchema);
export default CashAmount;