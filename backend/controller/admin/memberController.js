import mongoose from "mongoose";
import apiResponse from "../../utility/apiResponse.js";
import message from "../../utility/message.js";
import { GroupMaster, Member, LoanMaster, RecoveryMaster, FDMaster, PaymentMaster, MemberRevenueDemand, MemberExitSettlement, BankMaster } from "../../model/index.js";
import { verifyGroupAccess, verifyGroupAccessByCode, verifyGroupAccessByName } from "../../utility/groupAccessHelper.js";
import { createCashTransactionRecord } from "../../utility/cashTransactionHelper.js";
import { getOriginalOpeningSaving } from "../../utility/memberOpeningSavingHelper.js";
import { postTransaction } from "../../service/ledgerPostingService.js";
import { findOrCreateHead } from "../../utility/headMappingHelper.js";
import { calculateMemberExitPosition } from "../../service/settlementService.js";

export const registerMember = async (req, res) => {
    try {
        // Log request for debugging (only in development)
        if (process.env.NODE_ENV !== 'production') {
            console.log('Member registration request received');
            console.log('Body keys:', Object.keys(req.body || {}));
            console.log('Files:', req.files ? Object.keys(req.files) : 'No files');
        }

        const payload = req.body || {};

        // Strip offline file metadata (_isFile objects) from sync payload - backend expects strings or undefined
        const fileFields = [
            'Member_Photo', 'Voter_Id_File', 'Adhar_Id_File', 'Bank_File',
            'Ration_Card_File', 'Job_Card_File', 'Adhar_Id_Pati_File',
            'Voter_Id_Pati_File', 'Bank_Pati_File',
        ];
        fileFields.forEach((key) => {
            const v = payload[key];
            if (v && typeof v === 'object' && v._isFile === true) delete payload[key];
        });

        // Handle file uploads - multer adds files to req.files
        // When using upload.fields(), req.files is an object with field names as keys
        if (req.files) {
            // req.files is an object: { fieldName: [file1, file2, ...] }
            Object.keys(req.files).forEach(fieldName => {
                if (fileFields.includes(fieldName)) {
                    const files = req.files[fieldName];
                    if (files && files.length > 0) {
                        // Store relative path from uploads directory
                        // Take the first file if multiple uploaded
                        payload[fieldName] = `/uploads/members/${files[0].filename}`;
                    }
                }
            });
        }

        // Parse JSON fields that might be sent as strings (for nested objects)
        if (typeof payload.fdDetails === 'string') {
            try {
                payload.fdDetails = JSON.parse(payload.fdDetails);
            } catch (e) {
                // Keep as is if not valid JSON
            }
        }

        if (typeof payload.loanDetails === 'string') {
            try {
                payload.loanDetails = JSON.parse(payload.loanDetails);
            } catch (e) {
                // Keep as is if not valid JSON
            }
        }

        // Parse numeric fields that come as strings from FormData
        const numericFields = ['Age', 'Age_Pati', 'Anual_Income', 'openingSaving', 'openingYogdan'];
        numericFields.forEach(field => {
            if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
                const numValue = Number(payload[field]);
                if (!isNaN(numValue)) {
                    payload[field] = numValue;
                }
            }
        });
        // If openingYogdan missing or invalid, store 0 (do not auto-add yogdan for existing members)
        const yogdanVal = payload.openingYogdan;
        if (yogdanVal === undefined || yogdanVal === null || yogdanVal === '' || isNaN(Number(yogdanVal))) {
            payload.openingYogdan = 0;
        } else {
            payload.openingYogdan = Number(yogdanVal);
        }

        // Parse date fields that come as strings from FormData
        const dateFields = ['Member_Dt', 'Dt_Join', 'dt_birth', 'dt_birth_pati'];
        dateFields.forEach(field => {
            if (payload[field] && typeof payload[field] === 'string' && payload[field] !== '') {
                const dateValue = new Date(payload[field]);
                if (!isNaN(dateValue.getTime())) {
                    payload[field] = dateValue;
                }
            }
        });

        // Parse nested date and numeric fields in fdDetails and loanDetails
        if (payload.fdDetails && typeof payload.fdDetails === 'object') {
            if (payload.fdDetails.date && typeof payload.fdDetails.date === 'string') {
                const dateValue = new Date(payload.fdDetails.date);
                if (!isNaN(dateValue.getTime())) {
                    payload.fdDetails.date = dateValue;
                }
            }
            if (payload.fdDetails.maturityDate && typeof payload.fdDetails.maturityDate === 'string') {
                const dateValue = new Date(payload.fdDetails.maturityDate);
                if (!isNaN(dateValue.getTime())) {
                    payload.fdDetails.maturityDate = dateValue;
                }
            }
            // Parse numeric fields in fdDetails
            if (payload.fdDetails.amount !== undefined && payload.fdDetails.amount !== null && payload.fdDetails.amount !== '') {
                const numValue = Number(payload.fdDetails.amount);
                if (!isNaN(numValue)) {
                    payload.fdDetails.amount = numValue;
                }
            }
            if (payload.fdDetails.interest !== undefined && payload.fdDetails.interest !== null && payload.fdDetails.interest !== '') {
                const numValue = Number(payload.fdDetails.interest);
                if (!isNaN(numValue)) {
                    payload.fdDetails.interest = numValue;
                }
            }
        }

        if (payload.loanDetails && typeof payload.loanDetails === 'object') {
            if (payload.loanDetails.loanDate && typeof payload.loanDetails.loanDate === 'string') {
                const dateValue = new Date(payload.loanDetails.loanDate);
                if (!isNaN(dateValue.getTime())) {
                    payload.loanDetails.loanDate = dateValue;
                }
            }
            // Parse numeric fields in loanDetails
            if (payload.loanDetails.amount !== undefined && payload.loanDetails.amount !== null && payload.loanDetails.amount !== '') {
                const numValue = Number(payload.loanDetails.amount);
                if (!isNaN(numValue)) {
                    payload.loanDetails.amount = numValue;
                }
            }
            if (payload.loanDetails.overdueInterest !== undefined && payload.loanDetails.overdueInterest !== null && payload.loanDetails.overdueInterest !== '') {
                const numValue = Number(payload.loanDetails.overdueInterest);
                if (!isNaN(numValue)) {
                    payload.loanDetails.overdueInterest = numValue;
                }
            }
            if (payload.loanDetails.loanPaid !== undefined && payload.loanDetails.loanPaid !== null && payload.loanDetails.loanPaid !== '') {
                const numValue = Number(payload.loanDetails.loanPaid);
                if (!isNaN(numValue)) {
                    payload.loanDetails.loanPaid = numValue;
                }
            }
        }

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Resolve group first (preferred: group_id) and verify it belongs to admin's place
        let groupDoc = null;
        if (payload.group_id) {
            const accessCheck = await verifyGroupAccess(payload.group_id, adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
            }
            groupDoc = accessCheck.group;
        } else if (payload.group_code) {
            const accessCheck = await verifyGroupAccessByCode(payload.group_code, adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
            }
            groupDoc = accessCheck.group;
        } else if (payload.Group_Name) {
            const accessCheck = await verifyGroupAccessByName(payload.Group_Name, adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
            }
            groupDoc = accessCheck.group;
        }

        if (!groupDoc) {
            return apiResponse.error(res, "Valid group_id/group_code/Group_Name is required", 400);
        }

        // Check if Member already exists in this specific group
        // Same Member ID can exist in different groups, but not within the same group
        const exist = await Member.findOne({
            Member_Id: payload.Member_Id,
            group: groupDoc._id
        });
        if (exist) {
            return apiResponse.error(res, `Member with ID "${payload.Member_Id}" already exists in this group`, 400);
        }

        // For existing members, capture saving_per_member snapshot from group
        if (payload.isExistingMember) {
            // Capture saving_per_member snapshot for existing members
            payload.saving_per_member_snapshot = groupDoc.saving_per_member || null;
        }

        // Parse loanDetails time_period and installment_amount if they exist
        // If time_period is integer >= 12 treat as months; else treat as years and convert to months
        if (payload.loanDetails && typeof payload.loanDetails === 'object') {
            if (payload.loanDetails.time_period !== undefined && payload.loanDetails.time_period !== null && payload.loanDetails.time_period !== '') {
                const raw = Number(payload.loanDetails.time_period);
                if (!isNaN(raw) && raw > 0) {
                    if (Number.isInteger(raw) && raw >= 12) {
                        payload.loanDetails.time_period = raw; // already in months
                    } else {
                        payload.loanDetails.time_period = Math.round(raw * 12); // years to months (legacy)
                    }
                }
            }
            if (payload.loanDetails.installment_amount !== undefined && payload.loanDetails.installment_amount !== null && payload.loanDetails.installment_amount !== '') {
                const installmentValue = Number(payload.loanDetails.installment_amount);
                if (!isNaN(installmentValue)) {
                    payload.loanDetails.installment_amount = installmentValue;
                }
            }
            // Calculate installment_amount if loan amount and time_period are provided but installment_amount is not
            if (!payload.loanDetails.installment_amount && payload.loanDetails.amount && payload.loanDetails.time_period) {
                const loanAmount = Number(payload.loanDetails.amount);
                const timePeriodMonths = Number(payload.loanDetails.time_period);
                if (!isNaN(loanAmount) && !isNaN(timePeriodMonths) && timePeriodMonths > 0) {
                    payload.loanDetails.installment_amount = loanAmount / timePeriodMonths;
                }
            }
        }

        // Parse fdDetails time_period if it exists (convert from years to months)
        if (payload.fdDetails && typeof payload.fdDetails === 'object') {
            if (payload.fdDetails.time_period !== undefined && payload.fdDetails.time_period !== null && payload.fdDetails.time_period !== '') {
                const timePeriodYears = Number(payload.fdDetails.time_period);
                if (!isNaN(timePeriodYears) && timePeriodYears > 0) {
                    payload.fdDetails.time_period = Math.round(timePeriodYears * 12); // Convert years to months
                }
            }
        }

        const requireApproval = payload.requireApproval === true || payload.source === 'group_sync';
        const approvalStatus = requireApproval ? 'pending' : 'approved';

        const memberData = {
            ...payload,
            group: groupDoc._id,
            Group_Name: payload.Group_Name || groupDoc.group_name,
            approvalStatus,
        };
        delete memberData.requireApproval;
        delete memberData.source;
        delete memberData.groupId;

        // Log before creating (only in development)
        if (process.env.NODE_ENV !== 'production') {
            console.log('Creating member with data:', {
                Member_Id: memberData.Member_Id,
                Member_Nm: memberData.Member_Nm,
                group: memberData.group,
                hasLoanDetails: !!memberData.loanDetails,
                hasFdDetails: !!memberData.fdDetails,
                isExistingMember: memberData.isExistingMember,
            });
        }

        const member = await Member.create(memberData);

        // For existing members: Create LoanMaster and FDMaster entries
        if (member.isExistingMember) {
            // Create LoanMaster entry if member has existing loan
            if (member.loanDetails && member.loanDetails.amount > 0) {
                const totalLoanAmount = member.loanDetails.amount || 0;
                const loanPaid = member.loanDetails.loanPaid || 0;
                const loanDate = member.loanDetails.loanDate || member.Dt_Join || member.createdAt || new Date();
                const totalTimePeriod = member.loanDetails.time_period || null;

                // Calculate principal amount = total amount - paid amount (remaining loan amount)
                const principalAmount = Math.max(0, totalLoanAmount - loanPaid);

                // Calculate elapsed time from loan date to current date (registration date)
                const currentDate = member.Dt_Join || member.createdAt || new Date();
                const loanDateObj = new Date(loanDate);
                const currentDateObj = new Date(currentDate);

                // Calculate months difference between loan date and current date
                let elapsedMonths = 0;
                if (loanDateObj < currentDateObj) {
                    const yearDiff = currentDateObj.getFullYear() - loanDateObj.getFullYear();
                    const monthDiff = currentDateObj.getMonth() - loanDateObj.getMonth();
                    elapsedMonths = yearDiff * 12 + monthDiff;
                    // Add 1 month if the day of current date >= day of loan date (round up)
                    if (currentDateObj.getDate() >= loanDateObj.getDate()) {
                        elapsedMonths += 1;
                    }
                }

                // Calculate remaining time period = total time period - elapsed time
                let remainingTimePeriod = totalTimePeriod;
                if (totalTimePeriod && totalTimePeriod > 0 && elapsedMonths > 0) {
                    remainingTimePeriod = Math.max(1, totalTimePeriod - elapsedMonths); // Minimum 1 month remaining
                } else if (!remainingTimePeriod || remainingTimePeriod <= 0) {
                    // If no time period provided, calculate based on remaining amount and original installment
                    // Fallback: assume remaining time period based on remaining amount
                    remainingTimePeriod = totalTimePeriod || 12; // Default to 12 months if not provided
                }

                // Recalculate installment amount based on remaining principal and remaining time period
                let installmentAmount = 0;
                if (principalAmount > 0 && remainingTimePeriod > 0) {
                    installmentAmount = principalAmount / remainingTimePeriod;
                } else if (member.loanDetails.installment_amount) {
                    // Fallback to original installment amount if calculation fails
                    installmentAmount = member.loanDetails.installment_amount;
                }

                // Get loan rate snapshot from group
                const loanRateSnapshot = groupDoc.loan_rate || null;

                // Use openingYogdan from member registration (for existing members)
                const yogdanAmount = member.openingYogdan || 0;

                // Create LoanMaster entry for existing member's loan
                // Store principal amount (remaining amount) in LoanMaster
                // Note: member.loanDetails.amount keeps the total loan amount for reference
                // member.loanDetails.loanPaid keeps the amount paid before registration
                // The recovery system will calculate: total loan = LoanMaster.amount (principal) + member.loanPaid (pre-registration) + recovery payments (post-registration)
                await LoanMaster.create({
                    groupId: groupDoc._id,
                    groupName: groupDoc.group_name,
                    groupCode: groupDoc.group_code,
                    memberId: member._id.toString(),
                    memberCode: member.Member_Id,
                    memberName: member.Member_Nm,
                    transactionType: "Loan",
                    paymentMode: "Cash", // Default for existing loans
                    purpose: "Existing Loan from Registration",
                    amount: principalAmount, // Store principal (remaining) amount = total - paid
                    time_period: remainingTimePeriod, // Store remaining time period = total - elapsed
                    installment_amount: installmentAmount, // Recalculated based on principal and remaining time period
                    loan_rate_snapshot: loanRateSnapshot,
                    yogdanAmount: yogdanAmount,
                    yogdanCollected: false, // Will be collected in first recovery
                    date: loanDate,
                    status: "approved", // Existing loans are auto-approved
                    createdBy: req.user?.id || "admin",
                });

                // Keep member.loanDetails.amount as total loan amount for reference
                // Update installment_amount and time_period to reflect current state (remaining)
                // This helps with backward compatibility and reference
                member.loanDetails.installment_amount = installmentAmount;
                // Note: We keep member.loanDetails.amount as total, and member.loanDetails.loanPaid as paid amount
                // The recovery calculations use LoanMaster.amount (principal) + member.loanPaid + recovery payments
                await member.save();

                console.log(`[MEMBER_REGISTRATION] Created LoanMaster entry for existing member ${member.Member_Id}:`, {
                    totalLoanAmount,
                    loanPaid,
                    principalAmount,
                    loanDate,
                    totalTimePeriod,
                    elapsedMonths,
                    remainingTimePeriod,
                    installmentAmount,
                    loanRateSnapshot
                });
            }

            // Create FDMaster entry if member has existing FD
            if (member.fdDetails && member.fdDetails.amount > 0) {
                const fdAmount = member.fdDetails.amount || 0;
                const fdDate = member.fdDetails.date || member.Dt_Join || member.createdAt || new Date();
                let maturityDate = member.fdDetails.maturityDate || null;

                // Parse maturity date if it's a string
                if (maturityDate && typeof maturityDate === 'string') {
                    maturityDate = new Date(maturityDate);
                }

                // Calculate maturity date if not provided but time_period exists
                let calculatedMaturityDate = maturityDate && !isNaN(maturityDate.getTime()) ? maturityDate : null;
                const timePeriodMonths = member.fdDetails.time_period || 12; // Default to 12 months

                if (!calculatedMaturityDate) {
                    calculatedMaturityDate = new Date(fdDate);
                    calculatedMaturityDate.setMonth(calculatedMaturityDate.getMonth() + timePeriodMonths);
                }

                // Get FD rate snapshot from group (required field)
                const fdRateSnapshot = groupDoc.fd_rate || 0;
                if (!fdRateSnapshot || fdRateSnapshot <= 0) {
                    console.warn(`[MEMBER_REGISTRATION] Warning: Group ${groupDoc.group_name} has no fd_rate set. Using 0 for FD snapshot.`);
                }

                // Calculate interest amount if provided in fdDetails, otherwise calculate it
                let interestAmount = member.fdDetails?.interest || 0;
                if (!interestAmount && fdRateSnapshot > 0 && timePeriodMonths > 0) {
                    // Calculate interest: (Principal * Rate * Time) / (100 * 12)
                    // Time is in months, so divide by 12 to get years
                    const timeInYears = timePeriodMonths / 12;
                    interestAmount = (fdAmount * fdRateSnapshot * timeInYears) / 100;
                    interestAmount = Math.round(interestAmount * 100) / 100; // Round to 2 decimal places
                }

                // Calculate maturity amount = principal + interest
                const maturityAmount = fdAmount + interestAmount;

                // Create FDMaster entry for existing member's FD
                await FDMaster.create({
                    memberId: member._id,
                    memberCode: member.Member_Id,
                    memberName: member.Member_Nm,
                    groupId: groupDoc._id,
                    groupName: groupDoc.group_name,
                    groupCode: groupDoc.group_code,
                    amount: fdAmount,
                    time_period: timePeriodMonths,
                    fd_rate_snapshot: fdRateSnapshot,
                    date: fdDate,
                    maturityDate: calculatedMaturityDate,
                    interestAmount: interestAmount,
                    maturityAmount: maturityAmount,
                    status: "active",
                    createdBy: req.user?.id || "admin",
                });

                console.log(`[MEMBER_REGISTRATION] Created FDMaster entry for existing member ${member.Member_Id}:`, {
                    fdAmount,
                    fdDate,
                    maturityDate: calculatedMaturityDate,
                    timePeriodMonths,
                    fdRateSnapshot
                });
            }
        }

        // Create revenue demand records for NEW members joining outside April
        // New members (not isExistingMember) who join outside April must pay membership fees twice:
        // 1. Immediately on registration (or first recovery)
        // 2. Again in April as part of annual demand
        if (!member.isExistingMember) {
            const joinDate = member.Dt_Join || member.Member_Dt || member.createdAt || new Date();
            const joinMonth = new Date(joinDate).getMonth(); // 0-indexed (0 = January, 3 = April)
            const APRIL_MONTH = 3;

            // If member joined outside April, create revenue demand records
            if (joinMonth !== APRIL_MONTH) {
                const currentYear = new Date(joinDate).getFullYear();
                const financialYear = `${currentYear}-${String(currentYear + 1).slice(-2)}`; // e.g., "2024-25"

                const membershipFees = groupDoc.membership_fees || 0;
                const membershipGroup = groupDoc.Mship_Group || 0;

                // Create revenue demand for membership fees SHG
                if (membershipFees > 0) {
                    await MemberRevenueDemand.create({
                        memberId: member._id,
                        groupId: groupDoc._id,
                        revenueType: "membership_fees_shg",
                        amount: membershipFees,
                        demandDate: new Date(joinDate),
                        isAnnualDemand: false, // This is registration demand, not annual
                        year: financialYear,
                        notes: `New member registration demand (joined outside April)`,
                        isPaid: false,
                    });
                }

                // Create revenue demand for membership fees Group
                if (membershipGroup > 0) {
                    await MemberRevenueDemand.create({
                        memberId: member._id,
                        groupId: groupDoc._id,
                        revenueType: "membership_fees_group",
                        amount: membershipGroup,
                        demandDate: new Date(joinDate),
                        isAnnualDemand: false, // This is registration demand, not annual
                        year: financialYear,
                        notes: `New member registration demand (joined outside April)`,
                        isPaid: false,
                    });
                }
            }
        }

        return apiResponse.success(res, message.MEMBER_REGISTERED, member);

    } catch (error) {
        // Enhanced error logging
        console.error('Member registration error:', error);
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors || {}).map(err => err.message).join(', ');
            return apiResponse.error(res, `Validation error: ${validationErrors}`, 400);
        }
        if (error.name === 'MongoServerError' && error.code === 11000) {
            return apiResponse.error(res, 'Member with this ID already exists in this group', 400);
        }
        return apiResponse.error(res, error.message || 'Failed to register member', 500);
    }
};

