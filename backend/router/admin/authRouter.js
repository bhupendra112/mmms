import express from "express";
import {
    registerAdmin,
    loginAdmin,
    getAdminProfile,
    updateAdminProfile,
    changePassword,
    getAdminSettings,
    updateAdminSettings
} from "../../controller/admin/authController.js";
import { adminRegisterValidationSchema, loginValidationSchema } from "../../validation/adminValidation.js";
import authAdmin from "../../middleware/authorization.js";

const Router = express.Router();

// Public routes
Router.post("/register", async (req, res) => {
    const { error } = adminRegisterValidationSchema.validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    return registerAdmin(req, res);
});

Router.post("/login", async (req, res) => {
    const { error } = loginValidationSchema.validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    return loginAdmin(req, res);
});

// Protected routes (require authentication)
Router.get("/profile", authAdmin, getAdminProfile);
Router.put("/profile", authAdmin, updateAdminProfile);
Router.post("/change-password", authAdmin, changePassword);
Router.get("/settings", authAdmin, getAdminSettings);
Router.put("/settings", authAdmin, updateAdminSettings);

export default Router;