import apiResponse from "../../utility/apiResponse.js";
import LoanMaster from "../../model/LoanMaster.js";
import { verifyGroupAccess } from "../../utility/groupAccessHelper.js";
import {
    getRangesByGroup,
    setActiveRangeForGroup,
    suggestNextVoucherNumber,
} from "../../service/voucherService.js";

const adminPlace = (req) => req.user?.place || req.admin?.place;

export const getRange = async (req, res) => {
    try {
        const { groupId } = req.query;
        if (!groupId) {
            return apiResponse.error(res, "groupId is required", 400);
        }
        const access = await verifyGroupAccess(groupId, adminPlace(req));
        if (!access.valid) {
            return apiResponse.error(res, access.error || "Access denied", 403);
        }
        const ranges = await getRangesByGroup(access.group._id);
        return apiResponse.success(res, "Voucher ranges fetched", ranges);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

export const putRange = async (req, res) => {
    try {
        if (req.admin?.type === "group") {
            return apiResponse.error(res, "Only admin users can configure voucher ranges", 403);
        }
        const { groupId, startNumber, endNumber, priority } = req.body || {};
        if (!groupId) {
            return apiResponse.error(res, "groupId is required", 400);
        }
        const access = await verifyGroupAccess(groupId, adminPlace(req));
        if (!access.valid) {
            return apiResponse.error(res, access.error || "Access denied", 403);
        }
        const doc = await setActiveRangeForGroup(access.group._id, startNumber, endNumber, priority);
        return apiResponse.success(res, "Voucher range saved", doc);
    } catch (error) {
        return apiResponse.error(res, error.message, 400);
    }
};

export const getSuggest = async (req, res) => {
    try {
        const { groupId } = req.query;
        if (!groupId) {
            return apiResponse.error(res, "groupId is required", 400);
        }
        const access = await verifyGroupAccess(groupId, adminPlace(req));
        if (!access.valid) {
            return apiResponse.error(res, access.error || "Access denied", 403);
        }
        const next = await suggestNextVoucherNumber(access.group._id);
        return apiResponse.success(res, "Next voucher number", { voucherNumber: next });
    } catch (error) {
        return apiResponse.error(res, error.message, 400);
    }
};

export const getLookup = async (req, res) => {
    try {
        const { groupId, voucherNumber } = req.query;
        if (!groupId || voucherNumber === undefined || voucherNumber === "") {
            return apiResponse.error(res, "groupId and voucherNumber are required", 400);
        }
        const access = await verifyGroupAccess(groupId, adminPlace(req));
        if (!access.valid) {
            return apiResponse.error(res, access.error || "Access denied", 403);
        }
        const n = parseInt(String(voucherNumber), 10);
        if (!Number.isInteger(n)) {
            return apiResponse.error(res, "voucherNumber must be a whole number", 400);
        }
        const loan = await LoanMaster.findOne({
            groupId: access.group._id,
            voucherNumber: n,
        })
            .select("voucherNumber memberName amount date status purpose memberCode")
            .lean();
        if (!loan) {
            return apiResponse.error(res, "No loan found for this voucher number", 404);
        }
        return apiResponse.success(res, "Loan found", {
            voucherNumber: loan.voucherNumber,
            memberName: loan.memberName || loan.memberCode || "",
            amount: loan.amount,
            date: loan.date,
            status: loan.status,
            purpose: loan.purpose,
        });
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

export const listUsedVouchers = async (req, res) => {
    try {
        const { groupId, search } = req.query;
        if (!groupId) {
            return apiResponse.error(res, "groupId is required", 400);
        }
        const access = await verifyGroupAccess(groupId, adminPlace(req));
        if (!access.valid) {
            return apiResponse.error(res, access.error || "Access denied", 403);
        }

        const filter = {
            groupId: access.group._id,
            voucherNumber: { $exists: true, $ne: null },
        };

        const s = String(search || "").trim();
        if (s) {
            const asNumber = parseInt(s, 10);
            if (Number.isInteger(asNumber)) {
                filter.$or = [
                    { voucherNumber: asNumber },
                    { memberName: { $regex: s, $options: "i" } },
                ];
            } else {
                filter.memberName = { $regex: s, $options: "i" };
            }
        }

        const rows = await LoanMaster.find(filter)
            .select("voucherNumber memberName memberCode amount purpose date status")
            .sort({ date: -1, createdAt: -1 })
            .lean();

        const result = rows.map((r) => ({
            voucherNumber: r.voucherNumber,
            memberName: r.memberName || r.memberCode || "",
            amount: r.amount,
            purpose: r.purpose || "",
            date: r.date,
            status: r.status,
        }));

        return apiResponse.success(res, "Used vouchers fetched", result);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};
