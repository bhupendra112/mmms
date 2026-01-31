import apiResponse from "../../utility/apiResponse.js";
import { GroupMaster, RecoveryMaster, LoanMaster, FDMaster, ExpenseMaster, PaymentMaster, BankTransaction, CashTransaction, GroupLedger, BankMaster, MemberRevenueDemand, Member } from "../../model/index.js";
import { verifyGroupAccess } from "../../utility/groupAccessHelper.js";
import { buildIncomeExpenseReport } from "../../service/reportIncomeExpenseService.js";
import { parseDate } from "../../utility/dateUtils.js";

/**
 * Get Receipt & Payment Account for a date range
 */
export const getReceiptPaymentAccount = async (req, res) => {
    try {
        const { groupId, fromDate, toDate } = req.query;

        if (!groupId) {
            return apiResponse.error(res, "groupId is required", 400);
        }

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Verify group exists and belongs to admin's place
        const accessCheck = await verifyGroupAccess(groupId, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
        }
        const group = accessCheck.group;

        // Parse dates - if not provided, use full range (no date filtering)
        let from = null;
        let to = null;
        if (fromDate && toDate) {
            from = new Date(fromDate);
            from.setHours(0, 0, 0, 0);
            to = new Date(toDate);
            to.setHours(23, 59, 59, 999);
        }

        // Calculate opening balances (before fromDate) - if no date range, opening balances are 0
        let openingCash = 0;
        let openingBank = 0;
        let openingSaving = 0;
        let openingFD = 0;
        if (from) {
            openingCash = await calculateOpeningCash(groupId, from);
            openingBank = await calculateOpeningBank(groupId, from);
            openingSaving = await calculateOpeningSaving(groupId, from);
            openingFD = await calculateOpeningFD(groupId, from);
        }

        // Build date filter condition
        const dateFilter = (from && to) ? { date: { $gte: from, $lte: to } } : {};

        // Receipts in period
        // Cash: Sum of cash receipts from recoveries
        // Use recovery.total field directly to avoid double-counting charges
        const cashReceipts = await RecoveryMaster.aggregate([
            {
                $match: {
                    groupId: group._id,
                    ...dateFilter
                }
            },
            { $unwind: "$recoveries" },
            {
                $match: {
                    "recoveries.paymentMode.cash": true
                }
            },
            {
                $addFields: {
                    // If recovery.total exists, use it; otherwise calculate from amounts
                    recoveryTotal: {
                        $ifNull: [
                            "$recoveries.total",
                            {
                                $add: [
                                    { $ifNull: ["$recoveries.amounts.saving", 0] },
                                    { $ifNull: ["$recoveries.amounts.loan", 0] },
                                    { $ifNull: ["$recoveries.amounts.fd", 0] },
                                    { $ifNull: ["$recoveries.amounts.interest", 0] },
                                    { $ifNull: ["$recoveries.amounts.memFeesSHG", 0] },
                                    { $ifNull: ["$recoveries.amounts.memFeesSamiti", 0] },
                                    { $ifNull: ["$recoveries.amounts.memFeesGroup", 0] },
                                    { $ifNull: ["$recoveries.amounts.yogdan", 0] },
                                    { $ifNull: ["$recoveries.amounts.other", 0] },
                                    { $ifNull: ["$recoveries.amounts.penalty", 0] },
                                    {
                                        $reduce: {
                                            input: { $objectToArray: { $ifNull: ["$recoveries.amounts.charges", {}] } },
                                            initialValue: 0,
                                            in: {
                                                $add: [
                                                    "$$value",
                                                    {
                                                        $convert: {
                                                            input: "$$this.v",
                                                            to: "double",
                                                            onError: 0,
                                                            onNull: 0
                                                        }
                                                    }
                                                ]
                                            }
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$recoveryTotal" }
                }
            }
        ]);
        const cashReceiptsTotal = cashReceipts[0]?.total || 0;

        // Bank: Sum of bank receipts from recoveries
        // Use recovery.total field directly to avoid double-counting charges
        const bankReceipts = await RecoveryMaster.aggregate([
            {
                $match: {
                    groupId: group._id,
                    ...dateFilter
                }
            },
            { $unwind: "$recoveries" },
            {
                $match: {
                    "recoveries.paymentMode.online": true
                }
            },
            {
                $addFields: {
                    // If recovery.total exists, use it; otherwise calculate from amounts
                    recoveryTotal: {
                        $ifNull: [
                            "$recoveries.total",
                            {
                                $add: [
                                    { $ifNull: ["$recoveries.amounts.saving", 0] },
                                    { $ifNull: ["$recoveries.amounts.loan", 0] },
                                    { $ifNull: ["$recoveries.amounts.fd", 0] },
                                    { $ifNull: ["$recoveries.amounts.interest", 0] },
                                    { $ifNull: ["$recoveries.amounts.memFeesSHG", 0] },
                                    { $ifNull: ["$recoveries.amounts.memFeesSamiti", 0] },
                                    { $ifNull: ["$recoveries.amounts.memFeesGroup", 0] },
                                    { $ifNull: ["$recoveries.amounts.yogdan", 0] },
                                    { $ifNull: ["$recoveries.amounts.other", 0] },
                                    { $ifNull: ["$recoveries.amounts.penalty", 0] },
                                    {
                                        $reduce: {
                                            input: { $objectToArray: { $ifNull: ["$recoveries.amounts.charges", {}] } },
                                            initialValue: 0,
                                            in: {
                                                $add: [
                                                    "$$value",
                                                    {
                                                        $convert: {
                                                            input: "$$this.v",
                                                            to: "double",
                                                            onError: 0,
                                                            onNull: 0
                                                        }
                                                    }
                                                ]
                                            }
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$recoveryTotal" }
                }
            }
        ]);
        const bankReceiptsTotal = bankReceipts[0]?.total || 0;

        // Saving: Sum of saving amounts from RecoveryMaster
        const savingReceipts = await RecoveryMaster.aggregate([
            {
                $match: {
                    groupId: group._id,
                    ...dateFilter
                }
            },
            { $unwind: "$recoveries" },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $ifNull: ["$recoveries.amounts.saving", 0] } }
                }
            }
        ]);
        const savingTotal = savingReceipts[0]?.total || 0;

        // FD: Sum of FD amounts created in period
        const fdReceipts = await FDMaster.aggregate([
            {
                $match: {
                    groupId: group._id,
                    ...dateFilter
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $ifNull: ["$amount", 0] } }
                }
            }
        ]);
        const fdTotal = fdReceipts[0]?.total || 0;

        // Loan Recovered: Sum of loan amounts from RecoveryMaster
        const loanRecoveredReceipts = await RecoveryMaster.aggregate([
            {
                $match: {
                    groupId: group._id,
                    ...dateFilter
                }
            },
            { $unwind: "$recoveries" },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $ifNull: ["$recoveries.amounts.loan", 0] } }
                }
            }
        ]);
        const loanRecoveredTotal = loanRecoveredReceipts[0]?.total || 0;

        // Interest: Sum of interest amounts from RecoveryMaster
        const interestReceipts = await RecoveryMaster.aggregate([
            {
                $match: {
                    groupId: group._id,
                    ...dateFilter
                }
            },
            { $unwind: "$recoveries" },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $ifNull: ["$recoveries.amounts.interest", 0] } }
                }
            }
        ]);
        const interestTotal = interestReceipts[0]?.total || 0;

        // Group Fee (memFeesGroup): Sum of memFeesGroup from RecoveryMaster
        const groupFeeReceipts = await RecoveryMaster.aggregate([
            {
                $match: {
                    groupId: group._id,
                    ...dateFilter
                }
            },
            { $unwind: "$recoveries" },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $ifNull: ["$recoveries.amounts.memFeesGroup", 0] } }
                }
            }
        ]);
        const groupFeeTotal = groupFeeReceipts[0]?.total || 0;

        // Yogdan: Sum of yogdan amounts from RecoveryMaster
        const yogdanReceipts = await RecoveryMaster.aggregate([
            {
                $match: {
                    groupId: group._id,
                    ...dateFilter
                }
            },
            { $unwind: "$recoveries" },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $ifNull: ["$recoveries.amounts.yogdan", 0] } }
                }
            }
        ]);
        const yogdanTotal = yogdanReceipts[0]?.total || 0;

        // Charges: Sum of all charges from RecoveryMaster (dynamic charges object)
        const chargesReceipts = await RecoveryMaster.aggregate([
            {
                $match: {
                    groupId: group._id,
                    ...dateFilter
                }
            },
            { $unwind: "$recoveries" },
            {
                $addFields: {
                    // Calculate charges total by summing all values in charges object
                    // Convert string values to numbers using $convert
                    chargesTotal: {
                        $reduce: {
                            input: { $objectToArray: { $ifNull: ["$recoveries.amounts.charges", {}] } },
                            initialValue: 0,
                            in: {
                                $add: [
                                    "$$value",
                                    {
                                        $convert: {
                                            input: "$$this.v",
                                            to: "double",
                                            onError: 0,
                                            onNull: 0
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$chargesTotal" }
                }
            }
        ]);
        const chargesTotal = chargesReceipts[0]?.total || 0;

        // Member Fees: Sum of memFeesSHG + memFeesSamiti
        const memberFeesReceipts = await RecoveryMaster.aggregate([
            {
                $match: {
                    groupId: group._id,
                    ...dateFilter
                }
            },
            { $unwind: "$recoveries" },
            {
                $group: {
                    _id: null,
                    total: {
                        $sum: {
                            $add: [
                                { $ifNull: ["$recoveries.amounts.memFeesSHG", 0] },
                                { $ifNull: ["$recoveries.amounts.memFeesSamiti", 0] }
                            ]
                        }
                    }
                }
            }
        ]);
        const memberFeesTotal = memberFeesReceipts[0]?.total || 0;

        // Payments in period
        // Expenses from ExpenseMaster: Stationery and Travel only
        const expenses = await ExpenseMaster.aggregate([
            {
                $match: {
                    groupId: group._id,
                    ...dateFilter
                }
            },
            {
                $group: {
                    _id: "$expenseType",
                    total: { $sum: { $ifNull: ["$amount", 0] } }
                }
            }
        ]);
        const expensesByType = {};
        expenses.forEach(exp => {
            expensesByType[exp._id] = exp.total;
        });

        // Other expenses from LoanMaster where transactionType="Expense"
        const otherExpenses = await LoanMaster.aggregate([
            {
                $match: {
                    groupId: group._id,
                    transactionType: "Expense",
                    date: { $gte: from, $lte: to }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $ifNull: ["$amount", 0] } }
                }
            }
        ]);
        const otherExpensesTotal = otherExpenses[0]?.total || 0;
        if (otherExpensesTotal > 0) {
            expensesByType["Other"] = otherExpensesTotal;
        }

        // Loans: Sum of LoanMaster where transactionType="Loan"
        const loanPayments = await LoanMaster.aggregate([
            {
                $match: {
                    groupId: group._id,
                    transactionType: "Loan",
                    ...dateFilter
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $ifNull: ["$amount", 0] } }
                }
            }
        ]);
        const loanTotal = loanPayments[0]?.total || 0;

        // Payments from PaymentMaster (FD maturity, saving withdrawal)
        // Break down by paymentType - include all statuses, not just "completed"
        const paymentDateFilter = (from && to) ? { paymentDate: { $gte: from, $lte: to } } : {};
        const paymentsByType = await PaymentMaster.aggregate([
            {
                $match: {
                    groupId: group._id,
                    ...paymentDateFilter
                    // Removed status filter to include all payments
                }
            },
            {
                $group: {
                    _id: "$paymentType",
                    total: { $sum: { $ifNull: ["$amount", 0] } }
                }
            }
        ]);

        // Separate saving_withdrawal and fd_maturity payments
        let savingWithdrawalTotal = 0;
        let fdMaturityTotal = 0;
        paymentsByType.forEach(payment => {
            if (payment._id === "saving_withdrawal") {
                savingWithdrawalTotal = payment.total;
            } else if (payment._id === "fd_maturity") {
                fdMaturityTotal = payment.total;
            }
        });
        const bankPaymentTotal = savingWithdrawalTotal + fdMaturityTotal;

        // Cash payments from PaymentMaster (from CashTransaction)
        const cashTransactionPaymentQuery = {
            groupId: group._id,
            transactionType: "payment",
            status: "verified"
        };
        if (from && to) {
            cashTransactionPaymentQuery.date = { $gte: from, $lte: to };
        }
        const cashTransactionPayments = await CashTransaction.find(cashTransactionPaymentQuery).lean();
        const cashTransactionPaymentTotal = cashTransactionPayments.reduce((sum, t) => sum + (t.amount || 0), 0);
        const paymentTotal = bankPaymentTotal + cashTransactionPaymentTotal;

        // Get BankTransaction receipts for this period
        const bankTransactionQuery = {
            groupId: group._id,
            status: { $in: ["pending", "verified"] } // Include pending and verified transactions
        };
        if (from && to) {
            bankTransactionQuery.date = { $gte: from, $lte: to };
        }
        const bankTransactionReceipts = await BankTransaction.find(bankTransactionQuery).lean();

        // Calculate total from BankTransaction receipts
        const bankTransactionReceiptsTotal = bankTransactionReceipts.reduce((sum, t) => sum + (t.amount || 0), 0);

        // Calculate balance based on payment mode
        // Get cash expenses from ExpenseMaster
        const cashExpenses = await ExpenseMaster.aggregate([
            {
                $match: {
                    groupId: group._id,
                    ...dateFilter,
                    paymentMode: "Cash"
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $ifNull: ["$amount", 0] } }
                }
            }
        ]);
        const cashExpensesTotal = cashExpenses[0]?.total || 0;

        // Get cash expenses from CashTransaction (expense payments in cash)
        const cashTransactionExpensesQuery = {
            groupId: group._id,
            transactionType: "expense",
            status: "verified"
        };
        if (from && to) {
            cashTransactionExpensesQuery.date = { $gte: from, $lte: to };
        }
        const cashTransactionExpenses = await CashTransaction.find(cashTransactionExpensesQuery).lean();
        const cashTransactionExpensesTotal = cashTransactionExpenses.reduce((sum, t) => sum + (t.amount || 0), 0);

        // Other expenses from LoanMaster (transactionType="Expense") paid in Cash
        const otherCashExpenses = await LoanMaster.aggregate([
            {
                $match: {
                    groupId: group._id,
                    transactionType: "Expense",
                    paymentMode: "Cash",
                    ...dateFilter
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $ifNull: ["$amount", 0] } }
                }
            }
        ]);
        const otherCashExpensesTotal = otherCashExpenses[0]?.total || 0;

        const bankExpenses = await ExpenseMaster.aggregate([
            {
                $match: {
                    groupId: group._id,
                    ...dateFilter,
                    paymentMode: "Bank"
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $ifNull: ["$amount", 0] } }
                }
            }
        ]);
        const bankExpensesTotal = bankExpenses[0]?.total || 0;

        // Other expenses from LoanMaster (transactionType="Expense") paid via Bank
        const otherBankExpenses = await LoanMaster.aggregate([
            {
                $match: {
                    groupId: group._id,
                    transactionType: "Expense",
                    paymentMode: "Bank",
                    ...dateFilter
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $ifNull: ["$amount", 0] } }
                }
            }
        ]);
        const otherBankExpensesTotal = otherBankExpenses[0]?.total || 0;

        // Get cash loans from LoanMaster
        const cashLoans = await LoanMaster.aggregate([
            {
                $match: {
                    groupId: group._id,
                    transactionType: "Loan",
                    paymentMode: "Cash",
                    ...dateFilter
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $ifNull: ["$amount", 0] } }
                }
            }
        ]);
        const cashLoansTotal = cashLoans[0]?.total || 0;

        // Get cash loans from CashTransaction (loan payments in cash)
        const cashTransactionLoansQuery = {
            groupId: group._id,
            transactionType: "loan",
            status: "verified"
        };
        if (from && to) {
            cashTransactionLoansQuery.date = { $gte: from, $lte: to };
        }
        const cashTransactionLoans = await CashTransaction.find(cashTransactionLoansQuery).lean();
        const cashTransactionLoansTotal = cashTransactionLoans.reduce((sum, t) => sum + (t.amount || 0), 0);

        // Get cash FD payments from CashTransaction (FD creation paid in cash)
        const cashTransactionFDQuery = {
            groupId: group._id,
            transactionType: "fd",
            status: "verified"
        };
        if (from && to) {
            cashTransactionFDQuery.date = { $gte: from, $lte: to };
        }
        const cashTransactionFD = await CashTransaction.find(cashTransactionFDQuery).lean();
        const cashTransactionFDTotal = cashTransactionFD.reduce((sum, t) => sum + (t.amount || 0), 0);

        // Get cash-to-bank conversions (cash debit) - stored as "other" transaction type
        const cashToBankQuery = {
            groupId: group._id,
            transactionType: "other",
            cashToBankId: { $exists: true, $ne: null }, // Only cash-to-bank conversions
            status: "verified"
        };
        if (from && to) {
            cashToBankQuery.date = { $gte: from, $lte: to };
        }
        const cashToBankTransactions = await CashTransaction.find(cashToBankQuery).lean();
        const cashToBankTotal = cashToBankTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

        const bankLoans = await LoanMaster.aggregate([
            {
                $match: {
                    groupId: group._id,
                    transactionType: "Loan",
                    paymentMode: "Bank",
                    ...dateFilter
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $ifNull: ["$amount", 0] } }
                }
            }
        ]);
        const bankLoansTotal = bankLoans[0]?.total || 0;

        // Payments from PaymentMaster are always bank payments (they require bankId)
        // Calculate total cash receipts (from RecoveryMaster only)
        const totalCashReceipts = cashReceiptsTotal + cashTransactionFDTotal;

        // Calculate total cash payments (expenses + loans + FD + payments + cash-to-bank from CashTransaction)
        const totalCashPayments = cashExpensesTotal +
            cashLoansTotal +
            cashTransactionPaymentTotal + cashToBankTotal;

        const closingCashBalance = totalCashPayments - openingCash - totalCashReceipts;
        const closingBankBalance = openingBank + bankReceiptsTotal - bankExpensesTotal - otherBankExpensesTotal - bankLoansTotal - paymentTotal;
        const totalPayments = Object.values(expensesByType).reduce((sum, val) => sum + val, 0) + loanTotal + paymentTotal;

        const result = {
            period: {
                fromDate: from,
                toDate: to
            },
            openingBalances: {
                cash: openingCash,
                bank: openingBank,
                saving: openingSaving,
                fd: openingFD
            },
            receipts: {
                cash: totalCashReceipts, // Cash receipts from RecoveryMaster
                bank: bankReceiptsTotal,
                saving: savingTotal,
                loan: loanRecoveredTotal, // Loan recovered from RecoveryMaster
                interest: interestTotal, // Interest from RecoveryMaster
                yogdan: yogdanTotal, // Yogdan from RecoveryMaster
                charges: chargesTotal, // Charges from RecoveryMaster (dynamic charges object)
                fd: fdTotal,
                memberFees: memberFeesTotal, // memFeesSHG + memFeesSamiti
                groupFee: groupFeeTotal, // memFeesGroup
                bankTransactions: bankTransactionReceiptsTotal // BankTransaction receipts
            },
            payments: {
                expenses: expensesByType,
                loan: loanTotal,
                saving: savingWithdrawalTotal,
                fd: fdMaturityTotal
            },
            closingBalances: {
                cash: closingCashBalance,
                bank: closingBankBalance
            },
            totals: {
                receipts: totalCashReceipts + bankReceiptsTotal,
                payments: totalPayments
            }
        };

        return apiResponse.success(res, "Receipt & Payment Account generated successfully", result);

    } catch (error) {
        console.error("Error generating Receipt & Payment Account:", error);
        console.error("Error stack:", error.stack);
        return apiResponse.error(res, error.message, 500);
    }
};

