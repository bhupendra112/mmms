import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/dbConfig.js";
import adminRouter from "./router/admin/index.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// CORS FIX
app.use(
    cors({
        origin: "http://localhost:5173", // your frontend Vite URL
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true,
    })
);

// Middleware
app.use(express.json());

// Connect DB
connectDB();

// Default Route
app.get("/", (req, res) => res.send("App is running"));

// Admin Routes
app.use("/api/admin", adminRouter);

app.listen(PORT, () =>
    console.log(`🚀 Server running on http://localhost:${PORT}`)
);