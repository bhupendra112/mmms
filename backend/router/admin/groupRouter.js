import express from "express";
import { registerGroupSchema } from "../../validation/adminValidation.js";
import { registerGroup, updateGroup, addBankDetail, updateBankDetail, listBanksByGroup, listGroups, getGroupDetail, getGroupByCode, getBankDetail } from "../../controller/admin/groupController.js";
import authAdmin from "../../middleware/authorization.js";

const router = express.Router();

router.post("/register-group", authAdmin, async (req, res) => {
    const { error } = registerGroupSchema.validate(req.body);

    if (error) {
        return res.status(400).json({
            success: false,
            message: error.details[0].message
        });
    }

    return registerGroup(req, res);
});
// UPDATE GROUP
router.put("/update/:id", authAdmin, updateGroup);

// LIST ALL GROUPS
router.get("/list", authAdmin, (req, res) => {
    return listGroups(req, res);
});

// GROUP DETAIL BY CODE (must come before :groupId route)
router.get("/by-code/:group_code", authAdmin, (req, res) => {
    return getGroupByCode(req, res);
});

// GROUP DETAIL BY ID (must come before :groupId route)
router.get("/detail/:id", authAdmin, (req, res) => {
    return getGroupDetail(req, res);
});

// LIST BANKS FOR A GROUP (multiple banks) - must be last to avoid route conflicts
router.get("/:groupId/banks", authAdmin, (req, res) => {
    return listBanksByGroup(req, res);
});


// ADD BANK WITHOUT VALIDATION
router.post("/add-bank", authAdmin, (req, res) => {
    return addBankDetail(req, res);
});

// UPDATE BANK DETAIL
router.put("/bank/:bankId", authAdmin, updateBankDetail);

// GET BANK DETAIL WITH TRANSACTIONS
router.get("/bank/:bankId", authAdmin, (req, res) => {
    return getBankDetail(req, res);
});

export default router;