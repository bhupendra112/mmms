import express from "express";
import { registerMemberSchema } from "../../validation/adminValidation.js";
import { getMemberDetail, listMembers, listMembersByGroup, registerMember, exportMemberLedger } from "../../controller/admin/memberController.js";
import upload from "../../config/multerConfig.js";
import authAdmin from "../../middleware/authorization.js";

const router = express.Router();

router.get("/list", (req, res) => {
    return listMembers(req, res);
});

router.get("/by-group/:groupId", (req, res) => {
    return listMembersByGroup(req, res);
});

router.get("/detail/:id", (req, res) => {
    return getMemberDetail(req, res);
});

router.get("/export-ledger", authAdmin, (req, res) => {
    return exportMemberLedger(req, res);
});

// Handle file uploads with multer - using fields to handle multiple optional files
router.post("/register-member", authAdmin, (req, res, next) => {
    // Multer middleware with error handling
    upload.fields([
        { name: 'Voter_Id_File', maxCount: 1 },
        { name: 'Adhar_Id_File', maxCount: 1 },
        { name: 'Ration_Card_File', maxCount: 1 },
        { name: 'Job_Card_File', maxCount: 1 }
    ])(req, res, (err) => {
        // Handle multer errors
        if (err) {
            console.error('Multer error:', err);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    success: false,
                    message: 'File size too large. Maximum size is 5MB.'
                });
            }
            if (err.message) {
                return res.status(400).json({
                    success: false,
                    message: err.message
                });
            }
            return res.status(400).json({
                success: false,
                message: 'File upload error'
            });
        }
        
        // Handle file validation errors
        if (req.fileValidationError) {
            return res.status(400).json({
                success: false,
                message: req.fileValidationError
            });
        }
        
        next();
    });
}, async (req, res) => {
    // Wrap in try-catch to handle any errors in the route handler
    try {
        return await registerMember(req, res);
    } catch (error) {
        console.error('Route handler error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
});

export default router;