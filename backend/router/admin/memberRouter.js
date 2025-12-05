import express from "express";
import { registerMemberSchema } from "../../validation/adminValidation.js";
import { registerMember } from "../../controller/admin/memberController.js";

const router = express.Router();

router.post("/register-member", async(req, res) => {
    const { error } = registerMemberSchema.validate(req.body);

    if (error) {
        return res.status(400).json({
            success: false,
            message: error.details[0].message
        });
    }

    return registerMember(req, res);
});

export default router;