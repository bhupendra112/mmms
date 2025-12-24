import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use environment variable for uploads directory, or default to backend/uploads
// For production with nginx, set UPLOADS_DIR in .env (e.g., /var/www/mmms/uploads)
const baseUploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, "../uploads");
const uploadsDir = path.join(baseUploadsDir, "members");

// Create uploads directory structure if it doesn't exist
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  // Set proper permissions (readable by web server)
  if (process.platform !== 'win32') {
    try {
      fs.chmodSync(uploadsDir, 0o755);
      // Also set permissions on parent directory
      if (fs.existsSync(baseUploadsDir)) {
        fs.chmodSync(baseUploadsDir, 0o755);
      }
    } catch (err) {
      // Ignore permission errors in development
      if (process.env.NODE_ENV === 'production') {
        console.warn('Warning: Could not set uploads directory permissions:', err.message);
      }
    }
  }
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-memberId-fieldname.extension
    const memberId = req.body.Member_Id || req.body.memberId || "unknown";
    const fieldName = file.fieldname;
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const filename = `${timestamp}-${memberId}-${fieldName}${ext}`;
    cb(null, filename);
  },
});

// File filter - only allow images and PDFs
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    req.fileValidationError = "Only image files (jpeg, jpg, png, gif) and PDF files are allowed!";
    cb(new Error("Only image files (jpeg, jpg, png, gif) and PDF files are allowed!"), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter,
});

// Export uploads directory path for use in server.js
export { uploadsDir, baseUploadsDir };

export default upload;

