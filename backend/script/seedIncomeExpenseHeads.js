/**
 * Seed IncomeExpenseHeads collection with master mapping.
 * Run: node backend/script/seedIncomeExpenseHeads.js
 * Requires: MongoDB connection (e.g. via server or dotenv MONGODB_URI).
 */
import mongoose from "mongoose";
import IncomeExpenseHead from "../model/IncomeExpenseHead.js";
import { seedIncomeExpenseHeads } from "../service/reportIncomeExpenseService.js";

async function run() {
    const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/mmms";
    await mongoose.connect(uri);
    await seedIncomeExpenseHeads();
    const count = await IncomeExpenseHead.countDocuments();
    console.log("IncomeExpenseHeads seeded. Count:", count);
    await mongoose.disconnect();
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
