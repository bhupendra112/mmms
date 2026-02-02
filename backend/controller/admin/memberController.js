import apiResponse from "../../utility/apiResponse.js";
import message from "../../utility/message.js";
import { GroupMaster, Member, LoanMaster, RecoveryMaster, FDMaster, PaymentMaster, MemberRevenueDemand } from "../../model/index.js";
import { verifyGroupAccess, verifyGroupAccessByCode, verifyGroupAccessByName } from "../../utility/groupAccessHelper.js";

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
        // Convert time_period from years to months
        if (payload.loanDetails && typeof payload.loanDetails === 'object') {
            if (payload.loanDetails.time_period !== undefined && payload.loanDetails.time_period !== null && payload.loanDetails.time_period !== '') {
                const timePeriodYears = Number(payload.loanDetails.time_period);
                if (!isNaN(timePeriodYears) && timePeriodYears > 0) {
                    payload.loanDetails.time_period = Math.round(timePeriodYears * 12); // Convert years to months
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
            // This error should not occur now since we removed unique constraint
            // But keeping it for backward compatibility
            return apiResponse.error(res, 'Member with this ID already exists in this group', 400);
        }
        return apiResponse.error(res, error.message || 'Failed to register member', 500);
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
    // Initialize running balances
    // Start with opening savings only (FD and Loan come from FDMaster and LoanMaster)
    let runningSavings = member.openingSaving || 0;
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
            openingSaving: member.openingSaving,
            overdueInterest: openingOverdueInterest,
            note: 'Opening savings and overdue interest included - FD and Loan come from FDMaster and LoanMaster'
        });

        const openingDate = member.Dt_Join || member.createdAt || new Date();

        // Opening Saving entry (only for existing members) - Opening savings and overdue interest
        // FD and Loan should come only from FDMaster and LoanMaster respectively
        // Overdue interest comes from member.loanDetails for existing members (until paid)
        if (member.openingSaving > 0 || openingOverdueInterest > 0) {
            const openingEntry = {
                date: openingDate,
                receipt: "Opening",
                savingsDeposit: member.openingSaving, // Only opening savings
                savingsWithdraw: 0,
                savingsBalance: runningSavings,
                loanPaid: 0, // Loans come from LoanMaster only
                loanRecovered: 0,
                loanBalance: 0, // Will be calculated from LoanMaster entries
                fdDeposit: 0, // FDs come from FDMaster only
                fdWithdraw: 0,
                fdBalance: 0, // Will be calculated from FDMaster entries
                interestDue: 0, // Overdue interest from member.loanDetails (for existing members)
                interestPaid: 0,
                yogdanDue: 0, // Yogdan calculated from loans in LoanMaster
                yogdanPaid: 0, // Yogdan paid from recoveries (but recoveries not in ledger)
                other: 0,
            };

            entries.push(openingEntry);
            console.log('[MEMBER_LEDGER] Added opening entry (savings and overdue interest)', openingEntry);
        }

        // REMOVED: FD Opening entry - FDs should only come from FDMaster
        // REMOVED: Loan Taken entry - Loans should only come from LoanMaster
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
        openingSavings: member.openingSaving || 0,
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