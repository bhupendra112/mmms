import express from "express";
import { registerLoan, listLoans, getLoanDetail, approveLoan, rejectLoan } from "../../controller/admin/loanController.js";
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

export default Router;

