import express from "express";
import { getReceiptPaymentAccount, getIncomeExpenseAccount, getBalanceSheet } from "../../controller/admin/financialReportController.js";
import authAdmin from "../../middleware/authorization.js";

const Router = express.Router();

// Get Receipt & Payment Account
Router.get("/receipt-payment", authAdmin, getReceiptPaymentAccount);

// Get Income & Expense Account
Router.get("/income-expense", authAdmin, getIncomeExpenseAccount);

// Get Balance Sheet
Router.get("/balance-sheet", authAdmin, getBalanceSheet);

export default Router;

