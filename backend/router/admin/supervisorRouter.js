import express from "express";
import authAdmin from "../../middleware/authorization.js";
import {
    createSupervisor,
    listSupervisors,
    updateSupervisor,
    disableSupervisor,
} from "../../controller/admin/supervisorController.js";

const router = express.Router();

router.post("/create", authAdmin, createSupervisor);
router.get("/", authAdmin, listSupervisors);
router.put("/:id", authAdmin, updateSupervisor);
router.delete("/:id", authAdmin, disableSupervisor);

export default router;
