import express from "express";
import {
    createPayment,
    getMaturedFDs,
    getMemberSavings,
    getPayments,
    getPaymentDetail,
    approvePayment,
    rejectPayment,
    completePayment,
} from "../../controller/admin/paymentController.js";
import authAdmin from "../../middleware/authorization.js";

const Router = express.Router();

// Create payment
Router.post("/create", authAdmin, createPayment);

// Get matured FDs
Router.get("/matured-fds", authAdmin, getMaturedFDs);

// Get member savings
Router.get("/member-savings/:memberId", authAdmin, getMemberSavings);

// Get payments list
Router.get("/list", authAdmin, getPayments);

// Get payment detail
Router.get("/detail/:id", authAdmin, getPaymentDetail);

// Approve payment
Router.put("/approve/:id", authAdmin, approvePayment);

// Reject payment
Router.put("/reject/:id", authAdmin, rejectPayment);

// Complete payment
Router.put("/complete/:id", authAdmin, completePayment);

export default Router;

