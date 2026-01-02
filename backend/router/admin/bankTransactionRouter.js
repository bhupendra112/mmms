import express from "express";
import {
    createBankTransaction,
    getBankTransactions,
    getBankTransactionById,
    updateBankTransaction,
    verifyBankTransaction,
    deleteBankTransaction,
    getBankTransactionsByBank,
    getBankTransactionsByGroup,
} from "../../controller/admin/bankTransactionController.js";
import authAdmin from "../../middleware/authorization.js";

const router = express.Router();

// All routes require admin authentication
router.use(authAdmin);

// Create bank transaction receipt
router.post("/", createBankTransaction);

// Get all bank transactions with filters
router.get("/", getBankTransactions);

// Get bank transaction by ID
router.get("/:id", getBankTransactionById);

// Update bank transaction
router.put("/:id", updateBankTransaction);

// Verify/Reject bank transaction
router.patch("/:id/verify", verifyBankTransaction);

// Delete bank transaction
router.delete("/:id", deleteBankTransaction);

// Get bank transactions by bank ID
router.get("/bank/:bankId", getBankTransactionsByBank);

// Get bank transactions by group ID
router.get("/group/:groupId", getBankTransactionsByGroup);

export default router;

