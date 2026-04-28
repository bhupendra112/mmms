import express from "express";
import authAdmin from "../../middleware/authorization.js";
import { createJV, listJV, getJVByEntryId, getJVBalancePreview } from "../../controller/admin/journalController.js";

const Router = express.Router();

Router.post("/create", authAdmin, createJV);
Router.get("/list", authAdmin, listJV);
Router.get("/balance-preview", authAdmin, getJVBalancePreview);
Router.get("/:entryId", authAdmin, getJVByEntryId);

export default Router;
