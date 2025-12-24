// ===========================
// DATABASE CONFIGURATION
// ===========================
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const DB_URL = process.env.DB_URL;

// Validate DB_URL is set
if (!DB_URL) {
    console.error("❌ ERROR: DB_URL environment variable is not set!");
    console.error("Please set DB_URL in your .env file");
    process.exit(1);
}

const connectDB = async () => {
    try {
        // Set connection options
        const options = {
            // Remove deprecated options and use modern ones
            serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
            socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
        };

        if (process.env.NODE_ENV !== 'production') {
            console.log("🔄 Attempting to connect to database...");
            console.log("📍 Database URL:", DB_URL.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@')); // Hide password in logs
        }

        await mongoose.connect(DB_URL, options);

        if (process.env.NODE_ENV !== 'production') {
            console.log("✅ Database connected successfully!");
            console.log("📊 Database Name:", mongoose.connection.name);
            console.log("🔗 Connection State:", mongoose.connection.readyState === 1 ? "Connected" : "Disconnected");
        }

        // Set up connection event handlers
        mongoose.connection.on("error", (err) => {
            console.error("❌ MongoDB connection error:", err);
        });

        mongoose.connection.on("disconnected", () => {
            console.warn("⚠️  MongoDB disconnected");
        });

        mongoose.connection.on("reconnected", () => {
            if (process.env.NODE_ENV !== 'production') {
                console.log("✅ MongoDB reconnected");
            }
        });

        // Handle process termination
        process.on("SIGINT", async () => {
            await mongoose.connection.close();
            console.log("MongoDB connection closed due to app termination");
            process.exit(0);
        });

    } catch (error) {
        console.error("❌ Database connection failed!");
        console.error("Error details:", error.message);

        if (error.name === "MongoServerSelectionError") {
            console.error("💡 Tip: Check if MongoDB server is running and accessible");
            console.error("💡 Tip: Verify your DB_URL connection string is correct");
        } else if (error.name === "MongoParseError") {
            console.error("💡 Tip: Your DB_URL connection string format is invalid");
        } else if (error.name === "MongoAuthenticationError") {
            console.error("💡 Tip: Check your database username and password");
        }

        console.error("Full error:", error);
        process.exit(1);
    }
};

export default connectDB;