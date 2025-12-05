import express from "express";
import { registerAdmin, loginAdmin } from "../../controller/admin/authController.js";
import { adminRegisterValidationSchema, loginValidationSchema } from "../../validation/adminValidation.js";

const Router = express.Router();

Router.post("/register", async(req, res) => {
    const { error } = adminRegisterValidationSchema.validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    return registerAdmin(req, res);
});

Router.post("/login", async(req, res) => {
    const { error } = loginValidationSchema.validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    return loginAdmin(req, res);
});

export default Router;