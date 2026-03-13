import bcrypt from "bcryptjs";
import apiResponse from "../../utility/apiResponse.js";
import { Supervisor } from "../../model/index.js";
import { getAdminPlace } from "../../utility/groupAccessHelper.js";
import { createSupervisorSchema, updateSupervisorSchema } from "../../validation/adminValidation.js";

const BCRYPT_ROUNDS = 10;

export const createSupervisor = async (req, res) => {
    try {
        if (req.user?.type === "supervisor" || req.admin?.type === "supervisor") {
            return apiResponse.error(res, "Only admin can create supervisors", 403);
        }

        const { error } = createSupervisorSchema.validate(req.body);
        if (error) {
            return apiResponse.error(res, error.details[0].message, 400);
        }

        const adminPlace = await getAdminPlace(req);
        if (!adminPlace) {
            return apiResponse.error(res, "Admin place not found. Please ensure you are logged in.", 400);
        }

        const { name, email, password } = req.body;
        const emailLower = email?.toLowerCase?.() || email;

        const exists = await Supervisor.findOne({ email: emailLower });
        if (exists) {
            return apiResponse.error(res, "A supervisor with this email already exists", 400);
        }

        const hashedPassword = await bcrypt.hash(String(password).trim(), BCRYPT_ROUNDS);

        const supervisor = await Supervisor.create({
            name: name.trim(),
            email: emailLower,
            password: hashedPassword,
            place: adminPlace,
            createdByAdminId: req.user?.id || req.admin?.id,
            status: "active",
        });

        const result = await Supervisor.findById(supervisor._id).lean();
        return apiResponse.success(res, "Supervisor created successfully", result);
    } catch (err) {
        return apiResponse.error(res, err.message, 500);
    }
};

export const listSupervisors = async (req, res) => {
    try {
        if (req.user?.type === "supervisor" || req.admin?.type === "supervisor") {
            return apiResponse.error(res, "Only admin can list supervisors", 403);
        }

        const adminPlace = req.user?.place || req.admin?.place || (await getAdminPlace(req));
        if (!adminPlace) {
            return apiResponse.error(res, "Admin place not found. Please ensure you are logged in.", 400);
        }

        const list = await Supervisor.find({ place: adminPlace })
            .sort({ createdAt: -1 })
            .lean();

        return apiResponse.success(res, "Supervisors fetched successfully", list);
    } catch (err) {
        return apiResponse.error(res, err.message, 500);
    }
};

export const updateSupervisor = async (req, res) => {
    try {
        if (req.user?.type === "supervisor" || req.admin?.type === "supervisor") {
            return apiResponse.error(res, "Only admin can update supervisors", 403);
        }

        const { error } = updateSupervisorSchema.validate(req.body);
        if (error) {
            return apiResponse.error(res, error.details[0].message, 400);
        }

        const { id } = req.params;
        const adminPlace = req.user?.place || req.admin?.place || (await getAdminPlace(req));
        if (!adminPlace) {
            return apiResponse.error(res, "Admin place not found. Please ensure you are logged in.", 400);
        }

        const supervisor = await Supervisor.findById(id).lean();
        if (!supervisor) {
            return apiResponse.error(res, "Supervisor not found", 404);
        }
        if (supervisor.place !== adminPlace) {
            return apiResponse.error(res, "You can only update supervisors in your place", 403);
        }

        const updates = { ...req.body };
        delete updates.password;
        if (req.body.email) updates.email = req.body.email.toLowerCase();
        if (req.body.name) updates.name = req.body.name.trim();

        if (req.body.password && String(req.body.password).trim()) {
            updates.password = await bcrypt.hash(String(req.body.password).trim(), BCRYPT_ROUNDS);
        }

        const updated = await Supervisor.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        ).lean();

        return apiResponse.success(res, "Supervisor updated successfully", updated);
    } catch (err) {
        return apiResponse.error(res, err.message, 500);
    }
};

export const disableSupervisor = async (req, res) => {
    try {
        if (req.user?.type === "supervisor" || req.admin?.type === "supervisor") {
            return apiResponse.error(res, "Only admin can disable supervisors", 403);
        }

        const { id } = req.params;
        const adminPlace = req.user?.place || req.admin?.place || (await getAdminPlace(req));
        if (!adminPlace) {
            return apiResponse.error(res, "Admin place not found. Please ensure you are logged in.", 400);
        }

        const supervisor = await Supervisor.findById(id).lean();
        if (!supervisor) {
            return apiResponse.error(res, "Supervisor not found", 404);
        }
        if (supervisor.place !== adminPlace) {
            return apiResponse.error(res, "You can only disable supervisors in your place", 403);
        }

        await Supervisor.findByIdAndUpdate(id, { status: "disabled" });
        return apiResponse.success(res, "Supervisor disabled successfully", { id });
    } catch (err) {
        return apiResponse.error(res, err.message, 500);
    }
};