/**
 * PUT /api/admin/member/:memberId/update-opening-saving
 * Admin only. Updates opening saving and records an adjustment for ledger history.
 */
export const updateOpeningSaving = async (req, res) => {
    try {
        if (req.user?.type === "group" || req.admin?.type === "group") {
            return apiResponse.error(res, "Only admin can update opening saving", 403);
        }
        const { memberId } = req.params;
        const { newOpeningSaving, reason } = req.body;
        if (!memberId) {
            return apiResponse.error(res, "memberId is required", 400);
        }
        const member = await Member.findById(memberId);
        if (!member) {
            return apiResponse.error(res, "Member not found", 404);
        }
        const groupId = member.group?.toString?.() || member.group;
        if (!groupId) {
            return apiResponse.error(res, "Member has no group", 400);
        }
        const adminPlace = req.user?.place || req.admin?.place;
        const accessCheck = await verifyGroupAccess(groupId, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "Access denied", 403);
        }
        const oldOpeningSaving = Number(member.openingSaving) || 0;
        const newVal = Number(newOpeningSaving);
        if (isNaN(newVal) || newVal < 0) {
            return apiResponse.error(res, "newOpeningSaving must be a number >= 0", 400);
        }
        const difference = newVal - oldOpeningSaving;
        member.openingSaving = newVal;
        if (!member.openingSavingAdjustments) {
            member.openingSavingAdjustments = [];
        }
        member.openingSavingAdjustments.push({
            date: new Date(),
            amount: difference,
            reason: typeof reason === "string" ? reason.trim() : "",
        });
        await member.save();
        return apiResponse.success(res, "Opening saving updated successfully", {
            memberId: member._id,
            previousOpeningSaving: oldOpeningSaving,
            newOpeningSaving: newVal,
            difference,
        });
    } catch (error) {
        return apiResponse.error(res, error.message || "Failed to update opening saving", 500);
    }
};

