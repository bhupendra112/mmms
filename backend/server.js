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

// CORS Configuration - Allow both development and production origins
const allowedOrigins = [
    process.env.FRONTEND_URL || "https://mmms.online", // Production URL
    "http://localhost:5173", // Development frontend (Vite default)
    "http://localhost:3000", // Alternative dev port
    "http://127.0.0.1:5173", // Alternative localhost format
];

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) {
                return callback(null, true);
            }

            // Check if origin is in allowed list
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            callback(new Error('Not allowed by CORS'));
        },
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

// Middleware
app.use(express.json({ limit: '50mb' })); // Increased limit to 50MB for large image payloads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Determine uploads directory (same logic as multer config)
// Use environment variable for uploads directory, or default to backend/uploads
// For production with nginx, set UPLOADS_DIR in .env (e.g., /var/www/mmms/uploads)
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, "uploads");

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    // Set proper permissions for web server
    if (process.platform !== 'win32') {
        try {
            fs.chmodSync(uploadsDir, 0o755);
        } catch (err) {
            if (process.env.NODE_ENV === 'production') {
                console.warn('Warning: Could not set uploads directory permissions:', err.message);
            }
        }
    }
}

// Middleware to set CORS headers for static files
app.use("/uploads", (req, res, next) => {
    const requestOrigin = req.headers.origin;
    if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
        res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://mmms.online');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
});

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
    }
}));

// Test routes removed for production
// Only enable in development mode if needed
if (process.env.NODE_ENV === 'development') {
    // Development-only test routes can be added here if needed
}

// Connect DB and start server
const startServer = async () => {
    try {
        // Wait for database connection before starting server
        await connectDB();

        // Default Route
        app.get("/", (req, res) => res.send("App is running"));

        // Admin Routes
        app.use("/api/admin", adminRouter);

        app.listen(PORT, () => {
            // Log server start (keep for production monitoring)
            if (process.env.NODE_ENV !== 'production') {
                console.log(`🚀 Server is running on port ${PORT}`);
                console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
            }
        });
    } catch (error) {
        // Critical error - must log
        console.error("❌ Failed to start server:", error);
        process.exit(1);
    }
};

startServer();