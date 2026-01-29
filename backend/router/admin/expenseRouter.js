import express from "express";
import { createExpense, listExpenses, getExpenseDetail, updateExpense, deleteExpense, approveExpense, rejectExpense } from "../../controller/admin/expenseController.js";
import authAdmin from "../../middleware/authorization.js";

const Router = express.Router();

// Create expense
Router.post("/", authAdmin, createExpense);

// List expenses
Router.get("/", authAdmin, listExpenses);

// Get expense detail
Router.get("/:id", authAdmin, getExpenseDetail);

// Update expense
Router.put("/:id", authAdmin, updateExpense);

// Delete expense
Router.delete("/:id", authAdmin, deleteExpense);

// Approve Expense (from group panel)
Router.put("/approve/:id", authAdmin, approveExpense);

// Reject Expense (from group panel)
Router.put("/reject/:id", authAdmin, rejectExpense);

export default Router;

