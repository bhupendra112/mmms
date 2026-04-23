import express from "express";
import authAdmin from "../../middleware/authorization.js";
import {
    getRange,
    putRange,
    getSuggest,
    getLookup,
    listUsedVouchers,
} from "../../controller/admin/voucherController.js";

const Router = express.Router();

Router.get("/range", authAdmin, getRange);
Router.put("/range", authAdmin, putRange);
Router.get("/suggest", authAdmin, getSuggest);
Router.get("/lookup", authAdmin, getLookup);
Router.get("/list-used", authAdmin, listUsedVouchers);

export default Router;
