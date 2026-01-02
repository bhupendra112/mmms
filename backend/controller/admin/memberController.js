import apiResponse from "../../utility/apiResponse.js";
import message from "../../utility/message.js";
import { GroupMaster, Member, LoanMaster, RecoveryMaster, FDMaster, PaymentMaster } from "../../model/index.js";

export const registerMember = async (req, res) => {
    try {
        // Log request for debugging (only in development)
        if (process.env.NODE_ENV !== 'production') {
            console.log('Member registration request received');
            console.log('Body keys:', Object.keys(req.body || {}));
            console.log('Files:', req.files ? Object.keys(req.files) : 'No files');
        }

        const payload = req.body || {};

        // Handle file uploads - multer adds files to req.files
        // When using upload.fields(), req.files is an object with field names as keys
        if (req.files) {
            const fileFields = ['Voter_Id_File', 'Adhar_Id_File', 'Ration_Card_File', 'Job_Card_File'];

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
        const numericFields = ['Age', 'Anual_Income', 'openingSaving', 'openingYogdan'];
        numericFields.forEach(field => {
            if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
                const numValue = Number(payload[field]);
                if (!isNaN(numValue)) {
                    payload[field] = numValue;
                }
            }
        });

        // Parse date fields that come as strings from FormData
        const dateFields = ['Member_Dt', 'Dt_Join', 'dt_birth'];
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
        }

        // Resolve group first (preferred: group_id)
        let groupDoc = null;
        if (payload.group_id) {
            groupDoc = await GroupMaster.findById(payload.group_id);
        } else if (payload.group_code) {
            groupDoc = await GroupMaster.findOne({ group_code: payload.group_code });
        } else if (payload.Group_Name) {
            groupDoc = await GroupMaster.findOne({ group_name: payload.Group_Name });
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
        }

        // Create new Member
        const memberData = {
            ...payload,
            group: groupDoc._id,
            Group_Name: payload.Group_Name || groupDoc.group_name,
        };

        // Log before creating (only in development)
        if (process.env.NODE_ENV !== 'production') {
            console.log('Creating member with data:', {
                Member_Id: memberData.Member_Id,
                Member_Nm: memberData.Member_Nm,
                group: memberData.group,
                hasLoanDetails: !!memberData.loanDetails,
                hasFdDetails: !!memberData.fdDetails,
            });
        }

        const member = await Member.create(memberData);

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
        const members = await Member.find({ group: groupId })
            .sort({ createdAt: -1 })
            .lean();
        return apiResponse.success(res, "Members fetched successfully", members);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

export const listMembers = async (req, res) => {
    try {
        const { group_id } = req.query;
        const filter = group_id ? { group: group_id } : {};
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
        return apiResponse.success(res, "Member detail fetched successfully", member);
    } catch (error) {
        return apiResponse.error(res, error.message, 500);
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
    const entries = [];
    const memberId = member._id.toString();
    const groupId = member.group?._id || member.group;

    // Fetch group to get loan_rate for interest calculation
    const group = await GroupMaster.findById(groupId).lean();
    const loanRate = group?.loan_rate || 0;

    // Initialize running balances
    let runningSavings = member.openingSaving || 0;
    let runningLoan = member.loanDetails?.amount || 0;
    let runningFD = member.fdDetails?.amount || 0;
    let runningInterest = member.loanDetails?.overdueInterest || 0;
    let runningYogdan = member.openingYogdan || 0;
    let cumulativeLoanDisbursed = 0; // Track cumulative total loan disbursed (given to member)
    let lastRecoveryDate = null; // Track last recovery date for interest calculation

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
        const openingDate = member.Dt_Join || member.createdAt || new Date();

        // Add opening loan to cumulative if it exists (for same date opening)
        if (member.loanDetails?.amount > 0) {
            const openingLoanDate = member.loanDetails?.loanDate;
            if (!openingLoanDate || new Date(openingLoanDate).getTime() === new Date(openingDate).getTime()) {
                cumulativeLoanDisbursed += member.loanDetails.amount;
            }
        }

        // Opening Saving entry
        if (member.openingSaving > 0) {
            entries.push({
                date: openingDate,
                receipt: "Opening",
                savingsDeposit: member.openingSaving,
                savingsWithdraw: 0,
                savingsBalance: runningSavings,
                loanPaid: cumulativeLoanDisbursed, // Include opening loan if same date
                loanRecovered: 0,
                loanBalance: runningLoan,
                fdDeposit: member.fdDetails?.amount || 0,
                fdWithdraw: 0,
                fdBalance: runningFD,
                interestDue: member.loanDetails?.overdueInterest || 0,
                interestPaid: 0,
                yogdan: member.openingYogdan || 0,
                other: 0,
            });
        }

        // FD entry (if different date from opening)
        if (member.fdDetails?.amount > 0 && member.fdDetails?.date &&
            new Date(member.fdDetails.date).getTime() !== new Date(openingDate).getTime()) {
            entries.push({
                date: member.fdDetails.date,
                receipt: "FD Opening",
                savingsDeposit: 0,
                savingsWithdraw: 0,
                savingsBalance: runningSavings,
                loanPaid: cumulativeLoanDisbursed, // Use cumulative loan disbursed (includes opening loan if same date)
                loanRecovered: 0,
                loanBalance: runningLoan,
                fdDeposit: member.fdDetails.amount,
                fdWithdraw: 0,
                fdBalance: runningFD,
                interestDue: runningInterest,
                interestPaid: 0,
                yogdan: 0,
                other: 0,
            });
        }

        // Loan entry (if different date from opening)
        if (member.loanDetails?.amount > 0 && member.loanDetails?.loanDate &&
            new Date(member.loanDetails.loanDate).getTime() !== new Date(openingDate).getTime()) {
            cumulativeLoanDisbursed += member.loanDetails.amount; // Add opening loan to cumulative
            entries.push({
                date: member.loanDetails.loanDate,
                receipt: "Loan Taken",
                savingsDeposit: 0,
                savingsWithdraw: 0,
                savingsBalance: runningSavings,
                loanPaid: member.loanDetails.amount, // Show only the loan amount for this transaction
                loanRecovered: 0,
                loanBalance: runningLoan,
                loanAmount: member.loanDetails.amount, // Store actual loan amount for recalculation
                fdDeposit: 0,
                fdWithdraw: 0,
                fdBalance: runningFD,
                interestDue: runningInterest,
                interestPaid: 0,
                yogdan: 0,
                other: 0,
            });
        } else if (member.loanDetails?.amount > 0) {
            // Opening loan on same date as opening balance
            cumulativeLoanDisbursed += member.loanDetails.amount; // Add opening loan to cumulative
        }
    }

    // Fetch loans
    const loanFilter = { memberId: memberId };
    if (Object.keys(dateFilter).length > 0) {
        loanFilter.date = dateFilter;
    }
    const loans = await LoanMaster.find(loanFilter).sort({ date: 1 }).lean();

    // Add loan transactions
    loans.forEach((loan) => {
        const loanDate = loan.date || loan.createdAt;
        const amount = parseFloat(loan.amount || 0);

        if (loan.transactionType === "Loan") {
            runningLoan += amount;
            cumulativeLoanDisbursed += amount;
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
                yogdan: 0,
                other: 0,
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
                yogdan: 0,
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
                yogdan: 0,
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

    // Add FD transactions
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
                yogdan: 0,
                other: 0,
            });
        }
    });

    // Fetch payments (saving withdrawals and FD maturities)
    const paymentFilter = {
        memberId: memberId,
        status: { $in: ["approved", "completed"] }
    };
    if (Object.keys(dateFilter).length > 0) {
        paymentFilter.paymentDate = dateFilter;
    }
    const payments = await PaymentMaster.find(paymentFilter).sort({ paymentDate: 1 }).lean();

    // Add payment transactions
    payments.forEach((payment) => {
        const paymentDate = payment.paymentDate || payment.createdAt;
        const amount = parseFloat(payment.amount || 0);
        const paymentType = payment.paymentType;

        if (paymentType === "saving_withdrawal") {
            runningSavings = Math.max(0, runningSavings - amount);
            entries.push({
                date: paymentDate,
                receipt: "Savings Withdrawal",
                savingsDeposit: 0,
                savingsWithdraw: amount,
                savingsBalance: runningSavings,
                loanPaid: 0, // No loan disbursed in Savings Withdrawal entries
                loanRecovered: 0,
                loanBalance: runningLoan,
                fdDeposit: 0,
                fdWithdraw: 0,
                fdBalance: runningFD,
                interestDue: runningInterest,
                interestPaid: 0,
                yogdan: 0,
                other: 0,
            });
        } else if (paymentType === "fd_maturity") {
            runningFD = Math.max(0, runningFD - amount);
            entries.push({
                date: paymentDate,
                receipt: "FD Maturity",
                savingsDeposit: 0,
                savingsWithdraw: 0,
                savingsBalance: runningSavings,
                loanPaid: 0, // No loan disbursed in FD Maturity entries
                loanRecovered: 0,
                loanBalance: runningLoan,
                fdDeposit: 0,
                fdWithdraw: amount,
                fdBalance: runningFD,
                interestDue: runningInterest,
                interestPaid: 0,
                yogdan: 0,
                other: 0,
            });
        }
    });

    // Fetch recoveries
    const recoveryFilter = { groupId: groupId };
    if (Object.keys(dateFilter).length > 0) {
        recoveryFilter.date = dateFilter;
    }
    const recoveries = await RecoveryMaster.find(recoveryFilter).sort({ date: 1 }).lean();

    // Add recovery transactions
    recoveries.forEach((recovery) => {
        if (!recovery.recoveries || !Array.isArray(recovery.recoveries)) return;

        const memberRecovery = recovery.recoveries.find(
            r => r.memberId?.toString() === memberId || r.memberId === memberId
        );

        if (memberRecovery) {
            const recoveryDate = recovery.date;
            const amounts = memberRecovery.amounts || {};
            const saving = parseFloat(amounts.saving || 0);
            const loan = parseFloat(amounts.loan || 0);
            const fd = parseFloat(amounts.fd || 0);
            const interest = parseFloat(amounts.interest || 0);
            const yogdan = parseFloat(amounts.yogdan || 0);
            const other = parseFloat(amounts.other || 0);
            const charges = amounts.charges || {}; // Get charges from recovery

            runningSavings += saving;
            const loanAmount = parseFloat(loan || 0);
            runningLoan = Math.max(0, runningLoan - loanAmount);

            runningFD += fd;

            // Calculate date-wise interest from last recovery date (or loan date) to current recovery date
            let interestAccrued = 0;
            if (runningLoan > 0 && loanRate > 0) {
                // Find the loan date (from member loanDetails or first loan entry)
                const loanDate = member.loanDetails?.loanDate ? new Date(member.loanDetails.loanDate) : null;

                if (loanDate) {
                    // Calculate interest from last recovery date (or loan date if first recovery) to current recovery date
                    const fromDate = lastRecoveryDate || loanDate;
                    const toDate = new Date(recoveryDate);

                    const timeDiff = toDate.getTime() - fromDate.getTime();
                    const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

                    if (daysDiff > 0) {
                        // Check if it's a leap year
                        const isLeapYear = (year) => {
                            return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
                        };
                        const daysInYear = isLeapYear(toDate.getFullYear()) ? 366 : 365;

                        // Daily interest: (loanAmount * rate / 100 / daysInYear) * numberOfDays
                        // Use runningLoan (outstanding loan balance) for interest calculation
                        interestAccrued = (runningLoan * loanRate / 100 / daysInYear) * daysDiff;
                        interestAccrued = Math.round(interestAccrued * 100) / 100;
                    }
                }
            }

            // Interest due should show the total interest due before payment
            const interestBeforeRecovery = runningInterest + interestAccrued;
            runningInterest = Math.max(0, runningInterest + interestAccrued - interest);
            runningYogdan += yogdan;
            lastRecoveryDate = new Date(recoveryDate); // Update last recovery date

            entries.push({
                date: recoveryDate,
                receipt: "Recovery",
                savingsDeposit: saving,
                savingsWithdraw: 0,
                savingsBalance: runningSavings,
                loanPaid: 0, // No loan disbursed in Recovery entries
                loanRecovered: loanAmount, // Amount recovered from member in this transaction
                loanBalance: runningLoan,
                fdDeposit: fd,
                fdWithdraw: 0,
                fdBalance: runningFD,
                interestDue: interestBeforeRecovery, // Total interest due before payment (including accrued)
                interestPaid: interest,
                yogdan: yogdan,
                charges: charges, // Include charges in ledger entry
                other: other,
            });
        }
    });

    // Sort by date
    entries.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Recalculate running balances in chronological order to ensure accuracy
    let recalcSavings = member.openingSaving || 0;
    let recalcLoan = member.loanDetails?.amount || 0;
    let recalcFD = member.fdDetails?.amount || 0;
    let recalcInterest = member.loanDetails?.overdueInterest || 0;
    let recalcCumulativeLoanDisbursed = 0;
    let recalcLastRecoveryDate = null; // Track last recovery date for interest calculation

    // Add opening loan to cumulative if it exists
    if (member.loanDetails?.amount > 0) {
        recalcCumulativeLoanDisbursed += member.loanDetails.amount;
    }

    entries.forEach((entry) => {
        if (entry.receipt === "Opening" || entry.receipt === "FD Opening") {
            if (entry.savingsDeposit > 0) {
                recalcSavings = entry.savingsDeposit;
            }
            if (entry.fdDeposit > 0) {
                recalcFD = entry.fdDeposit;
            }
            entry.loanPaid = 0; // No loan disbursed in opening/FD opening entries
        } else if (entry.receipt === "Loan Taken" || entry.receipt.startsWith("Loan -")) {
            // Use stored loanAmount if available, otherwise calculate from balance difference
            let loanAmount = entry.loanAmount;
            if (!loanAmount || loanAmount <= 0) {
                loanAmount = entry.loanBalance - recalcLoan;
            }
            if (loanAmount > 0) {
                recalcLoan += loanAmount;
                recalcCumulativeLoanDisbursed += loanAmount;
            } else if (entry.receipt === "Loan Taken") {
                // For opening loan, loanAmount might be 0, so use entry.loanBalance directly
                if (entry.loanBalance > recalcLoan) {
                    const diff = entry.loanBalance - recalcLoan;
                    recalcLoan = entry.loanBalance;
                    recalcCumulativeLoanDisbursed += diff;
                    loanAmount = diff; // Set loanAmount for display
                }
            }
            entry.loanPaid = loanAmount; // Show only the loan amount for this transaction, not cumulative
        } else if (entry.receipt.startsWith("FD -")) {
            recalcFD += entry.fdDeposit;
            entry.loanPaid = 0; // No loan disbursed in FD entries
        } else if (entry.receipt.startsWith("Saving -")) {
            recalcSavings += entry.savingsDeposit;
            entry.loanPaid = 0; // No loan disbursed in Saving entries
        } else if (entry.receipt === "Recovery") {
            recalcSavings += entry.savingsDeposit || 0;
            recalcLoan = Math.max(0, recalcLoan - (entry.loanRecovered || 0));
            recalcFD += entry.fdDeposit || 0;

            // Calculate date-wise interest from last recovery (or loan date) to current recovery
            let interestAccrued = 0;
            if (recalcLoan > 0 && loanRate > 0) {
                // Find loan date
                const loanDate = member.loanDetails?.loanDate ? new Date(member.loanDetails.loanDate) : null;
                if (loanDate) {
                    const fromDate = recalcLastRecoveryDate || loanDate;
                    const toDate = new Date(entry.date);

                    const timeDiff = toDate.getTime() - fromDate.getTime();
                    const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

                    if (daysDiff > 0) {
                        const isLeapYear = (year) => {
                            return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
                        };
                        const daysInYear = isLeapYear(toDate.getFullYear()) ? 366 : 365;

                        // Calculate interest on outstanding loan balance
                        interestAccrued = (recalcLoan * loanRate / 100 / daysInYear) * daysDiff;
                        interestAccrued = Math.round(interestAccrued * 100) / 100;
                    }
                }
            }

            // Update interest: add accrued interest, then subtract paid interest
            recalcInterest = Math.max(0, recalcInterest + interestAccrued - (entry.interestPaid || 0));
            recalcLastRecoveryDate = new Date(entry.date);
            entry.loanPaid = 0; // No loan disbursed in Recovery entries
        } else if (entry.receipt === "Savings Withdrawal") {
            recalcSavings = Math.max(0, recalcSavings - (entry.savingsWithdraw || 0));
            entry.loanPaid = 0; // No loan disbursed in Savings Withdrawal entries
        } else if (entry.receipt === "FD Maturity") {
            recalcFD = Math.max(0, recalcFD - (entry.fdWithdraw || 0));
            entry.loanPaid = 0; // No loan disbursed in FD Maturity entries
        }

        // Update entry balances
        entry.savingsBalance = recalcSavings;
        entry.loanBalance = recalcLoan;
        entry.fdBalance = recalcFD;
        entry.interestDue = recalcInterest;
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
        totalYogdan: entries.reduce((sum, e) => sum + (e.yogdan || 0), 0),
        totalCharges: entries.reduce((sum, e) => {
            if (e.charges) {
                return sum + Object.values(e.charges).reduce((chargeSum, amount) => chargeSum + (amount || 0), 0);
            }
            return sum;
        }, 0),
        totalOther: entries.reduce((sum, e) => sum + (e.other || 0), 0),
        openingSavings: member.openingSaving || 0,
        openingLoan: member.loanDetails?.amount || 0,
        openingFD: member.fdDetails?.amount || 0,
        openingInterest: member.loanDetails?.overdueInterest || 0,
        openingYogdan: member.openingYogdan || 0,
        closingSavings: recalcSavings,
        closingLoan: recalcLoan,
        closingFD: recalcFD,
        closingInterest: recalcInterest,
        closingYogdan: runningYogdan, // Yogdan is only added in recoveries, not recalculated
    };

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