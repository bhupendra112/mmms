import express from "express";
import { createExpense, listExpenses, getExpenseDetail, updateExpense, deleteExpense } from "../../controller/admin/expenseController.js";
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

export default Router;

