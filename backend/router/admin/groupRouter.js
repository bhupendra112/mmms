import express from "express";
import { registerGroupSchema } from "../../validation/adminValidation.js";
import { registerGroup, addBankDetail } from "../../controller/admin/groupController.js";
import authAdmin from "../../middleware/authorization.js";

const router = express.Router();

router.post("/register-group", async(req, res) => {
    const { error } = registerGroupSchema.validate(req.body);

    if (error) {
        return res.status(400).json({
            success: false,
            message: error.details[0].message
        });
    }

    return registerGroup(req, res);
});

// ADD BANK WITHOUT VALIDATION
router.post("/add-bank", (req, res) => {
    return addBankDetail(req, res);
});

export default router;