/**
 * Get Income & Expense Account for a date range.
 * Uses master mapping (IncomeExpenseHeads) to map GroupLedger headName to HeaderName/ItemName.
 * Transaction source: GroupLedger (section income/expense) - fields used: groupId, date, headName, amount, section.
 * Matching: normalize headName to ItemName (LedgerCode is not stored in GroupLedger; match by name only).
 */
export const getIncomeExpenseAccount = async (req, res) => {
    try {
        const { groupId, fromDate, toDate } = req.query;

        if (!groupId) {
            return apiResponse.error(res, "groupId is required", 400);
        }

        const adminPlace = req.user?.place || req.admin?.place;
        const accessCheck = await verifyGroupAccess(groupId, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
        }
        const group = accessCheck.group;

        let from = null;
        let to = null;
        if (fromDate && toDate) {
            const parsedFrom = parseDate(fromDate);
            const parsedTo = parseDate(toDate);
            if (parsedFrom instanceof Date && !isNaN(parsedFrom.getTime())) from = parsedFrom;
            if (parsedTo instanceof Date && !isNaN(parsedTo.getTime())) to = parsedTo;
        }
        if (from) from.setHours(0, 0, 0, 0);
        if (to) to.setHours(23, 59, 59, 999);

        const result = await buildIncomeExpenseReport(group._id, from, to);
        return apiResponse.success(res, "Income & Expense Account generated successfully", result);
    } catch (error) {
        console.error("Error generating Income & Expense Account:", error);
        return apiResponse.error(res, error.message, 500);
    }
};

