import express from "express";
import authAdmin from "../middleware/authorization.js";
import {
    exportBankMaster,
    exportGroupMaster,
    exportShgMemberMaster,
} from "../controllers/export.controller.js";

const router = express.Router();

router.get("/export/bank-master", authAdmin, exportBankMaster);
router.get("/export/group-master", authAdmin, exportGroupMaster);
router.get("/export/shg-member-master", authAdmin, exportShgMemberMaster);

export default router;
