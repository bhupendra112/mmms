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
router.post("/register-member", upload.fields([
    { name: 'Voter_Id_File', maxCount: 1 },
    { name: 'Adhar_Id_File', maxCount: 1 },
    { name: 'Ration_Card_File', maxCount: 1 },
    { name: 'Job_Card_File', maxCount: 1 }
]), (req, res, next) => {
    // Handle multer errors
    if (req.fileValidationError) {
        return res.status(400).json({
            success: false,
            message: req.fileValidationError
        });
    }
    next();
}, async (req, res) => {
    // Note: Validation happens after multer processes files
    // Since we're using multipart/form-data, req.body will have string values
    // We need to handle validation appropriately or skip it for multipart forms
    // For now, we'll do basic validation in the controller

    return registerMember(req, res);
});

export default router;