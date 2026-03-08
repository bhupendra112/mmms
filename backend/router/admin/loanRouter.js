import express from "express";
import { registerLoan, listLoans, getLoanDetail, approveLoan, rejectLoan, previewLoanEdit, updateLoan } from "../../controller/admin/loanController.js";
import authAdmin from "../../middleware/authorization.js";

const Router = express.Router();

// Register loan (admin direct storage, group requests go to pending)
Router.post("/register-loan", authAdmin, registerLoan);

// List loans
Router.get("/list", authAdmin, listLoans);

// Get loan detail
Router.get("/detail/:id", authAdmin, getLoanDetail);

// Approve loan
Router.put("/approve/:id", authAdmin, approveLoan);

// Reject loan
Router.put("/reject/:id", authAdmin, rejectLoan);

// Preview loan edit (old vs new total payable, overpaid/underpaid status)
Router.post("/preview-edit/:id", authAdmin, previewLoanEdit);

// Update loan terms and apply adjustment (advance | refund | deficit | manual)
Router.patch("/update/:id", authAdmin, updateLoan);

export default Router;

