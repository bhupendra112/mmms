import express from "express";
import { getRevenueSummary, getPendingDemands, getPaidRevenue, getMemberRevenue } from "../../controller/admin/revenueController.js";
import authAdmin from "../../middleware/authorization.js";

const router = express.Router();

// Get revenue summary
router.get("/summary", authAdmin, getRevenueSummary);

// Get pending demands
router.get("/pending", authAdmin, getPendingDemands);

// Get paid revenue
router.get("/paid", authAdmin, getPaidRevenue);

// Get member revenue details
router.get("/member/:memberId", authAdmin, getMemberRevenue);

export default router;
