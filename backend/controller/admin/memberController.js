import apiResponse from "../../utility/apiResponse.js";
import message from "../../utility/message.js";
import { GroupMaster, Member, LoanMaster, RecoveryMaster, FDMaster } from "../../model/index.js";

export const registerMember = async (req, res) => {
    try {
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

        // Check if Member already exists
        const exist = await Member.findOne({ Member_Id: payload.Member_Id });
        if (exist) {
            return apiResponse.error(res, message.MEMBER_EXISTS);
        }

        // Resolve group (preferred: group_id)
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

        // For existing members, capture saving_per_member snapshot from group
        if (payload.isExistingMember) {
            // Capture saving_per_member snapshot for existing members
            payload.saving_per_member_snapshot = groupDoc.saving_per_member || null;
        }

        // Create new Member
        const member = await Member.create({
            ...payload,
            group: groupDoc._id,
            Group_Name: payload.Group_Name || groupDoc.group_name,
        });

        return apiResponse.success(res, message.MEMBER_REGISTERED, member);

    } catch (error) {
        return apiResponse.error(res, error.message, 500);
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

// Helper function to calculate member ledger
const calculateMemberLedger = async (member, fromDate, toDate) => {
    const entries = [];
    const memberId = member._id.toString();
    const groupId = member.group?._id || member.group;
    
    // Initialize running balances
    let runningSavings = member.openingSaving || 0;
    let runningLoan = member.loanDetails?.amount || 0;
    let runningFD = member.fdDetails?.amount || 0;
    let runningInterest = member.loanDetails?.overdueInterest || 0;
    let runningYogdan = member.openingYogdan || 0;
    
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
        
        // Opening Saving entry
        if (member.openingSaving > 0) {
            entries.push({
                date: openingDate,
                receipt: "Opening",
                savingsDeposit: member.openingSaving,
                savingsWithdraw: 0,
                savingsBalance: runningSavings,
                loanPaid: 0,
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
                loanPaid: 0,
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
            entries.push({
                date: member.loanDetails.loanDate,
                receipt: "Loan Taken",
                savingsDeposit: 0,
                savingsWithdraw: 0,
                savingsBalance: runningSavings,
                loanPaid: 0,
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
            entries.push({
                date: loanDate,
                receipt: `Loan - ${loan.purpose || "N/A"}`,
                savingsDeposit: 0,
                savingsWithdraw: 0,
                savingsBalance: runningSavings,
                loanPaid: 0,
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
        } else if (loan.transactionType === "Saving") {
            runningSavings += amount;
            entries.push({
                date: loanDate,
                receipt: `Saving - ${loan.purpose || "N/A"}`,
                savingsDeposit: amount,
                savingsWithdraw: 0,
                savingsBalance: runningSavings,
                loanPaid: 0,
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
                loanPaid: 0,
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
            
            runningSavings += saving;
            runningLoan = Math.max(0, runningLoan - loan);
            runningFD += fd;
            runningInterest = Math.max(0, runningInterest - interest);
            runningYogdan += yogdan;
            
            entries.push({
                date: recoveryDate,
                receipt: "Recovery",
                savingsDeposit: saving,
                savingsWithdraw: 0,
                savingsBalance: runningSavings,
                loanPaid: loan,
                loanRecovered: loan,
                loanBalance: runningLoan,
                fdDeposit: fd,
                fdWithdraw: 0,
                fdBalance: runningFD,
                interestDue: runningInterest + interest,
                interestPaid: interest,
                yogdan: yogdan,
                other: other,
            });
        }
    });
    
    // Sort by date
    entries.sort((a, b) => new Date(a.date) - new Date(b.date));
    
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
        totalOther: entries.reduce((sum, e) => sum + (e.other || 0), 0),
        openingSavings: member.openingSaving || 0,
        openingLoan: member.loanDetails?.amount || 0,
        openingFD: member.fdDetails?.amount || 0,
        openingInterest: member.loanDetails?.overdueInterest || 0,
        openingYogdan: member.openingYogdan || 0,
        closingSavings: runningSavings,
        closingLoan: runningLoan,
        closingFD: runningFD,
        closingInterest: runningInterest,
        closingYogdan: runningYogdan,
    };
    
    return {
        entries,
        summary,
    };
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