import express from "express";
import { registerLoan, listLoans, getLoanDetail } from "../../controller/admin/loanController.js";
import authAdmin from "../../middleware/authorization.js";

const Router = express.Router();

// Register loan (admin direct storage)
Router.post("/register-loan", authAdmin, registerLoan);

// List loans
Router.get("/list", authAdmin, listLoans);

// Get loan detail
Router.get("/detail/:id", authAdmin, getLoanDetail);

export default Router;

