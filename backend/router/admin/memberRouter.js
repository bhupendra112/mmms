import express from "express";
import { registerMemberSchema, updateMemberSchema } from "../../validation/adminValidation.js";
import { getMemberDetail, listMembers, listMembersByGroup, registerMember, getAutoMemberCode, exportMemberLedger, getMemberFinancialLedger, updateMember, deleteMember, getPendingMembers, approveMember, rejectMember, getMemberExitSummary, createMemberExitSettlement } from "../../controller/admin/memberController.js";
import upload from "../../config/multerConfig.js";
import authAdmin from "../../middleware/authorization.js";
import compressImages from "../../middleware/compressImages.js";

const router = express.Router();

router.get("/list", (req, res) => {
    return listMembers(req, res);
});

router.get("/by-group/:groupId", authAdmin, (req, res) => {
    return listMembersByGroup(req, res);
});

router.get("/auto-member-code", authAdmin, (req, res) => {
    return getAutoMemberCode(req, res);
});

router.get("/detail/:id", authAdmin, (req, res) => {
    return getMemberDetail(req, res);
});

router.get("/pending", authAdmin, (req, res) => {
    return getPendingMembers(req, res);
});

router.put("/approve/:id", authAdmin, (req, res) => {
    return approveMember(req, res);
});

router.put("/reject/:id", authAdmin, (req, res) => {
    return rejectMember(req, res);
});

// UPDATE MEMBER
router.put("/update/:id", authAdmin, async (req, res) => {
    const { error } = updateMemberSchema.validate(req.body);
    if (error) {
        return res.status(400).json({
            success: false,
            message: error.details[0].message
        });
    }
    return updateMember(req, res);
});

// DELETE MEMBER
router.delete("/delete/:id", authAdmin, deleteMember);

router.get("/financial-ledger", authAdmin, (req, res) => {
    return getMemberFinancialLedger(req, res);
});

router.get("/export-ledger", authAdmin, (req, res) => {
    return exportMemberLedger(req, res);
});

router.get("/exit-summary", authAdmin, (req, res) => {
    return getMemberExitSummary(req, res);
});

router.post("/exit-settlement", authAdmin, (req, res) => {
    return createMemberExitSettlement(req, res);
});

// Handle file uploads with multer - using fields to handle multiple optional files
router.post("/register-member", authAdmin, (req, res, next) => {
    // Multer middleware with error handling
    upload.fields([
        { name: 'Member_Photo', maxCount: 1 },
        { name: 'Voter_Id_File', maxCount: 1 },
        { name: 'Adhar_Id_File', maxCount: 1 },
        { name: 'Bank_File', maxCount: 1 },
        { name: 'Ration_Card_File', maxCount: 1 },
        { name: 'Job_Card_File', maxCount: 1 },
        { name: 'Adhar_Id_Pati_File', maxCount: 1 },
        { name: 'Voter_Id_Pati_File', maxCount: 1 },
        { name: 'Bank_Pati_File', maxCount: 1 }
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

        compressImages(req, res, next);
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