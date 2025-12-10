import express from "express";
import { registerMemberSchema } from "../../validation/adminValidation.js";
import { registerMember, exportMembersPdf } from "../../controller/admin/memberController.js";
import authAdmin from "../../middleware/authorization.js"

const router = express.Router();

router.post("/register-member", authAdmin, async (req, res) => {
    const { error } = registerMemberSchema.validate(req.body);

    if (error) {
        return res.status(400).json({
            success: false,
            message: error.details[0].message
        });
    }

    return registerMember(req, res);
});


router.get("/export-pdf", authAdmin, exportMembersPdf);

export default router;