import mongoose from "mongoose";
import LoanMaster from "../model/LoanMaster.js";

const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/mmms";
        const conn = await mongoose.connect(mongoUri);
        try {
            await LoanMaster.syncIndexes();
            console.log("LoanMaster indexes synced");
        } catch (indexErr) {
            console.error(`LoanMaster index sync warning: ${indexErr.message}`);
        }
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error(`MongoDB connection error: ${error.message}`);
        process.exit(1);
    }
};

export default connectDB;

