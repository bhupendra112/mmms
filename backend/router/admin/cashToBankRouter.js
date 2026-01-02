import express from "express";
import {
    createConversion,
    listConversions,
    getPendingConversions,
    approveConversion,
    rejectConversion,
    processConversion,
    getConversionDetail,
} from "../../controller/admin/cashToBankController.js";
import authAdmin from "../../middleware/authorization.js";
import upload from "../../config/multerConfig.js";

const router = express.Router();

// All routes require admin authentication
router.use(authAdmin);

// Create conversion request (with file upload)
router.post("/create", upload.single("paymentImage"), createConversion);

// List conversions with filters
router.get("/list", listConversions);

// Get pending conversions
router.get("/pending", getPendingConversions);

// Get conversion detail
router.get("/detail/:id", getConversionDetail);

// Approve conversion
router.post("/approve/:id", approveConversion);

// Reject conversion
router.post("/reject/:id", rejectConversion);

// Process conversion
router.post("/process/:id", processConversion);

export default router;

