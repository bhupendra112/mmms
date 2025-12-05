// ===========================
// DATABASE CONFIGURATION
// ===========================
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const DB_URL = process.env.DB_URL;
const connectDB = async() => {
    try {
        await mongoose.connect(DB_URL);
        console.log("✅ MongoDB Connected Successfully");
    } catch (error) {
        console.log("❌ MongoDB Connection Failed:", error.message);
        process.exit(1);
    }
};

export default connectDB;