export const listMembersByGroup = async (req, res) => {
    try {
        const { groupId } = req.params;

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Verify group access
        const accessCheck = await verifyGroupAccess(groupId, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
        }

        const members = await Member.find({
            group: groupId,
            $or: [{ approvalStatus: 'approved' }, { approvalStatus: { $exists: false } }],
        })
            .sort({ createdAt: -1 })
            .lean();
        // Ensure F_H_Name and F_H_FatherName are always present in response (for Recovery Management member basic details)
        const membersWithFH = members.map((m) => ({
            ...m,
            F_H_Name: m.F_H_Name != null ? String(m.F_H_Name).trim() : "",
            F_H_FatherName: m.F_H_FatherName != null ? String(m.F_H_FatherName).trim() : "",
        }));
        return apiResponse.success(res, "Members fetched successfully", membersWithFH);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

/**
 * GET /api/admin/member/auto-member-code?group_id=...
 * Returns next suggested member code (e.g. M001, M002) for the given group.
 * Requires group_id. Uses count of existing members + 1, zero-padded to 3 digits.
 */
export const getAutoMemberCode = async (req, res) => {
    try {
        const groupId = req.query?.group_id;
        if (!groupId) {
            return apiResponse.error(res, "group_id is required", 400);
        }

        const adminPlace = req.user?.place || req.admin?.place;
        const accessCheck = await verifyGroupAccess(groupId, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
        }
        const groupDetail = await GroupMaster.findById(groupId).select("group_code cluster_code").lean();
        const groupCode = groupDetail?.group_code || "";
        const cluster_code = groupDetail?.cluster_code || "";
        const count = await Member.countDocuments({ group: groupId });
        const next = count + 1;
        const memberCode = cluster_code + groupCode + String(next).padStart(3, "0");

        return apiResponse.success(res, "Auto member code generated", { memberCode });
    } catch (error) {
        return apiResponse.error(res, error.message || "Failed to generate member code", 500);
    }
};

export const listMembers = async (req, res) => {
    try {
        const { group_id } = req.query;
        const approvalFilter = { $or: [{ approvalStatus: 'approved' }, { approvalStatus: { $exists: false } }] };
        const filter = group_id ? { group: group_id, ...approvalFilter } : approvalFilter;
        const members = await Member.find(filter).sort({ createdAt: -1 }).lean();
        return apiResponse.success(res, "Members fetched successfully", members);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

export const getMemberDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const member = await Member.findById(id).populate("group").lean();
        if (!member) return apiResponse.error(res, "Member not found", 404);

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Verify member's group belongs to admin's place
        if (member.group) {
            const groupId = member.group._id || member.group;
            const accessCheck = await verifyGroupAccess(groupId, adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(res, accessCheck.error || "You don't have access to this member's group", 403);
            }
        }

        return apiResponse.success(res, "Member detail fetched successfully", member);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

/** Build heads object for exit summary/settlement from demand snapshot (from calculateDemandDetails). */
function buildHeadsFromDemandSnapshot(dd) {
    if (!dd) {
        const zero = { key: "", label: "", prev: 0, curr: 0, total: 0, actual: 0, unpaid: 0, opening: 0, closing: 0 };
        return {
            saving: { ...zero, key: "saving", label: "Saving" },
            loan: { ...zero, key: "loan", label: "Loan" },
            fd: { ...zero, key: "fd", label: "FD" },
            interest: { ...zero, key: "interest", label: "Interest" },
            yogdan: { ...zero, key: "yogdan", label: "Yogdan" },
            membershipFee: { ...zero, key: "membership_fee", label: "Membership Fee (SHG)" },
            groupFee: { ...zero, key: "group_fee", label: "Group Fee" },
            charges: { ...zero, key: "charges", label: "Other Charges / Penalty" },
        };
    }
    const savingHead = {
        key: "saving",
        label: "Saving",
        prev: dd.saving?.prevDemand ?? 0,
        curr: dd.saving?.currDemand ?? 0,
        total: dd.saving?.totalDemand ?? 0,
        actual: dd.saving?.actualPaid ?? 0,
        unpaid: dd.saving?.unpaidDemand ?? 0,
        opening: dd.saving?.openingBalance ?? 0,
        closing: dd.saving?.closingBalance ?? 0,
    };
    const fdHead = {
        key: "fd",
        label: "FD",
        prev: 0,
        curr: 0,
        total: 0,
        actual: dd.fd?.actualPaid ?? 0,
        unpaid: 0,
        opening: dd.fd?.openingBalance ?? 0,
        closing: dd.fd?.closingBalance ?? 0,
    };
    const loanHead = {
        key: "loan",
        label: "Loan",
        prev: dd.loan?.prevDemand ?? 0,
        curr: dd.loan?.currDemand ?? 0,
        total: dd.loan?.totalDemand ?? 0,
        actual: dd.loan?.actualPaid ?? 0,
        unpaid: dd.loan?.unpaidDemand ?? 0,
        opening: dd.loan?.openingBalance ?? 0,
        closing: dd.loan?.closingBalance ?? 0,
    };
    const interestHead = {
        key: "interest",
        label: "Interest",
        prev: dd.interest?.prevDemand ?? 0,
        curr: dd.interest?.currDemand ?? 0,
        total: dd.interest?.totalDemand ?? 0,
        actual: dd.interest?.actualPaid ?? 0,
        unpaid: dd.interest?.unpaidDemand ?? 0,
        opening: dd.interest?.openingBalance ?? 0,
        closing: dd.interest?.closingBalance ?? 0,
    };
    const yogdanHead = {
        key: "yogdan",
        label: "Yogdan",
        prev: dd.yogdan?.prevDemand ?? 0,
        curr: dd.yogdan?.currDemand ?? 0,
        total: dd.yogdan?.totalDemand ?? 0,
        actual: dd.yogdan?.actualPaid ?? 0,
        unpaid: dd.yogdan?.unpaidDemand ?? 0,
        opening: dd.yogdan?.openingBalance ?? 0,
        closing: dd.yogdan?.closingBalance ?? 0,
    };
    const membershipFeeHead = {
        key: "membership_fee",
        label: "Membership Fee (SHG)",
        prev: dd.memFeesSHG?.prevDemand ?? 0,
        curr: dd.memFeesSHG?.currDemand ?? 0,
        total: dd.memFeesSHG?.totalDemand ?? 0,
        actual: dd.memFeesSHG?.actualPaid ?? 0,
        unpaid: dd.memFeesSHG?.unpaidDemand ?? 0,
        opening: 0,
        closing: dd.memFeesSHG?.unpaidDemand ?? 0,
    };
    const groupFeeHead = {
        key: "group_fee",
        label: "Group Fee",
        prev: dd.memFeesGroup?.prevDemand ?? 0,
        curr: dd.memFeesGroup?.currDemand ?? 0,
        total: dd.memFeesGroup?.totalDemand ?? 0,
        actual: dd.memFeesGroup?.actualPaid ?? 0,
        unpaid: dd.memFeesGroup?.unpaidDemand ?? 0,
        opening: 0,
        closing: dd.memFeesGroup?.unpaidDemand ?? 0,
    };
    const penaltyUnpaid = dd.penalty?.unpaidDemand ?? 0;
    const chargesUnpaid = dd.charges?.unpaidDemandTotal ?? 0;
    const chargesHead = {
        key: "charges",
        label: "Other Charges / Penalty",
        prev: 0,
        curr: (dd.penalty?.currDemand ?? 0) + (dd.charges?.chargesTotalDemand ?? 0),
        total: (dd.penalty?.totalDemand ?? 0) + (dd.charges?.chargesTotalDemand ?? 0),
        actual: (dd.penalty?.actualPaid ?? 0) + (dd.charges?.actualPaidTotal ?? 0),
        unpaid: penaltyUnpaid + chargesUnpaid,
        opening: 0,
        closing: penaltyUnpaid + chargesUnpaid,
    };
    return {
        saving: savingHead,
        loan: loanHead,
        fd: fdHead,
        interest: interestHead,
        yogdan: yogdanHead,
        membershipFee: membershipFeeHead,
        groupFee: groupFeeHead,
        charges: chargesHead,
    };
}

/**
 * GET /api/admin/member/exit-summary?memberId=...
 * Computes per-head balances from demand (calculateDemandDetails) and returns
 * a normalized summary used by the frontend settlement UI.
 */
export const getMemberExitSummary = async (req, res) => {
    try {
        const { memberId } = req.query;

        if (!memberId) {
            return apiResponse.error(res, "memberId is required", 400);
        }

        const member = await Member.findById(memberId).populate("group").lean();
        if (!member) {
            return apiResponse.error(res, "Member not found", 404);
        }

        const groupId = member.group?._id || member.group;
        if (!groupId) {
            return apiResponse.error(res, "Member group not found", 400);
        }

        const position = await calculateMemberExitPosition(groupId, memberId, new Date());

        const heads = buildHeadsFromDemandSnapshot(position.demandSnapshot);
        const totalPayoutToMember = position.receivable;
        const totalDuesFromMember = position.payable;
        const netAmount = position.net;
        const direction = position.direction;

        return apiResponse.success(res, "Member exit summary computed successfully", {
            member: {
                id: member._id,
                code: member.Member_Id,
                name: member.Member_Nm,
                groupId,
                groupName: member.group?.group_name || member.Group_Name,
            },
            heads,
            totals: {
                totalPayoutToMember,
                totalDuesFromMember,
                netAmount,
                direction,
            },
        });
    } catch (error) {
        console.error("Error computing member exit summary:", error);
        return apiResponse.error(res, error.message || "Failed to compute member exit summary", 500);
    }
};

/**
 * GET /api/admin/member/pending
 * Returns members with approvalStatus === 'pending' for admin approval.
 */
export const getPendingMembers = async (req, res) => {
    try {
        const adminPlace = req.user?.place || req.admin?.place;
        const filter = { approvalStatus: 'pending' };
        const members = await Member.find(filter)
            .populate('group', 'group_name group_code _id')
            .sort({ createdAt: -1 })
            .lean();

        const withAccess = [];
        for (const m of members) {
            const groupId = m.group?._id || m.group;
            if (!groupId) continue;
            const accessCheck = await verifyGroupAccess(groupId.toString(), adminPlace);
            if (accessCheck.valid) withAccess.push(m);
        }

        return apiResponse.success(res, "Pending members fetched", withAccess);
    } catch (error) {
        return apiResponse.error(res, error.message || "Failed to fetch pending members", 500);
    }
};

/**
 * PUT /api/admin/member/approve/:id
 * Approve a pending member.
 */
export const approveMember = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) return apiResponse.error(res, "Member id is required", 400);

        const member = await Member.findById(id);
        if (!member) return apiResponse.error(res, "Member not found", 404);
        if (member.approvalStatus !== 'pending') {
            return apiResponse.error(res, "Member is not pending approval", 400);
        }

        const adminPlace = req.user?.place || req.admin?.place;
        const groupId = member.group?._id || member.group;
        if (groupId) {
            const accessCheck = await verifyGroupAccess(groupId.toString(), adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(res, accessCheck.error || "Access denied", 403);
            }
        }

        member.approvalStatus = 'approved';
        await member.save();

        return apiResponse.success(res, "Member approved successfully", member);
    } catch (error) {
        return apiResponse.error(res, error.message || "Failed to approve member", 500);
    }
};

/**
 * PUT /api/admin/member/reject/:id
 * Reject a pending member (sets approvalStatus to 'rejected').
 */
export const rejectMember = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body || {};
        if (!id) return apiResponse.error(res, "Member id is required", 400);

        const member = await Member.findById(id);
        if (!member) return apiResponse.error(res, "Member not found", 404);
        if (member.approvalStatus !== 'pending') {
            return apiResponse.error(res, "Member is not pending approval", 400);
        }

        const adminPlace = req.user?.place || req.admin?.place;
        const groupId = member.group?._id || member.group;
        if (groupId) {
            const accessCheck = await verifyGroupAccess(groupId.toString(), adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(res, accessCheck.error || "Access denied", 403);
            }
        }

        member.approvalStatus = 'rejected';
        if (reason) member.rejectionReason = reason;
        await member.save();

        return apiResponse.success(res, "Member rejected", member);
    } catch (error) {
        return apiResponse.error(res, error.message || "Failed to reject member", 500);
    }
};

