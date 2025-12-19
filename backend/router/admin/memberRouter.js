import express from "express";
import { registerMemberSchema } from "../../validation/adminValidation.js";
import { getMemberDetail, listMembers, listMembersByGroup, registerMember } from "../../controller/admin/memberController.js";

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

router.post("/register-member", async (req, res) => {
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