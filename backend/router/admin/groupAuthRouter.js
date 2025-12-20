import express from "express";
import { loginGroup } from "../../controller/admin/groupAuthController.js";
import { groupLoginSchema } from "../../validation/adminValidation.js";

const Router = express.Router();

// Group login (no password, just name + ID/code verification)
Router.post("/login", (req, res, next) => {
    const { error } = groupLoginSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    next();
}, loginGroup);

export default Router;