// UPDATE MEMBER
export const updateMember = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return apiResponse.error(res, "Member id is required", 400);
        }

        const member = await Member.findById(id);
        if (!member) {
            return apiResponse.error(res, "Member not found", 404);
        }

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Verify member's group belongs to admin's place
        if (member.group) {
            const groupId = member.group._id || member.group;
            const accessCheck = await verifyGroupAccess(groupId, adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(res, accessCheck.error || "You don't have access to this member's group", 403);
            }
        }

        // Parse date fields
        const payload = { ...req.body };
        // Only the dedicated update-opening-saving API can change these
        delete payload.openingSaving;
        delete payload.openingSavingAdjustments;
        const dateFields = ['Member_Dt', 'Dt_Join', 'dt_birth'];
        dateFields.forEach(field => {
            if (payload[field] && typeof payload[field] === 'string' && payload[field] !== '') {
                const dateValue = new Date(payload[field]);
                if (!isNaN(dateValue.getTime())) {
                    payload[field] = dateValue;
                }
            }
        });

        // Parse numeric fields
        const numericFields = ['Age', 'Anual_Income'];
        numericFields.forEach(field => {
            if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
                const numValue = Number(payload[field]);
                if (!isNaN(numValue)) {
                    payload[field] = numValue;
                }
            }
        });

        // Update member
        const updatedMember = await Member.findByIdAndUpdate(
            id,
            { $set: payload },
            { new: true, runValidators: true }
        ).populate("group").lean();

        return apiResponse.success(res, "Member updated successfully", updatedMember);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// DELETE MEMBER
