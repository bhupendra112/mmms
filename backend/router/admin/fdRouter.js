import express from "express";
import {
    createFD,
    getFDsByMember,
    getFDsByGroup,
    getAllFDs,
    getFDDetail,
    updateFDStatus
} from "../../controller/admin/fdController.js";
import authAdmin from "../../middleware/authorization.js";

const Router = express.Router();

// Create new FD
Router.post("/create", authAdmin, createFD);

// Get FDs by member
Router.get("/member/:memberId", authAdmin, getFDsByMember);

// Get FDs by group
Router.get("/group/:groupId", authAdmin, getFDsByGroup);

// Get all FDs
Router.get("/list", authAdmin, getAllFDs);

// Get FD detail
Router.get("/detail/:id", authAdmin, getFDDetail);

// Update FD status
Router.put("/status/:id", authAdmin, updateFDStatus);

export default Router;