/**
 * Get Balance Sheet as on date
 */
export const getBalanceSheet = async (req, res) => {
    try {
        const { groupId, asOnDate } = req.query;

        if (!groupId) {
            return apiResponse.error(res, "groupId is required", 400);
        }

        if (!asOnDate) {
            return apiResponse.error(res, "asOnDate is required", 400);
        }

        // Get admin's place from token
        const adminPlace = req.user?.place || req.admin?.place;

        // Verify group exists and belongs to admin's place
        const accessCheck = await verifyGroupAccess(groupId, adminPlace);
        if (!accessCheck.valid) {
            return apiResponse.error(res, accessCheck.error || "Group not found or you don't have access to this group", 403);
        }
        const group = accessCheck.group;

        // Parse date
        const asOn = new Date(asOnDate);
        asOn.setHours(23, 59, 59, 999);

        // Try to use ledger first, fallback to old calculation if ledger is empty
        const ledgerQuery = {
            groupId: group._id,
            section: { $in: ["assets", "liability"] },
            date: { $lte: asOn }
        };

        const ledgerEntries = await GroupLedger.find(ledgerQuery).lean();

        let assetsByHead = {};
        let liabilitiesByHead = {};
        let assetsTotal = 0;
        let liabilitiesTotal = 0;

        if (ledgerEntries.length > 0) {
            // Use ledger data - calculate closing balances per head
            const headBalances = {};

            ledgerEntries.forEach(entry => {
                const headName = entry.headName || "Other";
                if (!headBalances[headName]) {
                    headBalances[headName] = { section: entry.section, balance: 0 };
                }

                // Calculate balance: "in" adds, "out" subtracts
                if (entry.direction === "in") {
                    headBalances[headName].balance += entry.amount;
                } else if (entry.direction === "out") {
                    headBalances[headName].balance -= entry.amount;
                }
            });

            // Group by section
            Object.entries(headBalances).forEach(([headName, data]) => {
                if (data.section === "assets") {
                    assetsByHead[headName] = Math.max(0, data.balance); // Ensure non-negative
                    assetsTotal += assetsByHead[headName];
                } else if (data.section === "liability") {
                    liabilitiesByHead[headName] = Math.max(0, data.balance); // Ensure non-negative
                    liabilitiesTotal += liabilitiesByHead[headName];
                }
            });
        } else {
            // Fallback to old calculation
            // Calculate cumulative surplus from Income & Expense Account (from group formation to asOnDate)
            const groupFormationDate = group.formation_date || new Date(0);
            const cumulativeSurplus = await calculateCumulativeSurplus(groupId, groupFormationDate, asOn);

            // Saving: Total saving balance from RecoveryMaster (sum of all saving amounts up to asOnDate)
            const savingBalance = await RecoveryMaster.aggregate([
                {
                    $match: {
                        groupId: group._id,
                        date: { $lte: asOn }
                    }
                },
                { $unwind: "$recoveries" },
                {
                    $group: {
                        _id: null,
                        total: { $sum: { $ifNull: ["$recoveries.amounts.saving", 0] } }
                    }
                }
            ]);
            const savingTotal = savingBalance[0]?.total || 0;

            // FD: Total FD balance from FDMaster (active FDs as on date)
            const fdBalance = await FDMaster.aggregate([
                {
                    $match: {
                        groupId: group._id,
                        status: { $in: ["active", "matured"] }, // Include active and matured FDs
                        date: { $lte: asOn }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: { $ifNull: ["$amount", 0] } }
                    }
                }
            ]);
            const fdTotal = fdBalance[0]?.total || 0;

            // Loan: Total outstanding loans from LoanMaster (transactionType="Loan" up to asOnDate)
            const loanBalance = await LoanMaster.aggregate([
                {
                    $match: {
                        groupId: group._id,
                        transactionType: "Loan",
                        date: { $lte: asOn }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: { $ifNull: ["$amount", 0] } }
                    }
                }
            ]);
            const loanTotal = loanBalance[0]?.total || 0;

            // Cash: Calculated balance from all transactions up to asOnDate
            const cashBalance = await calculateCashBalance(groupId, asOn);

            // Bank: Calculated balance from all bank transactions up to asOnDate
            const bankBalance = await calculateBankBalance(groupId, asOn);

            // Saving and FD are Liabilities (group owes members), not Assets
            assetsByHead = {
                "Loan Outstanding": loanTotal,
                "Cash": cashBalance,
                "Bank": bankBalance
            };
            assetsTotal = loanTotal + cashBalance + bankBalance;

            liabilitiesByHead = {
                "Surplus": cumulativeSurplus,
                "Saving": savingTotal,
                "FD": fdTotal
            };
            liabilitiesTotal = cumulativeSurplus + savingTotal + fdTotal;
        }

        // Remove "Loan Recover" from assets – asset is REMAINING loan (what members owe), not recovered amount
        delete assetsByHead["Loan Recover"];

        // Cash: same as getCashAmount - GroupMaster.current_cash_balance (total cash in hand)
        // Bank: same as bank screens - sum of current_balance of all banks linked to group (total all bank in hand)
        const cashBalance = Number(group.current_cash_balance) || 0;
        const bankIds = [...new Set([...(group.bankmasters && Array.isArray(group.bankmasters) ? group.bankmasters : []), ...(group.bankmaster ? [group.bankmaster] : [])].filter(Boolean).map((id) => id.toString()))];
        const banks = bankIds.length > 0 ? await BankMaster.find({ _id: { $in: bankIds } }).select("current_balance").lean() : [];
        const bankBalance = banks.reduce((sum, b) => sum + (Number(b.current_balance) || 0), 0);

        // Loan REMAINING (assets) = total disbursed − total recovered. NOT recovered amount.
        const loanDisbursedAgg = await LoanMaster.aggregate([
            { $match: { groupId: group._id, transactionType: "Loan", date: { $lte: asOn }, status: "approved" } },
            { $group: { _id: null, total: { $sum: { $ifNull: ["$amount", 0] } } } }
        ]);
        const totalLoanDisbursed = loanDisbursedAgg[0]?.total || 0;
        const loanRecoveredAgg = await RecoveryMaster.aggregate([
            { $match: { groupId: group._id, date: { $lte: asOn } } },
            { $unwind: "$recoveries" },
            { $group: { _id: null, total: { $sum: { $ifNull: ["$recoveries.amounts.loan", 0] } } } }
        ]);
        const totalLoanRecovered = loanRecoveredAgg[0]?.total || 0;
        const loanRemaining = Math.max(0, totalLoanDisbursed - totalLoanRecovered);

        // MEMBERSHIP FEE RECOVERABLE (assets) = remaining membership fee demand from MemberRevenueDemand (SHG + Group)
        const membershipFeeAgg = await MemberRevenueDemand.aggregate([
            {
                $match: {
                    groupId: group._id,
                    revenueType: { $in: ["membership_fees_shg", "membership_fees_group"] },
                },
            },
            {
                $group: {
                    _id: null,
                    totalDemand: { $sum: { $ifNull: ["$amount", 0] } },
                    totalPaid: { $sum: { $ifNull: ["$paidAmount", 0] } },
                },
            },
        ]);
        const totalMembershipFeeDemand = membershipFeeAgg[0]?.totalDemand || 0;
        const totalMembershipFeePaid = membershipFeeAgg[0]?.totalPaid || 0;
        const membershipFeeRecoverableRemaining = Math.max(0, totalMembershipFeeDemand - totalMembershipFeePaid);

        // GROUP CHARGES RECOVERABLE (assets) = only charges with entryType "assets" in GroupMaster.charges; demand minus paid from RecoveryMaster
        const memberCount = await Member.countDocuments({ group: group._id });
        const assetCharges = (group.charges || []).filter((c) => c.isActive !== false && (c.entryType || "expense") === "assets");
        const assetChargeNames = new Set(assetCharges.map((c) => (c.name || "").trim()).filter(Boolean));
        const totalChargesDemand = assetCharges.reduce((sum, c) => sum + (Number(c.amount) || 0) * memberCount, 0);
        const recoverySessions = await RecoveryMaster.find({ groupId: group._id, date: { $lte: asOn } })
            .select("recoveries.amounts.charges")
            .lean();
        let totalChargesPaid = 0;
        for (const session of recoverySessions) {
            for (const rec of session.recoveries || []) {
                const charges = rec.amounts?.charges || {};
                for (const [chargeName, amt] of Object.entries(charges)) {
                    if (assetChargeNames.has((chargeName || "").trim())) {
                        totalChargesPaid += Number(amt) || 0;
                    }
                }
            }
        }
        const chargesUnpaidRemaining = Math.max(0, totalChargesDemand - totalChargesPaid);

        assetsByHead["Cash"] = cashBalance;
        assetsByHead["Bank"] = bankBalance;
        assetsByHead["Loan Outstanding"] = loanRemaining;
        assetsByHead["MEMBERSHIP FEE RECOVERABLE"] = membershipFeeRecoverableRemaining;
        assetsByHead["GROUP CHARGES RECOVERABLE"] = chargesUnpaidRemaining;

        // Saving and FD are Liabilities (group owes members), not Assets – move from assets to liabilities
        const savingVal = Number(assetsByHead["Saving"]) || 0;
        const fdVal = Number(assetsByHead["FD"]) || 0;
        if (savingVal > 0 || fdVal > 0) {
            liabilitiesByHead["Saving"] = (Number(liabilitiesByHead["Saving"]) || 0) + savingVal;
            liabilitiesByHead["FD"] = (Number(liabilitiesByHead["FD"]) || 0) + fdVal;
            delete assetsByHead["Saving"];
            delete assetsByHead["FD"];
            liabilitiesTotal += savingVal + fdVal;
        }

        assetsTotal = Object.keys(assetsByHead).reduce((sum, key) => sum + (Number(assetsByHead[key]) || 0), 0);

        const result = {
            asOnDate: asOn,
            liabilities: {
                ...liabilitiesByHead,
                total: liabilitiesTotal
            },
            assets: {
                ...assetsByHead,
                total: assetsTotal
            }
        };

        return apiResponse.success(res, "Balance Sheet generated successfully", result);

    } catch (error) {
        console.error("Error generating Balance Sheet:", error);
        return apiResponse.error(res, error.message, 500);
    }
};

