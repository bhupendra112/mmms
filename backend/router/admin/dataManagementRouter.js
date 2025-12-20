import express from "express";
import {
    exportAllData,
    importData,
    createBackup,
    deleteAllData,
    getDataStatistics,
    getDashboardStatistics,
} from "../../controller/admin/dataManagementController.js";
import authAdmin from "../../middleware/authorization.js";

const Router = express.Router();

// All routes require authentication
Router.get("/export", authAdmin, exportAllData);
Router.post("/import", authAdmin, importData);
Router.get("/backup", authAdmin, createBackup);
Router.post("/delete-all", authAdmin, deleteAllData);
Router.get("/statistics", authAdmin, getDataStatistics);
Router.get("/dashboard-stats", authAdmin, getDashboardStatistics);

export default Router;

