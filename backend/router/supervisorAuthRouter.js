import express from "express";
import { loginSupervisor } from "../controller/supervisorAuthController.js";
import { supervisorLoginSchema } from "../validation/adminValidation.js";

const Router = express.Router();

Router.post("/login", (req, res, next) => {
    const { error } = supervisorLoginSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    next();
}, loginSupervisor);

export default Router;
