import express from "express";
import { registerRecovery, listRecoveries, getRecoveryDetail } from "../../controller/admin/recoveryController.js";
import authAdmin from "../../middleware/authorization.js";

const Router = express.Router();

// Register recovery (admin direct storage)
Router.post("/register-recovery", authAdmin, registerRecovery);

// List recoveries
Router.get("/list", authAdmin, listRecoveries);

// Get recovery detail
Router.get("/detail/:id", authAdmin, getRecoveryDetail);

export default Router;