export const deleteMember = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return apiResponse.error(res, "Member id is required", 400);
        }

        const member = await Member.findById(id);
        if (!member) {
            return apiResponse.error(res, "Member not found", 404);
        }

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Verify member's group belongs to admin's place
        if (member.group) {
            const groupId = member.group._id || member.group;
            const accessCheck = await verifyGroupAccess(groupId, adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(res, accessCheck.error || "You don't have access to this member's group", 403);
            }
        }

        // Check for dependencies - check if member has any active loans, FDs, or recoveries
        const activeLoans = await LoanMaster.find({
            memberId: id,
            status: { $ne: "completed" }
        }).lean();

        if (activeLoans && activeLoans.length > 0) {
            return apiResponse.error(
                res,
                `Cannot delete member. Member has ${activeLoans.length} active loan(s). Please complete or cancel the loans first.`,
                400
            );
        }

        const activeFDs = await FDMaster.find({
            memberId: id,
            status: { $ne: "matured" }
        }).lean();

        if (activeFDs && activeFDs.length > 0) {
            return apiResponse.error(
                res,
                `Cannot delete member. Member has ${activeFDs.length} active FD(s). Please mature or cancel the FDs first.`,
                400
            );
        }

        // Delete the member
        await Member.findByIdAndDelete(id);

        return apiResponse.success(res, "Member deleted successfully", { id });
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// Helper function to calculate member ledger
const calculateMemberLedger = async (member, fromDate, toDate) => {
    console.log('[MEMBER_LEDGER] Starting calculateMemberLedger', {
        memberId: member._id,
        memberCode: member.Member_Id,
        memberName: member.Member_Nm,
        fromDate,
        toDate,
        isExistingMember: member.isExistingMember
    });

    const entries = [];
    const memberId = member._id.toString();
    const groupId = member.group?._id || member.group;

    // Fetch group to get loan_rate for interest calculation
    const group = await GroupMaster.findById(groupId).lean();
    const loanRate = group?.loan_rate || 0;

    console.log('[MEMBER_LEDGER] Group details', {
        groupId,
        loanRate,
        groupName: group?.group_name
    });
    // Initialize running balances (use original opening for ledger; adjustments added as separate entries)
    const originalOpeningSaving = getOriginalOpeningSaving(member);
    let runningSavings = originalOpeningSaving;
    let runningLoan = 0; // Loans come from LoanMaster only
    let runningFD = 0; // FDs come from FDMaster only
    // For existing members, include overdueInterest from member.loanDetails (until paid)
    // Yogdan comes from LoanMaster only
    let runningInterest = member.isExistingMember && member.loanDetails?.overdueInterest ? member.loanDetails.overdueInterest : 0;
    let runningYogdanDue = 0; // Track cumulative yogdan due (1% of loans given) - from LoanMaster only
    let runningYogdanPaid = 0; // Track cumulative yogdan paid (recoveries not in ledger)
    let cumulativeLoanDisbursed = 0; // Track cumulative total loan disbursed (given to member)

    // Date range filter
    let dateFilter = {};
    if (fromDate || toDate) {
        dateFilter = {};
        if (fromDate) {
            const from = new Date(fromDate);
            from.setHours(0, 0, 0, 0);
            dateFilter.$gte = from;
        }
        if (toDate) {
            const to = new Date(toDate);
            to.setHours(23, 59, 59, 999);
            dateFilter.$lte = to;
        }
    }

    // Add opening balance entry if member is existing member
    if (member.isExistingMember) {
        const openingOverdueInterest = member.loanDetails?.overdueInterest || 0;
        console.log('[MEMBER_LEDGER] Processing existing member opening balances', {
            originalOpeningSaving,
            openingSaving: member.openingSaving,
            overdueInterest: openingOverdueInterest,
            note: 'Opening savings and overdue interest included - FD and Loan come from FDMaster and LoanMaster'
        });

        const openingDate = member.Dt_Join || member.createdAt || new Date();

        // Opening Saving entry (only for existing members) - use original amount so adjustments show separately
        if (originalOpeningSaving > 0 || openingOverdueInterest > 0) {
            const openingEntry = {
                date: openingDate,
                receipt: "Opening",
                savingsDeposit: originalOpeningSaving,
                savingsWithdraw: 0,
                savingsBalance: runningSavings,
                loanPaid: 0,
                loanRecovered: 0,
                loanBalance: 0,
                fdDeposit: 0,
                fdWithdraw: 0,
                fdBalance: 0,
                interestDue: 0,
                interestPaid: 0,
                yogdanDue: 0,
                yogdanPaid: 0,
                other: 0,
            };

            entries.push(openingEntry);
            console.log('[MEMBER_LEDGER] Added opening entry (savings and overdue interest)', openingEntry);
        }

        // Ledger adjustment entries for admin opening-saving changes (preserve history)
        const adjustments = (member.openingSavingAdjustments || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
        for (const adj of adjustments) {
            const amount = Number(adj.amount) || 0;
            if (amount === 0) continue;
            const deposit = amount > 0 ? amount : 0;
            const withdraw = amount < 0 ? Math.abs(amount) : 0;
            runningSavings += amount;
            entries.push({
                date: adj.date,
                receipt: "SAVING_OPENING_ADJUSTMENT",
                type: "openingSavingAdjustment",
                savingsDeposit: deposit,
                savingsWithdraw: withdraw,
                savingsBalance: Math.round(runningSavings * 100) / 100,
                loanPaid: 0,
                loanRecovered: 0,
                loanBalance: 0,
                fdDeposit: 0,
                fdWithdraw: 0,
                fdBalance: 0,
                interestDue: 0,
                interestPaid: 0,
                yogdanDue: 0,
                yogdanPaid: 0,
                other: 0,
                note: "Admin adjusted opening saving",
                reason: adj.reason || "",
            });
        }
    }

    // Fetch loans from LoanMaster
    const loanFilter = { memberId: memberId };
    if (Object.keys(dateFilter).length > 0) {
        loanFilter.date = dateFilter;
    }
    const loans = await LoanMaster.find(loanFilter).sort({ date: 1 }).lean();
    console.log('[MEMBER_LEDGER] Found loans from LoanMaster', {
        count: loans.length,
        loans: loans.map(l => ({ id: l._id, date: l.date, type: l.transactionType, amount: l.amount }))
    });

    // Add loan transactions from LoanMaster
    loans.forEach((loan) => {
        const loanDate = loan.date || loan.createdAt;
        const amount = parseFloat(loan.amount || 0);

        if (loan.transactionType === "Loan") {
            runningLoan += amount;
            cumulativeLoanDisbursed += amount;
            // Use yogdanAmount directly from LoanMaster instead of calculating
            const yogdanDue = Math.round((parseFloat(loan.yogdanAmount || 0)) * 100) / 100; // Round to 2 decimal places
            console.log('[MEMBER Yogdan Due]', yogdanDue);
            runningYogdanDue += yogdanDue;
            entries.push({
                date: loanDate,
                receipt: `Loan - ${loan.purpose || "N/A"}`,
                savingsDeposit: 0,
                savingsWithdraw: 0,
                savingsBalance: runningSavings,
                loanPaid: amount, // Show only the loan amount for this transaction, not cumulative
                loanRecovered: 0,
                loanBalance: runningLoan,
                loanAmount: amount, // Store actual loan amount for recalculation
                fdDeposit: 0,
                fdWithdraw: 0,
                fdBalance: runningFD,
                interestDue: runningInterest,
                interestPaid: 0,
                yogdanDue: yogdanDue, // Use yogdanAmount from LoanMaster
                yogdanPaid: 0,
                other: 0,
            });
            console.log('[MEMBER_LEDGER] Added loan entry with yogdan', {
                date: loanDate,
                loanAmount: amount,
                yogdanAmount: loan.yogdanAmount,
                yogdanDue: yogdanDue,
                runningYogdanDue: runningYogdanDue
            });
        } else if (loan.transactionType === "Saving") {
            runningSavings += amount;
            entries.push({
                date: loanDate,
                receipt: `Saving - ${loan.purpose || "N/A"}`,
                savingsDeposit: amount,
                savingsWithdraw: 0,
                savingsBalance: runningSavings,
                loanPaid: 0, // No loan disbursed in Saving entries
                loanRecovered: 0,
                loanBalance: runningLoan,
                fdDeposit: 0,
                fdWithdraw: 0,
                fdBalance: runningFD,
                interestDue: runningInterest,
                interestPaid: 0,
                yogdanDue: 0,
                yogdanPaid: 0,
                other: 0,
            });
        } else if (loan.transactionType === "FD") {
            runningFD += amount;
            entries.push({
                date: loanDate,
                receipt: `FD - ${loan.purpose || "N/A"}`,
                savingsDeposit: 0,
                savingsWithdraw: 0,
                savingsBalance: runningSavings,
                loanPaid: 0, // No loan disbursed in FD entries
                loanRecovered: 0,
                loanBalance: runningLoan,
                fdDeposit: amount,
                fdWithdraw: 0,
                fdBalance: runningFD,
                interestDue: runningInterest,
                interestPaid: 0,
                yogdanDue: 0,
                yogdanPaid: 0,
                other: 0,
            });
        }
    });

    // Fetch FDs from FDMaster
    const fdFilter = { memberId: memberId };
    if (Object.keys(dateFilter).length > 0) {
        fdFilter.date = dateFilter;
    }
    const fds = await FDMaster.find(fdFilter).sort({ date: 1 }).lean();
    console.log('[MEMBER_LEDGER] Found FDs from FDMaster', {
        count: fds.length,
        fds: fds.map(f => ({ id: f._id, date: f.date, amount: f.amount, status: f.status }))
    });

    // Add FD transactions from FDMaster
    fds.forEach((fd) => {
        const fdDate = fd.date || fd.createdAt;
        const amount = parseFloat(fd.amount || 0);

        if (amount > 0) {
            runningFD += amount;
            entries.push({
                date: fdDate,
                receipt: `FD - ${fd.status || "Active"}`,
                savingsDeposit: 0,
                savingsWithdraw: 0,
                savingsBalance: runningSavings,
                loanPaid: 0, // No loan disbursed in FD entries
                loanRecovered: 0,
                loanBalance: runningLoan,
                fdDeposit: amount,
                fdWithdraw: 0,
                fdBalance: runningFD,
                interestDue: runningInterest,
                interestPaid: 0,
                yogdanDue: 0,
                yogdanPaid: 0,
                other: 0,
            });
        }
    });

    // Fetch PaymentMaster entries for savings withdrawal and FD maturity
    const paymentFilter = {
        memberId: memberId,
        status: { $in: ["approved", "completed"] } // Only approved/completed payments
    };
    if (Object.keys(dateFilter).length > 0) {
        paymentFilter.paymentDate = dateFilter;
    }
    const payments = await PaymentMaster.find(paymentFilter)
        .sort({ paymentDate: 1 })
        .lean();
    console.log('[MEMBER_LEDGER] Found PaymentMaster entries', {
        count: payments.length,
        payments: payments.map(p => ({
            id: p._id,
            date: p.paymentDate,
            type: p.paymentType,
            amount: p.amount,
            status: p.status
        }))
    });

    // Add PaymentMaster entries (savings withdrawal and FD maturity)
    payments.forEach((payment) => {
        const paymentDate = payment.paymentDate || payment.createdAt;
        const amount = parseFloat(payment.amount || 0);

        if (payment.paymentType === "saving_withdrawal" && amount > 0) {
            // Savings withdrawal - reduces savings balance
            runningSavings = Math.max(0, runningSavings - amount);
            entries.push({
                date: paymentDate,
                receipt: "Savings Withdrawal",
                savingsDeposit: 0,
                savingsWithdraw: amount,
                savingsBalance: runningSavings,
                loanPaid: 0,
                loanRecovered: 0,
                loanBalance: runningLoan,
                fdDeposit: 0,
                fdWithdraw: 0,
                fdBalance: runningFD,
                interestDue: runningInterest,
                interestPaid: 0,
                yogdanDue: 0,
                yogdanPaid: 0,
                other: 0,
                paymentMode: payment.paymentMode || "Bank",
            });
            console.log('[MEMBER_LEDGER] Added savings withdrawal entry', {
                date: paymentDate,
                amount,
                newSavingsBalance: runningSavings
            });
        } else if (payment.paymentType === "fd_maturity" && amount > 0) {
            // FD maturity - reduces FD balance
            runningFD = Math.max(0, runningFD - amount);
            entries.push({
                date: paymentDate,
                receipt: "FD Maturity",
                savingsDeposit: 0,
                savingsWithdraw: 0,
                savingsBalance: runningSavings,
                loanPaid: 0,
                loanRecovered: 0,
                loanBalance: runningLoan,
                fdDeposit: 0,
                fdWithdraw: amount,
                fdBalance: runningFD,
                interestDue: runningInterest,
                interestPaid: 0,
                yogdanDue: 0,
                yogdanPaid: 0,
                other: 0,
                paymentMode: payment.paymentMode || "Bank",
            });
            console.log('[MEMBER_LEDGER] Added FD maturity entry', {
                date: paymentDate,
                amount,
                newFDBalance: runningFD
            });
        }
    });

    console.log('[MEMBER_LEDGER] Added PaymentMaster entries', {
        totalPaymentsProcessed: payments.length,
        paymentEntriesAdded: entries.filter(e => e.receipt === "Savings Withdrawal" || e.receipt === "FD Maturity").length
    });

    // Add RecoveryMaster entries for saving recovery details
    const recoveryFilter = { groupId: groupId };
    if (Object.keys(dateFilter).length > 0) {
        recoveryFilter.date = dateFilter;
    }
    const recoveries = await RecoveryMaster.find(recoveryFilter).sort({ date: 1 }).lean();
    console.log('[MEMBER_LEDGER] Found RecoveryMaster entries', {
        count: recoveries.length,
        recoveries: recoveries.map(r => ({ id: r._id, date: r.date, memberCount: r.recoveries?.length || 0 }))
    });

    // Process recovery entries for this member (all recovery amounts)
    recoveries.forEach((recovery) => {
        const recoveryDate = recovery.date || recovery.createdAt;
        const memberRecovery = recovery.recoveries?.find(
            r => r.memberId === memberId || r.memberId?.toString() === memberId
        );

        if (memberRecovery && memberRecovery.amounts) {
            const amounts = memberRecovery.amounts;
            const savingAmount = parseFloat(amounts.saving || 0);
            const loanAmount = parseFloat(amounts.loan || 0);
            const interestAmount = parseFloat(amounts.interest || 0);
            const yogdanAmount = parseFloat(amounts.yogdan || 0);
            const fdAmount = parseFloat(amounts.fd || 0);
            const otherAmount = parseFloat(amounts.other || 0);
            const charges = amounts.charges || {};
            const totalAmount = parseFloat(memberRecovery.total || 0);

            // Check if there's any amount to include
            const hasAnyAmount = savingAmount > 0 || loanAmount > 0 || interestAmount > 0 ||
                yogdanAmount > 0 || fdAmount > 0 || otherAmount > 0 ||
                Object.keys(charges).length > 0;

            if (hasAnyAmount) {
                console.log('[MEMBER_LEDGER] Processing recovery entry', {
                    date: recoveryDate,
                    memberId,
                    savingAmount,
                    loanAmount,
                    interestAmount,
                    yogdanAmount,
                    fdAmount,
                    otherAmount,
                    charges,
                    totalAmount,
                    recoveryId: recovery._id
                });

                // Store due amounts BEFORE payment (for display in receipt)
                const interestDueBeforePayment = runningInterest;
                const yogdanDueBeforePayment = runningYogdanDue;

                // Update running balances
                runningSavings += savingAmount;
                runningLoan = Math.max(0, runningLoan - loanAmount);
                runningInterest = Math.max(0, runningInterest - interestAmount);
                runningFD += fdAmount;
                runningYogdanPaid += yogdanAmount;

                entries.push({
                    date: recoveryDate,
                    receipt: "Recovery",
                    savingsDeposit: savingAmount,
                    savingsWithdraw: 0,
                    savingsBalance: runningSavings,
                    loanPaid: 0,
                    loanRecovered: loanAmount,
                    loanBalance: runningLoan,
                    fdDeposit: fdAmount,
                    fdWithdraw: 0,
                    fdBalance: runningFD,
                    interestDue: interestDueBeforePayment,
                    interestPaid: interestAmount,
                    yogdanDue: yogdanDueBeforePayment,
                    yogdanPaid: yogdanAmount,
                    other: otherAmount,
                    charges: charges,
                    paymentMode: memberRecovery.paymentMode?.cash ? "Cash" : (memberRecovery.paymentMode?.online ? "Online" : ""),
                });
            }
        }
    });

    console.log('[MEMBER_LEDGER] Added RecoveryMaster entries', {
        totalRecoveriesProcessed: recoveries.length,
        recoveryEntriesAdded: entries.filter(e => e.receipt === "Recovery").length
    });

    // Sort by date
    entries.sort((a, b) => new Date(a.date) - new Date(b.date));

    console.log('[MEMBER_LEDGER] Total entries before recalculation', {
        count: entries.length,
        entries: entries.map(e => ({ date: e.date, receipt: e.receipt, savingsDeposit: e.savingsDeposit, loanPaid: e.loanPaid, fdDeposit: e.fdDeposit }))
    });

    // Recalculate running balances in chronological order to ensure accuracy
    let recalcSavings = member.openingSaving || 0; // Start with opening savings only
    let recalcLoan = 0; // Loans come from LoanMaster only
    let recalcFD = 0; // FDs come from FDMaster only
    // For existing members, start with overdueInterest from member.loanDetails (until paid)
    // Yogdan comes from LoanMaster only
    let recalcInterest = member.isExistingMember && member.loanDetails?.overdueInterest ? member.loanDetails.overdueInterest : 0;
    let recalcYogdanDue = 0; // Track cumulative yogdan due (from LoanMaster only)
    let recalcYogdanPaid = 0; // Track cumulative yogdan paid
    let recalcCumulativeLoanDisbursed = 0;

    entries.forEach((entry) => {
        if (entry.receipt === "Opening") {
            // Opening entry contains opening savings and overdue interest (FD and Loan come from FDMaster and LoanMaster)
            if (entry.savingsDeposit > 0) {
                recalcSavings = entry.savingsDeposit;
            }
            // Overdue interest is included in opening entry for existing members
            if (entry.interestDue > 0) {
                recalcInterest = entry.interestDue;
            }
            entry.loanPaid = 0; // No loan disbursed in opening entry
        } else if (entry.receipt.startsWith("Loan -")) {
            // Use stored loanAmount if available, otherwise calculate from balance difference
            let loanAmount = entry.loanAmount;
            if (!loanAmount || loanAmount <= 0) {
                loanAmount = entry.loanBalance - recalcLoan;
            }
            if (loanAmount > 0) {
                recalcLoan += loanAmount;
                recalcCumulativeLoanDisbursed += loanAmount;
                // Use yogdanDue from entry (already set from LoanMaster.yogdanAmount) - don't recalculate
                // If yogdanDue is not set in entry, it means it wasn't set from LoanMaster, so use 0
                if (entry.yogdanDue === undefined || entry.yogdanDue === null) {
                    entry.yogdanDue = 0; // Default to 0 if not set from LoanMaster
                }
                recalcYogdanDue += entry.yogdanDue;
                console.log('[MEMBER_LEDGER] Using yogdanDue from LoanMaster for loan entry', {
                    date: entry.date,
                    receipt: entry.receipt,
                    loanAmount,
                    yogdanDue: entry.yogdanDue,
                    recalcYogdanDue
                });
            }
            entry.loanPaid = loanAmount; // Show only the loan amount for this transaction, not cumulative
        } else if (entry.receipt.startsWith("FD -")) {
            recalcFD += entry.fdDeposit;
            entry.loanPaid = 0; // No loan disbursed in FD entries
        } else if (entry.receipt.startsWith("Saving -")) {
            recalcSavings += entry.savingsDeposit;
            entry.loanPaid = 0; // No loan disbursed in Saving entries
        } else if (entry.receipt === "SAVING_OPENING_ADJUSTMENT" || entry.type === "openingSavingAdjustment") {
            recalcSavings += (entry.savingsDeposit || 0) - (entry.savingsWithdraw || 0);
            entry.loanPaid = 0;
        } else if (entry.receipt === "Recovery") {
            // Handle full recovery entry with all amounts
            recalcSavings += entry.savingsDeposit || 0;
            recalcLoan = Math.max(0, recalcLoan - (entry.loanRecovered || 0));
            recalcInterest = Math.max(0, recalcInterest - (entry.interestPaid || 0));
            recalcFD += entry.fdDeposit || 0;
            recalcYogdanPaid += entry.yogdanPaid || 0;
            entry.loanPaid = 0; // No loan disbursed in Recovery entries
            console.log('[MEMBER_LEDGER] Recalculating recovery entry', {
                date: entry.date,
                savingsDeposit: entry.savingsDeposit,
                loanRecovered: entry.loanRecovered,
                interestPaid: entry.interestPaid,
                yogdanPaid: entry.yogdanPaid,
                fdDeposit: entry.fdDeposit,
                newSavingsBalance: recalcSavings,
                newLoanBalance: recalcLoan,
                newInterestBalance: recalcInterest,
                newFDBalance: recalcFD
            });
        } else if (entry.receipt === "Savings Withdrawal") {
            recalcSavings = Math.max(0, recalcSavings - (entry.savingsWithdraw || 0));
            entry.loanPaid = 0; // No loan disbursed in Savings Withdrawal entries
        } else if (entry.receipt === "FD Maturity") {
            recalcFD = Math.max(0, recalcFD - (entry.fdWithdraw || 0));
            entry.loanPaid = 0; // No loan disbursed in FD Maturity entries
        }

        // Update entry balances    
        entry.savingsBalance = Math.round(recalcSavings * 100) / 100;
        entry.loanBalance = Math.round(recalcLoan * 100) / 100;
        entry.fdBalance = Math.round(recalcFD * 100) / 100;
        // For recovery entries, preserve the original interestDue and yogdanDue (set before payment)
        // For other entries, use recalculated values
        if (entry.receipt === "Recovery") {
            // Preserve original due amounts (set before payment) - just round them
            entry.interestDue = Math.round((entry.interestDue || 0) * 100) / 100;
            entry.yogdanDue = Math.round((entry.yogdanDue || 0) * 100) / 100;
        } else {
            // For non-recovery entries, use recalculated values
            entry.interestDue = Math.round(recalcInterest * 100) / 100;
            // Ensure yogdanDue is set for all entries and properly formatted
            if (entry.yogdanDue === undefined || entry.yogdanDue === null) {
                entry.yogdanDue = 0;
            } else {
                entry.yogdanDue = Math.round(entry.yogdanDue * 100) / 100; // Round to 2 decimal places
            }
        }
        if (entry.yogdanPaid === undefined || entry.yogdanPaid === null) {
            entry.yogdanPaid = 0;
        } else {
            entry.yogdanPaid = Math.round(entry.yogdanPaid * 100) / 100; // Round to 2 decimal places
        }

        // Log each entry after recalculation for debugging
        console.log('[MEMBER_LEDGER] Entry after recalculation', {
            date: entry.date,
            receipt: entry.receipt,
            savingsBalance: entry.savingsBalance,
            loanBalance: entry.loanBalance,
            fdBalance: entry.fdBalance,
            interestDue: entry.interestDue,
            yogdanDue: entry.yogdanDue,
            yogdanPaid: entry.yogdanPaid,
            loanPaid: entry.loanPaid,
            loanRecovered: entry.loanRecovered,
            savingsDeposit: entry.savingsDeposit,
            savingsWithdraw: entry.savingsWithdraw,
            fdDeposit: entry.fdDeposit,
            fdWithdraw: entry.fdWithdraw,
            interestPaid: entry.interestPaid,
            charges: entry.charges
        });
    });

    console.log('[MEMBER_LEDGER] After recalculation', {
        finalSavings: recalcSavings,
        finalLoan: recalcLoan,
        finalFD: recalcFD,
        finalInterest: recalcInterest,
        finalYogdanDue: recalcYogdanDue,
        finalYogdanPaid: recalcYogdanPaid,
        totalEntries: entries.length
    });

    // Calculate summary
    const summary = {
        totalSavingsDeposit: entries.reduce((sum, e) => sum + (e.savingsDeposit || 0), 0),
        totalSavingsWithdraw: entries.reduce((sum, e) => sum + (e.savingsWithdraw || 0), 0),
        totalLoanPaid: entries.reduce((sum, e) => sum + (e.loanPaid || 0), 0),
        totalLoanRecovered: entries.reduce((sum, e) => sum + (e.loanRecovered || 0), 0),
        totalFdDeposit: entries.reduce((sum, e) => sum + (e.fdDeposit || 0), 0),
        totalFdWithdraw: entries.reduce((sum, e) => sum + (e.fdWithdraw || 0), 0),
        totalInterestPaid: entries.reduce((sum, e) => sum + (e.interestPaid || 0), 0),
        // totalYogdanDue should only count from loan entries (not recovery entries) to get total from all loans
        totalYogdanDue: entries
            .filter(e => e.receipt && e.receipt.startsWith("Loan -"))
            .reduce((sum, e) => sum + (e.yogdanDue || 0), 0),
        totalYogdanPaid: entries.reduce((sum, e) => sum + (e.yogdanPaid || 0), 0),
        totalCharges: entries.reduce((sum, e) => {
            if (e.charges) {
                return sum + Object.values(e.charges).reduce((chargeSum, amount) => chargeSum + (amount || 0), 0);
            }
            return sum;
        }, 0),
        totalOther: entries.reduce((sum, e) => sum + (e.other || 0), 0),
        openingSavings: member.openingSaving || 0, // current value (after adjustments)
        openingLoan: 0, // Loans come from LoanMaster only
        openingFD: 0, // FDs come from FDMaster only
        openingInterest: member.isExistingMember && member.loanDetails?.overdueInterest ? member.loanDetails.overdueInterest : 0, // Overdue interest from member.loanDetails (for existing members)
        openingYogdan: 0, // Yogdan calculated from loans in LoanMaster
        closingSavings: recalcSavings,
        closingLoan: recalcLoan,
        closingFD: recalcFD,
        closingInterest: recalcInterest, // Already calculated as remaining after payments
        closingYogdanDue: Math.max(0, recalcYogdanDue - recalcYogdanPaid), // Remaining yogdan due after payments
        closingYogdanPaid: recalcYogdanPaid,
    };

    console.log('[MEMBER_LEDGER] Final summary', {
        totalEntries: entries.length,
        summary: {
            totalSavingsDeposit: summary.totalSavingsDeposit,
            totalLoanPaid: summary.totalLoanPaid,
            totalFdDeposit: summary.totalFdDeposit,
            totalYogdanDue: summary.totalYogdanDue,
            totalYogdanPaid: summary.totalYogdanPaid
        }
    });

    return {
        entries,
        summary,
    };
};

// Get member financial ledger
export const getMemberFinancialLedger = async (req, res) => {
    try {
        const { memberId, fromDate, toDate } = req.query;

        if (!memberId) {
            return apiResponse.error(res, "memberId is required", 400);
        }

        // Fetch member
        const member = await Member.findById(memberId).populate("group").lean();
        if (!member) {
            return apiResponse.error(res, "Member not found", 404);
        }

        // Calculate ledger
        const ledger = await calculateMemberLedger(member, fromDate, toDate);

        // Log the final ledger data before sending
        console.log('[MEMBER_LEDGER] Final ledger data being sent to frontend', {
            memberId: member._id,
            memberCode: member.Member_Id,
            entryCount: ledger.entries.length,
            entries: ledger.entries.map(e => ({
                date: e.date,
                receipt: e.receipt,
                savingsBalance: e.savingsBalance,
                loanBalance: e.loanBalance,
                fdBalance: e.fdBalance,
                interestDue: e.interestDue,
                yogdanDue: e.yogdanDue,
                yogdanPaid: e.yogdanPaid,
                loanPaid: e.loanPaid,
                loanRecovered: e.loanRecovered,
                savingsDeposit: e.savingsDeposit,
                savingsWithdraw: e.savingsWithdraw,
                fdDeposit: e.fdDeposit,
                fdWithdraw: e.fdWithdraw,
                interestPaid: e.interestPaid
            })),
            summary: ledger.summary
        });

        return apiResponse.success(res, "Member financial ledger fetched successfully", {
            memberInfo: {
                id: member._id,
                code: member.Member_Id,
                name: member.Member_Nm,
                fatherName: member.F_H_Name || member.F_H_FatherName,
                village: member.Village,
            },
            ledger: ledger.entries,
            summary: ledger.summary,
        });
    } catch (error) {
        console.error("Error fetching member financial ledger:", error);
        return apiResponse.error(res, error.message, 500);
    }
};

// Export member ledger
export const exportMemberLedger = async (req, res) => {
    try {
        const { memberId, groupId, fromDate, toDate } = req.query;

        // Build member filter
        const memberFilter = {};
        if (memberId) {
            memberFilter._id = memberId;
        }
        if (groupId) {
            memberFilter.group = groupId;
        }

        // Fetch members
        const members = await Member.find(memberFilter)
            .populate("group", "group_name group_code")
            .lean();

        if (!members || members.length === 0) {
            return apiResponse.error(res, "No members found", 404);
        }

        // Calculate ledger for each member
        const ledgerData = [];
        for (const member of members) {
            const ledger = await calculateMemberLedger(member, fromDate, toDate);

            ledgerData.push({
                memberInfo: {
                    id: member._id,
                    code: member.Member_Id,
                    name: member.Member_Nm,
                    fatherName: member.F_H_Name || member.F_H_FatherName,
                    village: member.Village,
                    groupName: member.group?.group_name || member.Group_Name,
                    groupCode: member.group?.group_code,
                    joiningDate: member.Dt_Join || member.createdAt,
                    isExistingMember: member.isExistingMember || false,
                },
                ledger: ledger.entries,
                summary: ledger.summary,
            });
        }

        return apiResponse.success(res, "Member ledger exported successfully", ledgerData);
    } catch (error) {
        console.error("Error exporting member ledger:", error);
        return apiResponse.error(res, error.message, 500);
    }
};

/**
 * POST /api/admin/member/exit-settlement
 * Finalizes an exit settlement by re-computing the summary, validating the net amount,
 * storing a snapshot in MemberExitSettlement, and (for GROUP_PAYS) creating a PaymentMaster
 * payout that updates bank/cash balances and ledger entries.
 */
export const createMemberExitSettlement = async (req, res) => {
    try {
        const {
            memberId,
            confirmedNetAmount,
            direction,
            payoutPaymentMode, // "Cash" | "Bank"
            bankId, // required when payoutPaymentMode === "Bank"
            paymentReference,
            paymentDate,
            notes,
        } = req.body || {};

        if (!memberId) {
            return apiResponse.error(res, "memberId is required", 400);
        }

        const member = await Member.findById(memberId).populate("group");
        if (!member) {
            return apiResponse.error(res, "Member not found", 404);
        }

        const groupId = member.group?._id || member.group;
        if (!groupId) {
            return apiResponse.error(res, "Member group not found", 400);
        }

        const existingSettlement = await MemberExitSettlement.findOne({
            groupId,
            $or: [{ memberId: member._id }, { memberId }],
        }).lean();
        if (existingSettlement) {
            return apiResponse.error(res, "Member has already been settled", 400);
        }

        const exitDate = paymentDate ? new Date(paymentDate) : new Date();
        const position = await calculateMemberExitPosition(groupId, memberId, exitDate);

        const backendNet = position.net;
        const backendDirection = position.direction;

        const clientNet = Number(confirmedNetAmount);
        if (Number.isNaN(clientNet)) {
            return apiResponse.error(res, "confirmedNetAmount must be a valid number", 400);
        }

        if (Math.round(backendNet * 100) !== Math.round(clientNet * 100)) {
            return apiResponse.error(
                res,
                `Net amount mismatch. Expected ${backendNet}, received ${clientNet}`,
                400
            );
        }

        if (direction && direction !== backendDirection) {
            return apiResponse.error(
                res,
                `Direction mismatch. Expected ${backendDirection}, received ${direction}`,
                400
            );
        }

        const adminPlace = req.user?.place || req.admin?.place;
        const createdBy = req.user?.id || req.admin?.id || "system";
        const settlementHeads = buildHeadsFromDemandSnapshot(position.demandSnapshot);

        let payment = null;
        const session = await mongoose.startSession();
        try {
            await session.startTransaction();

        // If group (samooh) pays member: net > 0 → deduct amount from group cash/bank
        if (backendDirection === "GROUP_PAYS" && backendNet > 0) {
            const payoutAmount = backendNet;
            const normalizedMode = payoutPaymentMode === "Bank" ? "Bank" : "Cash";

            // Verify group access
            const accessCheck = await verifyGroupAccess(groupId, adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
            }

            // Load group as Mongoose document (for recalculateCashBalance)
            const group = await GroupMaster.findById(groupId);
            if (!group) {
                return apiResponse.error(res, "Group not found", 404);
            }

            // Validate balances based on payout mode
            let bank = null;
            if (normalizedMode === "Bank") {
                if (!bankId) {
                    return apiResponse.error(res, "bankId is required when payoutPaymentMode is Bank", 400);
                }

                bank = await BankMaster.findById(bankId);
                if (!bank) {
                    return apiResponse.error(res, "Bank not found", 404);
                }

                if (bank.group_id && bank.group_id.toString() !== groupId.toString()) {
                    return apiResponse.error(res, "Bank does not belong to the specified group", 400);
                }

                const balanceInfo = await BankMaster.calculateAvailableBalance(bankId);
                const availableBalance = balanceInfo.availableBalance || 0;
                if (availableBalance < payoutAmount) {
                    return apiResponse.error(
                        res,
                        `Insufficient bank balance. Available: ₹${availableBalance.toFixed(2)}, Required: ₹${payoutAmount.toFixed(2)}`,
                        400
                    );
                }
            } else {
                await group.recalculateCashBalance();
                const cashBalance = group.current_cash_balance || 0;
                if (cashBalance < payoutAmount) {
                    return apiResponse.error(
                        res,
                        `Insufficient cash balance. Available: ₹${cashBalance.toFixed(2)}, Required: ₹${payoutAmount.toFixed(2)}`,
                        400
                    );
                }
            }

            const effectivePaymentDate = paymentDate ? new Date(paymentDate) : new Date();

            // Create PaymentMaster entry for exit payout
            payment = await PaymentMaster.create({
                memberId: member._id,
                memberCode: member.Member_Id,
                memberName: member.Member_Nm,
                groupId,
                groupName: member.group?.group_name || member.Group_Name,
                groupCode: member.group?.group_code,
                paymentType: "member_exit_payout",
                amount: payoutAmount,
                paymentMode: normalizedMode,
                bankId: normalizedMode === "Bank" && bank ? bank._id : null,
                status: "approved",
                paymentDate: effectivePaymentDate,
                createdBy,
                remarks: notes || paymentReference || "Member exit settlement payout",
            }, { session });

            // Update bank/cash balances and transaction records
            if (normalizedMode === "Bank" && bank) {
                const paymentAmount = payoutAmount;
                const balanceBefore = bank.current_balance || 0;
                bank.current_balance = Math.max(0, balanceBefore - paymentAmount);
                await bank.save({ session });

                const { createBankTransactionRecord } = await import("../../utility/bankTransactionHelper.js");
                await createBankTransactionRecord({
                    bankId: bank._id,
                    groupId,
                    transactionType: "payment",
                    amount: paymentAmount,
                    date: effectivePaymentDate,
                    description: `Payment - member_exit_payout: ${member.Member_Nm} (${member.Member_Id})`,
                    paymentId: payment._id,
                    memberId: payment.memberId,
                    memberCode: payment.memberCode,
                    memberName: payment.memberName,
                    createdBy,
                    status: "verified",
                    session,
                });
            } else if (normalizedMode === "Cash") {
                const paymentAmount = payoutAmount;
                await group.recalculateCashBalance();
                const cashBalanceBefore = group.current_cash_balance || 0;
                group.current_cash_balance = Math.max(0, cashBalanceBefore - paymentAmount);
                await group.save({ session });

                await createCashTransactionRecord({
                    groupId,
                    transactionType: "payment",
                    amount: paymentAmount,
                    date: effectivePaymentDate,
                    description: `Payment - member_exit_payout: ${member.Member_Nm} (${member.Member_Id})`,
                    paymentId: payment._id,
                    memberId: payment.memberId,
                    memberCode: payment.memberCode,
                    memberName: payment.memberName,
                    createdBy,
                    session,
                });
            }

            // Post ledger entry for exit payout
            const headInfo = await findOrCreateHead(groupId, "Member Exit Settlement", "liability", session);
            await postTransaction({
                sourceDoc: payment,
                headName: "Member Exit Settlement",
                headType: headInfo?.headType || "groupMaster",
                headId: headInfo?.headId,
                section: "liability",
                amount: payoutAmount,
                direction: "out",
                groupId,
                memberId: payment.memberId,
                date: effectivePaymentDate,
                notes: `Member exit settlement payout - Member: ${member.Member_Nm} (${member.Member_Id})`,
                paymentMode: normalizedMode,
                bankId: normalizedMode === "Bank" ? bankId : undefined,
                referenceModel: "PaymentMaster",
                referenceId: payment._id,
                createdBy,
                session,
            });
        }

        // If member pays group: net < 0 → add amount to group cash/bank
        if (backendDirection === "MEMBER_PAYS" && backendNet < 0) {
            const incomingAmount = Math.abs(backendNet);
            const normalizedMode = payoutPaymentMode === "Bank" ? "Bank" : "Cash";

            // Verify group access
            const accessCheck = await verifyGroupAccess(groupId, adminPlace);
            if (!accessCheck.valid) {
                return apiResponse.error(
                    res,
                    accessCheck.error || "Group not found or you don't have access to this group",
                    403
                );
            }

            // Load group as Mongoose document (for recalculateCashBalance)
            const group = await GroupMaster.findById(groupId);
            if (!group) {
                return apiResponse.error(res, "Group not found", 404);
            }

            let bank = null;
            if (normalizedMode === "Bank") {
                if (!bankId) {
                    return apiResponse.error(res, "bankId is required when payoutPaymentMode is Bank", 400);
                }

                bank = await BankMaster.findById(bankId);
                if (!bank) {
                    return apiResponse.error(res, "Bank not found", 404);
                }

                if (bank.group_id && bank.group_id.toString() !== groupId.toString()) {
                    return apiResponse.error(
                        res,
                        "Bank does not belong to the specified group",
                        400
                    );
                }
            }

            const effectivePaymentDate = paymentDate ? new Date(paymentDate) : new Date();

            // Create PaymentMaster entry for exit inflow from member
            payment = await PaymentMaster.create({
                memberId: member._id,
                memberCode: member.Member_Id,
                memberName: member.Member_Nm,
                groupId,
                groupName: member.group?.group_name || member.Group_Name,
                groupCode: member.group?.group_code,
                paymentType: "member_exit_recovery",
                amount: incomingAmount,
                paymentMode: normalizedMode,
                bankId: normalizedMode === "Bank" && bank ? bank._id : null,
                status: "approved",
                paymentDate: effectivePaymentDate,
                createdBy,
                remarks: notes || paymentReference || "Member exit settlement – member pays group",
            }, { session });

            // Update bank/cash balances and transaction records (inflow)
            if (normalizedMode === "Bank" && bank) {
                const paymentAmount = incomingAmount;
                const balanceBefore = bank.current_balance || 0;
                bank.current_balance = balanceBefore + paymentAmount;
                await bank.save({ session });

                const { createBankTransactionRecord } = await import("../../utility/bankTransactionHelper.js");
                await createBankTransactionRecord({
                    bankId: bank._id,
                    groupId,
                    transactionType: "member_exit_recovery",
                    amount: paymentAmount,
                    date: effectivePaymentDate,
                    description: `Member exit recovery (bank): ${member.Member_Nm} (${member.Member_Id})`,
                    paymentId: payment._id,
                    memberId: payment.memberId,
                    memberCode: payment.memberCode,
                    memberName: payment.memberName,
                    createdBy,
                    status: "verified",
                    session,
                });
            } else if (normalizedMode === "Cash") {
                const paymentAmount = incomingAmount;
                await group.recalculateCashBalance();
                const cashBalanceBefore = group.current_cash_balance || 0;
                group.current_cash_balance = cashBalanceBefore + paymentAmount;
                await group.save({ session });

                await createCashTransactionRecord({
                    groupId,
                    transactionType: "member_exit_recovery",
                    amount: paymentAmount,
                    date: effectivePaymentDate,
                    description: `Member exit recovery (cash): ${member.Member_Nm} (${member.Member_Id})`,
                    paymentId: payment._id,
                    memberId: payment.memberId,
                    memberCode: payment.memberCode,
                    memberName: payment.memberName,
                    createdBy,
                    session,
                });
            }

            // Post ledger entry for exit recovery
            const headInfoRecovery = await findOrCreateHead(groupId, "Member Exit Settlement", "asset", session);
            await postTransaction({
                sourceDoc: payment,
                headName: "Member Exit Settlement",
                headType: headInfoRecovery?.headType || "groupMaster",
                headId: headInfoRecovery?.headId,
                section: "asset",
                amount: incomingAmount,
                direction: "in",
                groupId,
                memberId: payment.memberId,
                date: effectivePaymentDate,
                notes: `Member exit settlement recovery - Member: ${member.Member_Nm} (${member.Member_Id})`,
                paymentMode: normalizedMode,
                bankId: normalizedMode === "Bank" ? bankId : undefined,
                referenceModel: "PaymentMaster",
                referenceId: payment._id,
                createdBy,
                session,
            });
        }

        const settlementDoc = {
            memberId: member._id,
            groupId,
            heads: settlementHeads || {},
            totalPayoutToMember: position.receivable ?? 0,
            totalDuesFromMember: position.payable ?? 0,
            netAmount: backendNet ?? 0,
            direction: backendDirection || "SETTLED",
            paymentMode:
                backendDirection === "SETTLED" || position.net === 0
                    ? "NONE"
                    : payoutPaymentMode || "Cash",
            paymentReference: paymentReference || "",
            paymentDate: paymentDate ? new Date(paymentDate) : undefined,
            paymentId: payment?._id || undefined,
            notes: notes || "",
            createdBy,
        };
        const settlement = await MemberExitSettlement.create(settlementDoc, { session });

        const effectiveDate = paymentDate ? new Date(paymentDate) : new Date();
        await finalizeMemberExitObligations(member._id, groupId, effectiveDate, session);

            await session.commitTransaction();
        } catch (txnErr) {
            await session.abortTransaction();
            throw txnErr;
        } finally {
            session.endSession();
        }

        return apiResponse.success(res, "Member exit settlement recorded successfully", settlement);
    } catch (error) {
        console.error("Error creating member exit settlement:", error);
        return apiResponse.error(res, error.message || "Failed to create member exit settlement", 500);
    }
};

/**
 * DELETE /api/admin/member/exit-settlement?memberId=...
 * Removes all exit settlement records for the member so a new (correct) settlement can be created.
 * Use when a settlement was created by mistake or with wrong data.
 */
export const voidMemberExitSettlement = async (req, res) => {
    try {
        const { memberId } = req.query;
        if (!memberId) {
            return apiResponse.error(res, "memberId is required", 400);
        }

        const member = await Member.findById(memberId).select("group").lean();
        if (!member) {
            return apiResponse.error(res, "Member not found", 404);
        }

        const groupId = member.group?._id || member.group;
        if (!groupId) {
            return apiResponse.error(res, "Member group not found", 400);
        }

        const memberObjId = member._id;
        const result = await MemberExitSettlement.deleteMany({
            $or: [ { memberId: memberObjId, groupId }, { memberId: memberId, groupId } ],
        });

        const deletedCount = result?.deletedCount ?? 0;
        if (deletedCount === 0) {
            return apiResponse.error(res, "No exit settlement found for this member", 404);
        }

        return apiResponse.success(res, "Exit settlement voided. You can now create a new settlement.", {
            deletedCount,
        });
    } catch (error) {
        console.error("Error voiding member exit settlement:", error);
        return apiResponse.error(res, error.message || "Failed to void exit settlement", 500);
    }
};

// Helper: after a member's exit settlement is completed, clear any remaining
// demand records and mark FD entries as closed so that subsequent Demand & Recovery
// flows no longer show outstanding amounts for this member.
// Optional fourth arg: mongoose session for transaction support.
const finalizeMemberExitObligations = async (memberId, groupId, effectiveDate, txnSession = null) => {
    const ts = effectiveDate || new Date();
    const sessionOptions = txnSession ? { session: txnSession } : {};

    // 1) Mark all open MemberRevenueDemand records for this member/group as fully paid
    const openDemandsQuery = MemberRevenueDemand.find({
        memberId,
        groupId,
        isPaid: false,
    });
    if (txnSession) openDemandsQuery.session(txnSession);
    const openDemands = await openDemandsQuery;

    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            location: 'memberController.js:finalizeMemberExitObligations:beforeUpdateDemands',
            message: 'Finalizing member exit obligations (demands)',
            data: {
                memberId: memberId?.toString?.() || String(memberId),
                groupId: groupId?.toString?.() || String(groupId),
                openDemandCount: openDemands.length,
                sampleDemand: openDemands[0]
                    ? {
                        id: openDemands[0]._id,
                        revenueType: openDemands[0].revenueType,
                        amount: openDemands[0].amount,
                        paidAmount: openDemands[0].paidAmount,
                        isPaid: openDemands[0].isPaid,
                    }
                    : null,
            },
            timestamp: Date.now(),
        }),
    }).catch(() => { });
    // #endregion agent log

    for (const demand of openDemands) {
        demand.paidAmount = demand.amount || 0;
        demand.paidDate = ts;
        demand.isPaid = true;
        await demand.save(sessionOptions);
    }

    // 2) Zero out demandDetails in RecoveryMaster for this member so summaries show 0
    const memberIdStr = memberId.toString();
    const sessionsQuery = RecoveryMaster.find({
        groupId,
        "recoveries.memberId": memberIdStr,
    });
    if (txnSession) sessionsQuery.session(txnSession);
    const sessions = await sessionsQuery;

    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            location: 'memberController.js:finalizeMemberExitObligations:beforeUpdateRecovery',
            message: 'Finalizing member exit obligations (recovery sessions)',
            data: {
                memberId: memberIdStr,
                groupId: groupId?.toString?.() || String(groupId),
                sessionCount: sessions.length,
            },
            timestamp: Date.now(),
        }),
    }).catch(() => { });
    // #endregion agent log

    const zeroDemandHead = (d) => {
        if (!d || typeof d !== "object") return;
        const numKeys = ["prevDemand", "currDemand", "totalDemand", "actualPaid", "unpaidDemand", "openingBalance", "closingBalance"];
        numKeys.forEach((k) => { if (d[k] !== undefined) d[k] = 0; });
        if (d.unpaidDemandTotal !== undefined) d.unpaidDemandTotal = 0;
        if (d.chargesTotalDemand !== undefined) d.chargesTotalDemand = 0;
        if (d.actualPaidTotal !== undefined) d.actualPaidTotal = 0;
    };

    for (const recSession of sessions) {
        let changed = false;
        recSession.recoveries.forEach((rec) => {
            if (
                rec.memberId === memberIdStr ||
                (rec.memberId && rec.memberId.toString && rec.memberId.toString() === memberIdStr)
            ) {
                if (rec.demandDetails && typeof rec.demandDetails === "object") {
                    Object.keys(rec.demandDetails).forEach((k) => {
                        zeroDemandHead(rec.demandDetails[k]);
                    });
                }
                changed = true;
            }
        });
        if (changed) {
            recSession.markModified("recoveries");
            await recSession.save(sessionOptions);
        }
    }

    // 3) Mark all FDMaster records for this member/group as closed
    await FDMaster.updateMany(
        {
            memberId,
            groupId,
            status: { $ne: "closed" },
        },
        {
            $set: { status: "closed" },
        },
        sessionOptions
    );
};