import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Admin from "../model/admin.js";

const DB_URL = "mongodb://127.0.0.1:27017/mmms";

mongoose.connect(DB_URL).then(() => {
    console.log("✅ MongoDB Connected");
    createAdmin();
});

async function createAdmin() {
    try {
        const exists = await Admin.findOne({ email: "admin@example.com" });

        if (exists) {
            console.log("⚠ Admin already exists. No new admin created.");
            return mongoose.connection.close();
        }

        const hashed = await bcrypt.hash("Admin@123", 10);

        await Admin.create({
            name: "Super Admin",
            email: "admin@example.com",
            password: hashed
        });

        console.log("🎉 Hardcoded Admin Created Successfully");
    } catch (e) {
        console.log("❌ Error:", e);
    }
}