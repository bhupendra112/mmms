import sharp from "sharp";
import fs from "fs";
import path from "path";

const IMAGE_MIMES = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 80;
const PNG_COMPRESSION_LEVEL = 9;

/**
 * Collect all uploaded image files from req.file and req.files.
 * @param {import("express").Request} req
 * @returns {Array<{ path: string, mimetype: string }>}
 */
function collectImageFiles(req) {
    const files = [];
    if (req.file && req.file.path && IMAGE_MIMES.includes(req.file.mimetype)) {
        files.push({ path: req.file.path, mimetype: req.file.mimetype });
    }
    if (req.files && typeof req.files === "object") {
        for (const field of Object.values(req.files)) {
            const arr = Array.isArray(field) ? field : [field];
            for (const file of arr) {
                if (file && file.path && IMAGE_MIMES.includes(file.mimetype)) {
                    files.push({ path: file.path, mimetype: file.mimetype });
                }
            }
        }
    }
    return files;
}

/**
 * Compress a single image file with Sharp: resize (max dimension), then compress by format.
 * Writes to a temp file then replaces the original so req.file.path/filename stay valid.
 * @param {string} filePath - Absolute path to the file
 * @param {string} mimetype
 */
async function compressOne(filePath, mimetype) {
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const base = path.basename(filePath, ext);
    const tempPath = path.join(dir, `${base}-compressing${ext}`);
    let pipeline = sharp(filePath);
    const meta = await pipeline.metadata();
    const w = meta.width || 0;
    const h = meta.height || 0;
    if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
        pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true });
    }
    if (mimetype === "image/jpeg" || mimetype === "image/jpg") {
        pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
    } else if (mimetype === "image/png") {
        pipeline = pipeline.png({ compressionLevel: PNG_COMPRESSION_LEVEL });
    } else if (mimetype === "image/gif") {
        pipeline = pipeline.gif();
    }
    await pipeline.toFile(tempPath);
    fs.renameSync(tempPath, filePath);
}

/**
 * Post-Multer middleware: compress all uploaded image files (JPEG, PNG, GIF).
 * PDFs and other types are left unchanged. On Sharp errors we log and continue so the request still succeeds.
 */
export default function compressImages(req, res, next) {
    const files = collectImageFiles(req);
    if (files.length === 0) {
        return next();
    }
    Promise.all(files.map((f) => compressOne(f.path, f.mimetype))).then(
        () => next(),
        (err) => {
            console.error("Image compression error:", err);
            next();
        }
    );
}
