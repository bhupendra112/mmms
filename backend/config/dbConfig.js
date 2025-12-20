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
    } catch (error) {
        process.exit(1);
    }
};

export default connectDB;