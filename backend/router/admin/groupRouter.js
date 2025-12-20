import express from "express";
import { registerGroupSchema } from "../../validation/adminValidation.js";
import { registerGroup, addBankDetail, listBanksByGroup, listGroups, getGroupDetail, getGroupByCode, getBankDetail } from "../../controller/admin/groupController.js";
import authAdmin from "../../middleware/authorization.js";

const router = express.Router();

router.post("/register-group", async (req, res) => {
    const { error } = registerGroupSchema.validate(req.body);

    if (error) {
        return res.status(400).json({
            success: false,
            message: error.details[0].message
        });
    }

    return registerGroup(req, res);
});
router.get("/test", (req, res) => {
    res.send("api is correctly working ")
})
// LIST ALL GROUPS
router.get("/list", (req, res) => {
    return listGroups(req, res);
});

// LIST BANKS FOR A GROUP (multiple banks)
router.get("/:groupId/banks", (req, res) => {
    return listBanksByGroup(req, res);
});

// GROUP DETAIL BY CODE (useful for group panel)
router.get("/by-code/:group_code", (req, res) => {
    return getGroupByCode(req, res);
});

// GROUP DETAIL BY ID
router.get("/detail/:id", (req, res) => {
    return getGroupDetail(req, res);
});

// ADD BANK WITHOUT VALIDATION
router.post("/add-bank", (req, res) => {
    return addBankDetail(req, res);
});

// GET BANK DETAIL WITH TRANSACTIONS
router.get("/bank/:bankId", (req, res) => {
    return getBankDetail(req, res);
});

export default router;