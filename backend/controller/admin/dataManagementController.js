import apiResponse from "../../utility/apiResponse.js";
import { Admin, BankMaster, GroupMaster, Member, LoanMaster, RecoveryMaster } from "../../model/index.js";

// =========================
// EXPORT ALL DATA
// =========================
export const exportAllData = async (req, res) => {
    try {
        const format = req.query.format || "json"; // json, excel, csv

        // Fetch all data from all collections
        const [
            admins,
            groups,
            members,
            banks,
            loans,
            recoveries
        ] = await Promise.all([
            Admin.find().select("-password").lean(),
            GroupMaster.find().lean(),
            Member.find().lean(),
            BankMaster.find().lean(),
            LoanMaster.find().lean(),
            RecoveryMaster.find().lean(),
        ]);

        const exportData = {
            exportDate: new Date().toISOString(),
            summary: {
                admins: admins.length,
                groups: groups.length,
                members: members.length,
                banks: banks.length,
                loans: loans.length,
                recoveries: recoveries.length,
            },
            data: {
                admins,
                groups,
                members,
                banks,
                loans,
                recoveries,
            },
        };

        if (format === "json") {
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Content-Disposition", `attachment; filename=mmms_backup_${Date.now()}.json`);
            return res.status(200).json(exportData);
        }

        // For Excel/CSV, we'll return JSON and let frontend handle conversion
        return apiResponse.success(res, "Data exported successfully", exportData);

    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// =========================
// IMPORT DATA
// =========================
export const importData = async (req, res) => {
    try {
        const { data, options } = req.body;
        const { clearExisting = false, collections = [] } = options || {};

        if (!data || !data.data) {
            return apiResponse.error(res, "Invalid data format", 400);
        }

        const results = {
            imported: {},
            errors: {},
        };

        // Clear existing data if requested
        if (clearExisting) {
            const collectionsToClear = collections.length > 0 ? collections : ["groups", "members", "banks", "loans", "recoveries"];

            if (collectionsToClear.includes("groups")) await GroupMaster.deleteMany({});
            if (collectionsToClear.includes("members")) await Member.deleteMany({});
            if (collectionsToClear.includes("banks")) await BankMaster.deleteMany({});
            if (collectionsToClear.includes("loans")) await LoanMaster.deleteMany({});
            if (collectionsToClear.includes("recoveries")) await RecoveryMaster.deleteMany({});
        }

        // Import groups
        if (data.data.groups && Array.isArray(data.data.groups)) {
            try {
                const groups = await GroupMaster.insertMany(data.data.groups, { ordered: false });
                results.imported.groups = groups.length;
            } catch (e) {
                results.errors.groups = e.message;
            }
        }

        // Import members
        if (data.data.members && Array.isArray(data.data.members)) {
            try {
                const members = await Member.insertMany(data.data.members, { ordered: false });
                results.imported.members = members.length;
            } catch (e) {
                results.errors.members = e.message;
            }
        }

        // Import banks
        if (data.data.banks && Array.isArray(data.data.banks)) {
            try {
                const banks = await BankMaster.insertMany(data.data.banks, { ordered: false });
                results.imported.banks = banks.length;
            } catch (e) {
                results.errors.banks = e.message;
            }
        }

        // Import loans
        if (data.data.loans && Array.isArray(data.data.loans)) {
            try {
                const loans = await LoanMaster.insertMany(data.data.loans, { ordered: false });
                results.imported.loans = loans.length;
            } catch (e) {
                results.errors.loans = e.message;
            }
        }

        // Import recoveries
        if (data.data.recoveries && Array.isArray(data.data.recoveries)) {
            try {
                const recoveries = await RecoveryMaster.insertMany(data.data.recoveries, { ordered: false });
                results.imported.recoveries = recoveries.length;
            } catch (e) {
                results.errors.recoveries = e.message;
            }
        }

        return apiResponse.success(res, "Data imported successfully", results);

    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// =========================
// CREATE BACKUP
// =========================
export const createBackup = async (req, res) => {
    try {
        // Fetch all data
        const [
            admins,
            groups,
            members,
            banks,
            loans,
            recoveries
        ] = await Promise.all([
            Admin.find().select("-password").lean(),
            GroupMaster.find().lean(),
            Member.find().lean(),
            BankMaster.find().lean(),
            LoanMaster.find().lean(),
            RecoveryMaster.find().lean(),
        ]);

        const backup = {
            version: "1.0",
            backupDate: new Date().toISOString(),
            summary: {
                admins: admins.length,
                groups: groups.length,
                members: members.length,
                banks: banks.length,
                loans: loans.length,
                recoveries: recoveries.length,
            },
            data: {
                admins,
                groups,
                members,
                banks,
                loans,
                recoveries,
            },
        };

        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename=mmms_backup_${Date.now()}.json`);
        return res.status(200).json(backup);

    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// =========================
// DELETE ALL DATA
// =========================
export const deleteAllData = async (req, res) => {
    try {
        const { collections, confirm } = req.body;

        if (!confirm || confirm !== "DELETE_ALL_DATA") {
            return apiResponse.error(res, "Confirmation required", 400);
        }

        const collectionsToDelete = collections || ["groups", "members", "banks", "loans", "recoveries"];
        const results = {};

        if (collectionsToDelete.includes("groups")) {
            results.groups = await GroupMaster.deleteMany({});
        }
        if (collectionsToDelete.includes("members")) {
            results.members = await Member.deleteMany({});
        }
        if (collectionsToDelete.includes("banks")) {
            results.banks = await BankMaster.deleteMany({});
        }
        if (collectionsToDelete.includes("loans")) {
            results.loans = await LoanMaster.deleteMany({});
        }
        if (collectionsToDelete.includes("recoveries")) {
            results.recoveries = await RecoveryMaster.deleteMany({});
        }

        return apiResponse.success(res, "Data deleted successfully", results);

    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// =========================
// GET DATA STATISTICS
// =========================
export const getDataStatistics = async (req, res) => {
    try {
        const [
            adminCount,
            groupCount,
            memberCount,
            bankCount,
            loanCount,
            recoveryCount
        ] = await Promise.all([
            Admin.countDocuments(),
            GroupMaster.countDocuments(),
            Member.countDocuments(),
            BankMaster.countDocuments(),
            LoanMaster.countDocuments(),
            RecoveryMaster.countDocuments(),
        ]);

        const stats = {
            admins: adminCount,
            groups: groupCount,
            members: memberCount,
            banks: bankCount,
            loans: loanCount,
            recoveries: recoveryCount,
            lastUpdated: new Date().toISOString(),
        };

        return apiResponse.success(res, "Statistics fetched successfully", stats);

    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

// =========================
// GET DASHBOARD STATISTICS
// =========================
export const getDashboardStatistics = async (req, res) => {
    try {
        // Calculate date 30 days ago for active groups
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Get all groups with populated bank data
        const allGroups = await GroupMaster.find().lean();

        // Count groups with bank accounts
        const groupsWithBank = allGroups.filter(group => {
            return group.bankmaster ||
                (group.bankmasters && Array.isArray(group.bankmasters) && group.bankmasters.length > 0);
        }).length;

        // Get groups with recent activity (recoveries in last 30 days)
        const recentRecoveries = await RecoveryMaster.find({
            date: { $gte: thirtyDaysAgo }
        }).distinct("groupId");

        // Get groups with recent login (last 30 days)
        const groupsWithRecentLogin = await GroupMaster.find({
            lastLoginAt: { $gte: thirtyDaysAgo }
        }).select("_id").lean();

        // Combine active groups (either has recent recovery or recent login)
        const activeGroupIds = new Set([
            ...recentRecoveries.map(id => id.toString()),
            ...groupsWithRecentLogin.map(g => g._id.toString())
        ]);

        // Get total counts
        const [
            totalGroups,
            totalMembers,
            totalLoans,
            totalRecoveries,
            totalBanks
        ] = await Promise.all([
            GroupMaster.countDocuments(),
            Member.countDocuments(),
            LoanMaster.countDocuments(),
            RecoveryMaster.countDocuments(),
            BankMaster.countDocuments(),
        ]);

        // Calculate financial statistics
        const allRecoveries = await RecoveryMaster.find().lean();
        let totalSavings = 0;
        let totalLoanAmount = 0;
        let totalLoanOutstanding = 0;

        // Calculate total savings from recoveries
        allRecoveries.forEach(recovery => {
            if (recovery.recoveries && Array.isArray(recovery.recoveries)) {
                recovery.recoveries.forEach(memberRecovery => {
                    const amounts = memberRecovery.amounts || {};
                    totalSavings += parseFloat(amounts.saving || 0);
                });
            }
        });

        // Calculate total loans given and outstanding
        const allLoans = await LoanMaster.find({ transactionType: "Loan" }).lean();
        allLoans.forEach(loan => {
            const amount = parseFloat(loan.amount || 0);
            totalLoanAmount += amount;
            // For simplicity, assuming all loans are outstanding (can be enhanced with payment tracking)
            totalLoanOutstanding += amount;
        });

        // Calculate percentage changes (mock for now, can be enhanced with historical data)
        const stats = {
            totalGroups,
            totalMembers,
            groupsWithBank,
            activeGroups: activeGroupIds.size,
            totalLoans,
            totalRecoveries,
            totalBanks,
            financials: {
                totalSavings,
                totalLoanAmount,
                totalLoanOutstanding,
            },
            // Percentage changes (can be calculated from historical data)
            changes: {
                groups: "+0%", // Can be calculated from previous month
                members: "+0%",
                groupsWithBank: "+0%",
                activeGroups: "+0%",
            },
            lastUpdated: new Date().toISOString(),
        };

        return apiResponse.success(res, "Dashboard statistics fetched successfully", stats);

    } catch (error) {
        return apiResponse.error(res, error.message, 500);
    }
};

