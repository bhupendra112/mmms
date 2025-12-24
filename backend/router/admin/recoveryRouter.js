import express from "express";
import { registerRecovery, listRecoveries, getRecoveryDetail, updateMemberRecovery, getRecoveryByDate, updateRecoveryPhoto, getPreviousRecoveryData } from "../../controller/admin/recoveryController.js";
import authAdmin from "../../middleware/authorization.js";

const Router = express.Router();

// Register recovery (admin direct storage)
Router.post("/register-recovery", authAdmin, registerRecovery);

// Update or add member recovery to existing session
Router.post("/update-member", authAdmin, updateMemberRecovery);

// Update recovery session with group photo
Router.post("/update-photo", authAdmin, updateRecoveryPhoto);

// Get recovery session by date and group
Router.get("/by-date", authAdmin, getRecoveryByDate);

// Get previous recovery data for a member
Router.get("/previous-data", authAdmin, getPreviousRecoveryData);

// List recoveries
Router.get("/list", authAdmin, listRecoveries);

// Get recovery detail
Router.get("/detail/:id", authAdmin, getRecoveryDetail);

export default Router;

