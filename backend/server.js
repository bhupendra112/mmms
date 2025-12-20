import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import connectDB from "./config/dbConfig.js";
import adminRouter from "./router/admin/index.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// CORS Configuration
app.use(
    cors({
        origin: process.env.FRONTEND_URL || "https://mmms.online",
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

// Middleware
app.use(express.json({ limit: '50mb' })); // Increased limit to 50MB for large image payloads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static files from uploads directory with proper headers
app.use("/uploads", express.static(uploadsDir, {
    setHeaders: (res, filePath) => {
        // Set proper content type for images
        if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
            res.setHeader('Content-Type', 'image/jpeg');
        } else if (filePath.endsWith('.png')) {
            res.setHeader('Content-Type', 'image/png');
        } else if (filePath.endsWith('.gif')) {
            res.setHeader('Content-Type', 'image/gif');
        } else if (filePath.endsWith('.pdf')) {
            res.setHeader('Content-Type', 'application/pdf');
        }
        // Enable CORS for static files
        res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://mmms.online');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
}));

// Test route to verify static file serving
app.get("/test-uploads", (req, res) => {
    const uploadsPath = path.join(__dirname, "uploads", "members");
    try {
        if (!fs.existsSync(uploadsPath)) {
            return res.json({
                success: false,
                message: "Uploads directory does not exist",
                path: uploadsPath
            });
        }
        const files = fs.readdirSync(uploadsPath);
        res.json({
            success: true,
            message: "Uploads directory accessible",
            path: uploadsPath,
            fileCount: files.length,
            files: files.slice(0, 5) // Show first 5 files
        });
    } catch (error) {
        res.json({
            success: false,
            message: "Error reading uploads directory",
            error: error.message,
            path: uploadsPath
        });
    }
});

// Route to check if a specific file exists
app.get("/check-file/:filename", (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, "uploads", "members", filename);

    try {
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            res.json({
                success: true,
                exists: true,
                filename: filename,
                path: filePath,
                size: stats.size,
                url: `/uploads/members/${filename}`
            });
        } else {
            res.json({
                success: false,
                exists: false,
                filename: filename,
                path: filePath,
                message: "File not found"
            });
        }
    } catch (error) {
        res.json({
            success: false,
            error: error.message,
            filename: filename,
            path: filePath
        });
    }
});

// Connect DB
connectDB();

// Default Route
app.get("/", (req, res) => res.send("App is running"));

// Admin Routes
app.use("/api/admin", adminRouter);

app.listen(PORT, () => {
    // Server started successfully
});