import express from "express";
import { addCashAmount, removeCashAmount, getCashAmount, syncCashAmount } from "../../controller/admin/cashAmountController.js";
import authAdmin from "../../middleware/authorization.js";

const router = express.Router();

// Add cash amount (manual adjustment)
router.post("/add", authAdmin, addCashAmount);

// Remove cash amount (manual adjustment)
router.post("/remove/:group_id", authAdmin, removeCashAmount);

// Get cash amount for a group
router.get("/:group_id", authAdmin, getCashAmount);

// Sync cash amount with GroupMaster's current_cash_balance
router.post("/sync/:group_id", authAdmin, syncCashAmount);

export default router;

