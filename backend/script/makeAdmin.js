import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Admin from "../model/admin.js";

const DB_URL = "mongodb://127.0.0.1:27017/mmms";

mongoose.connect(DB_URL).then(() => {
    createAdmin();
});

async function createAdmin() {
    try {
        const exists = await Admin.findOne({ email: "admin@example.com" });

        if (exists) {
            return mongoose.connection.close();
        }

        const hashed = await bcrypt.hash("Admin@123", 10);

        await Admin.create({
            name: "Super Admin",
            email: "admin@example.com",
            password: hashed
        });
    } catch (e) {
        // Error creating admin
    }
}