// Helper functions

async function calculateOpeningCash(groupId, beforeDate) {
    const result = await RecoveryMaster.aggregate([
        {
            $match: {
                groupId: groupId,
                date: { $lt: beforeDate }
            }
        },
        { $unwind: "$recoveries" },
        {
            $match: {
                "recoveries.paymentMode.cash": true
            }
        },
        {
            $addFields: {
                // If recovery.total exists, use it; otherwise calculate from amounts
                recoveryTotal: {
                    $ifNull: [
                        "$recoveries.total",
                        {
                            $add: [
                                { $ifNull: ["$recoveries.amounts.saving", 0] },
                                { $ifNull: ["$recoveries.amounts.loan", 0] },
                                { $ifNull: ["$recoveries.amounts.fd", 0] },
                                { $ifNull: ["$recoveries.amounts.interest", 0] },
                                { $ifNull: ["$recoveries.amounts.memFeesSHG", 0] },
                                { $ifNull: ["$recoveries.amounts.memFeesSamiti", 0] },
                                { $ifNull: ["$recoveries.amounts.memFeesGroup", 0] },
                                { $ifNull: ["$recoveries.amounts.yogdan", 0] },
                                { $ifNull: ["$recoveries.amounts.other", 0] },
                                { $ifNull: ["$recoveries.amounts.penalty", 0] },
                                {
                                    $reduce: {
                                        input: { $objectToArray: { $ifNull: ["$recoveries.amounts.charges", {}] } },
                                        initialValue: 0,
                                        in: {
                                            $add: [
                                                "$$value",
                                                {
                                                    $convert: {
                                                        input: "$$this.v",
                                                        to: "double",
                                                        onError: 0,
                                                        onNull: 0
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                }
                            ]
                        }
                    ]
                }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: "$recoveryTotal" }
            }
        }
    ]);
    const receipts = result[0]?.total || 0;

    const expenses = await ExpenseMaster.aggregate([
        {
            $match: {
                groupId: groupId,
                date: { $lt: beforeDate },
                paymentMode: "Cash"
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: { $ifNull: ["$amount", 0] } }
            }
        }
    ]);
    const expensesTotal = expenses[0]?.total || 0;

    // Other expenses from LoanMaster (transactionType="Expense") paid in Cash
    const otherExpensesCash = await LoanMaster.aggregate([
        {
            $match: {
                groupId: groupId,
                transactionType: "Expense",
                paymentMode: "Cash",
                date: { $lt: beforeDate }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: { $ifNull: ["$amount", 0] } }
            }
        }
    ]);
    const otherExpensesCashTotal = otherExpensesCash[0]?.total || 0;

    const loans = await LoanMaster.aggregate([
        {
            $match: {
                groupId: groupId,
                transactionType: "Loan",
                paymentMode: "Cash",
                date: { $lt: beforeDate }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: { $ifNull: ["$amount", 0] } }
            }
        }
    ]);
    const loansTotal = loans[0]?.total || 0;

    // Get cash transactions from CashTransaction model (before date)
    const cashTransactionReceipts = await CashTransaction.find({
        groupId: groupId,
        transactionType: "recovery",
        status: "verified",
        date: { $lt: beforeDate }
    }).lean();
    const cashTransactionReceiptsTotal = cashTransactionReceipts.reduce((sum, t) => sum + (t.amount || 0), 0);

    // Get cash payments (debits) from CashTransaction - all types except recovery and bank_to_cash
    const cashTransactionPayments = await CashTransaction.find({
        groupId: groupId,
        transactionType: { $in: ["expense", "loan", "fd", "payment", "other"] },
        status: "verified",
        date: { $lt: beforeDate }
    }).lean();
    const cashTransactionPaymentsTotal = cashTransactionPayments.reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalReceipts = receipts + cashTransactionReceiptsTotal;
    const totalPayments = expensesTotal + otherExpensesCashTotal + loansTotal + cashTransactionPaymentsTotal;

    return totalReceipts - totalPayments;
}

async function calculateOpeningBank(groupId, beforeDate) {
    const result = await RecoveryMaster.aggregate([
        {
            $match: {
                groupId: groupId,
                date: { $lt: beforeDate }
            }
        },
        { $unwind: "$recoveries" },
        {
            $match: {
                "recoveries.paymentMode.online": true
            }
        },
        {
            $addFields: {
                // If recovery.total exists, use it; otherwise calculate from amounts
                recoveryTotal: {
                    $ifNull: [
                        "$recoveries.total",
                        {
                            $add: [
                                { $ifNull: ["$recoveries.amounts.saving", 0] },
                                { $ifNull: ["$recoveries.amounts.loan", 0] },
                                { $ifNull: ["$recoveries.amounts.fd", 0] },
                                { $ifNull: ["$recoveries.amounts.interest", 0] },
                                { $ifNull: ["$recoveries.amounts.memFeesSHG", 0] },
                                { $ifNull: ["$recoveries.amounts.memFeesSamiti", 0] },
                                { $ifNull: ["$recoveries.amounts.memFeesGroup", 0] },
                                { $ifNull: ["$recoveries.amounts.yogdan", 0] },
                                { $ifNull: ["$recoveries.amounts.other", 0] },
                                { $ifNull: ["$recoveries.amounts.penalty", 0] },
                                {
                                    $reduce: {
                                        input: { $objectToArray: { $ifNull: ["$recoveries.amounts.charges", {}] } },
                                        initialValue: 0,
                                        in: {
                                            $add: [
                                                "$$value",
                                                {
                                                    $convert: {
                                                        input: "$$this.v",
                                                        to: "double",
                                                        onError: 0,
                                                        onNull: 0
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                }
                            ]
                        }
                    ]
                }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: "$recoveryTotal" }
            }
        }
    ]);
    const receipts = result[0]?.total || 0;

    const expenses = await ExpenseMaster.aggregate([
        {
            $match: {
                groupId: groupId,
                date: { $lt: beforeDate },
                paymentMode: "Bank"
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: { $ifNull: ["$amount", 0] } }
            }
        }
    ]);
    const expensesTotal = expenses[0]?.total || 0;

    // Other expenses from LoanMaster (transactionType="Expense") paid via Bank
    const otherExpensesBank = await LoanMaster.aggregate([
        {
            $match: {
                groupId: groupId,
                transactionType: "Expense",
                paymentMode: "Bank",
                date: { $lt: beforeDate }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: { $ifNull: ["$amount", 0] } }
            }
        }
    ]);
    const otherExpensesBankTotal = otherExpensesBank[0]?.total || 0;

    const loans = await LoanMaster.aggregate([
        {
            $match: {
                groupId: groupId,
                transactionType: "Loan",
                paymentMode: "Bank",
                date: { $lt: beforeDate }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: { $ifNull: ["$amount", 0] } }
            }
        }
    ]);
    const loansTotal = loans[0]?.total || 0;

    return receipts - expensesTotal - otherExpensesBankTotal - loansTotal;
}

async function calculateOpeningSaving(groupId, beforeDate) {
    const result = await RecoveryMaster.aggregate([
        {
            $match: {
                groupId: groupId,
                date: { $lt: beforeDate }
            }
        },
        { $unwind: "$recoveries" },
        {
            $group: {
                _id: null,
                total: { $sum: { $ifNull: ["$recoveries.amounts.saving", 0] } }
            }
        }
    ]);
    return result[0]?.total || 0;
}

async function calculateOpeningFD(groupId, beforeDate) {
    const result = await FDMaster.aggregate([
        {
            $match: {
                groupId: groupId,
                date: { $lt: beforeDate }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: { $ifNull: ["$amount", 0] } }
            }
        }
    ]);
    return result[0]?.total || 0;
}

async function calculateCumulativeSurplus(groupId, fromDate, toDate) {
    // Get all expenses in the period
    const expenses = await ExpenseMaster.aggregate([
        {
            $match: {
                groupId: groupId,
                date: { $gte: fromDate, $lte: toDate }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: { $ifNull: ["$amount", 0] } }
            }
        }
    ]);
    const totalExpenses = expenses[0]?.total || 0;

    // Get all member fees in the period
    const memberFees = await RecoveryMaster.aggregate([
        {
            $match: {
                groupId: groupId,
                date: { $gte: fromDate, $lte: toDate }
            }
        },
        { $unwind: "$recoveries" },
        {
            $group: {
                _id: null,
                total: {
                    $sum: {
                        $add: [
                            { $ifNull: ["$recoveries.amounts.memFeesSHG", 0] },
                            { $ifNull: ["$recoveries.amounts.memFeesSamiti", 0] }
                        ]
                    }
                }
            }
        }
    ]);
    const totalIncome = memberFees[0]?.total || 0;

    return totalIncome - totalExpenses;
}

async function calculateCashBalance(groupId, asOnDate) {
    return await calculateOpeningCash(groupId, new Date(asOnDate.getTime() + 24 * 60 * 60 * 1000));
}

async function calculateBankBalance(groupId, asOnDate) {
    return await calculateOpeningBank(groupId, new Date(asOnDate.getTime() + 24 * 60 * 60 * 1000));
}

