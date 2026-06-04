import express from "express";
import { registerRecovery, listRecoveries, getRecoveryDetail, updateMemberRecovery, getRecoveryByDate, updateRecoveryPhoto, getPreviousRecoveryData, getDemandDetails, getMemberLoanTotals, getMemberRevenueRemaining, addPenaltyDemand, getGroupRecoveryDetails, exportRecoveryPDF, getMemberRecoveryStatus, approveRecovery, rejectRecovery, deleteRecovery } from "../../controller/admin/recoveryController.js";
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

// Get demand details for a member (without requiring recovery session)
Router.get("/demand-details", authAdmin, getDemandDetails);

// Get loan totals for a member (from LoanMaster and RecoveryMaster)
Router.get("/loan-totals", authAdmin, getMemberLoanTotals);

// Get remaining revenue demands for a member (from MemberRevenueDemand)
Router.get("/revenue-remaining", authAdmin, getMemberRevenueRemaining);

// Add penalty demand for a member (decide penalty; recover in Demand Recovery)
Router.post("/add-penalty-demand", authAdmin, addPenaltyDemand);

// List recoveries
Router.get("/list", authAdmin, listRecoveries);

// Get recovery detail
Router.get("/detail/:id", authAdmin, getRecoveryDetail);

// Get group recovery details
Router.get("/group-details", authAdmin, getGroupRecoveryDetails);

// Export recovery as PDF
Router.get("/export-pdf", authAdmin, exportRecoveryPDF);

// Get member recovery status for a specific date
Router.get("/status/:memberId", authAdmin, getMemberRecoveryStatus);

// Approve Recovery (from group panel)
Router.put("/approve/:id", authAdmin, approveRecovery);

// Reject Recovery (from group panel)
Router.put("/reject/:id", authAdmin, rejectRecovery);

// Delete full recovery session (must be last — /:id is a catch-all)
Router.delete("/:id", authAdmin, deleteRecovery);

export default Router;

