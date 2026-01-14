import apiResponse from "../../utility/apiResponse.js";
import { GroupMaster, RecoveryMaster, LoanMaster, FDMaster, ExpenseMaster, PaymentMaster, BankTransaction, CashTransaction } from "../../model/index.js";
import { verifyGroupAccess } from "../../utility/groupAccessHelper.js";

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
                $group: {
                    _id: null,
                    total: {
                        $sum: {
                            $add: [
                                { $ifNull: ["$recoveries.amounts.saving", 0] },
                                { $ifNull: ["$recoveries.amounts.loan", 0] },
                                { $ifNull: ["$recoveries.amounts.fd", 0] },
                                { $ifNull: ["$recoveries.amounts.interest", 0] },
                                { $ifNull: ["$recoveries.amounts.memFeesSHG", 0] },
                                { $ifNull: ["$recoveries.amounts.memFeesSamiti", 0] },
                                { $ifNull: ["$recoveries.amounts.yogdan", 0] },
                                { $ifNull: ["$recoveries.amounts.other", 0] },
                                { $ifNull: ["$recoveries.amounts.penalty", 0] }
                            ]
                        }
                    }
                }
            }
        ]);
        const cashReceiptsTotal = cashReceipts[0]?.total || 0;

        // Bank: Sum of bank receipts from recoveries
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
                $group: {
                    _id: null,
                    total: {
                        $sum: {
                            $add: [
                                { $ifNull: ["$recoveries.amounts.saving", 0] },
                                { $ifNull: ["$recoveries.amounts.loan", 0] },
                                { $ifNull: ["$recoveries.amounts.fd", 0] },
                                { $ifNull: ["$recoveries.amounts.interest", 0] },
                                { $ifNull: ["$recoveries.amounts.memFeesSHG", 0] },
                                { $ifNull: ["$recoveries.amounts.memFeesSamiti", 0] },
                                { $ifNull: ["$recoveries.amounts.yogdan", 0] },
                                { $ifNull: ["$recoveries.amounts.other", 0] },
                                { $ifNull: ["$recoveries.amounts.penalty", 0] }
                            ]
                        }
                    }
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
        // Bank payments from PaymentMaster (always bank-based)
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

        // Get CashTransaction receipts (recovery payments in cash) for this period
        const cashTransactionReceiptsQuery = {
            groupId: group._id,
            transactionType: "recovery",
            status: "verified" // Only verified cash transactions
        };
        if (from && to) {
            cashTransactionReceiptsQuery.date = { $gte: from, $lte: to };
        }
        const cashTransactionReceipts = await CashTransaction.find(cashTransactionReceiptsQuery).lean();
        const cashTransactionReceiptsTotal = cashTransactionReceipts.reduce((sum, t) => sum + (t.amount || 0), 0);

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
        // Calculate total cash receipts (from RecoveryMaster + CashTransaction)
        const totalCashReceipts = cashReceiptsTotal + cashTransactionReceiptsTotal;
        
        // Calculate total cash payments (expenses + loans + FD + payments + cash-to-bank from CashTransaction)
        const totalCashPayments = cashExpensesTotal + cashTransactionExpensesTotal + otherCashExpensesTotal + 
                                  cashLoansTotal + cashTransactionLoansTotal + cashTransactionFDTotal + 
                                  cashTransactionPaymentTotal + cashToBankTotal;
        
        const closingCashBalance = openingCash + totalCashReceipts - totalCashPayments;
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
                cash: totalCashReceipts, // Include CashTransaction receipts
                bank: bankReceiptsTotal,
                saving: savingTotal,
                fd: fdTotal,
                memberFees: memberFeesTotal,
                bankTransactions: bankTransactionReceiptsTotal, // Add BankTransaction receipts
                cashTransactions: cashTransactionReceiptsTotal // Add CashTransaction receipts
            },
            payments: {
                expenses: expensesByType,
                loan: loanTotal,
                saving: savingWithdrawalTotal,
                fd: fdMaturityTotal,
                cashPayments: {
                    expenses: cashExpensesTotal + cashTransactionExpensesTotal + otherCashExpensesTotal,
                    loans: cashLoansTotal + cashTransactionLoansTotal,
                    fd: cashTransactionFDTotal,
                    payments: cashTransactionPaymentTotal,
                    cashToBank: cashToBankTotal
                }
            },
            closingBalances: {
                cash: closingCashBalance,
                bank: closingBankBalance
            },
            totals: {
                receipts: totalCashReceipts + bankReceiptsTotal + savingTotal + fdTotal + memberFeesTotal + bankTransactionReceiptsTotal,
                payments: totalPayments + totalCashPayments
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
 * Get Income & Expense Account for a date range
 */
export const getIncomeExpenseAccount = async (req, res) => {
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

        // Build date filter condition
        const dateFilter = (from && to) ? { date: { $gte: from, $lte: to } } : {};

        // Expenses: Group ExpenseMaster by expenseType
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
        const otherExpensesTotal = otherExpenses[0]?.total || 0;
        if (otherExpensesTotal > 0) {
            expensesByType["Other"] = otherExpensesTotal;
        }

        // Income: Sum of Member Fees from RecoveryMaster
        const memberFees = await RecoveryMaster.aggregate([
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
        const incomeTotal = memberFees[0]?.total || 0;

        const totalExpenses = Object.values(expensesByType).reduce((sum, val) => sum + val, 0);
        const surplus = incomeTotal - totalExpenses;

        const result = {
            period: {
                fromDate: from,
                toDate: to
            },
            expenses: expensesByType,
            income: {
                memberFees: incomeTotal
            },
            surplus: surplus,
            totals: {
                expenses: totalExpenses,
                income: incomeTotal
            }
        };

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

        // Liabilities
        const liabilitiesTotal = cumulativeSurplus + savingTotal + fdTotal;

        // Assets
        const assetsTotal = loanTotal + cashBalance + bankBalance;

        const result = {
            asOnDate: asOn,
            liabilities: {
                surplus: cumulativeSurplus,
                saving: savingTotal,
                fd: fdTotal,
                total: liabilitiesTotal
            },
            assets: {
                loan: loanTotal,
                cash: cashBalance,
                bank: bankBalance,
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
            $group: {
                _id: null,
                total: {
                    $sum: {
                        $add: [
                            { $ifNull: ["$recoveries.amounts.saving", 0] },
                            { $ifNull: ["$recoveries.amounts.loan", 0] },
                            { $ifNull: ["$recoveries.amounts.fd", 0] },
                            { $ifNull: ["$recoveries.amounts.interest", 0] },
                            { $ifNull: ["$recoveries.amounts.memFeesSHG", 0] },
                            { $ifNull: ["$recoveries.amounts.memFeesSamiti", 0] },
                            { $ifNull: ["$recoveries.amounts.yogdan", 0] },
                            { $ifNull: ["$recoveries.amounts.other", 0] },
                            { $ifNull: ["$recoveries.amounts.penalty", 0] }
                        ]
                    }
                }
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
            $group: {
                _id: null,
                total: {
                    $sum: {
                        $add: [
                            { $ifNull: ["$recoveries.amounts.saving", 0] },
                            { $ifNull: ["$recoveries.amounts.loan", 0] },
                            { $ifNull: ["$recoveries.amounts.fd", 0] },
                            { $ifNull: ["$recoveries.amounts.interest", 0] },
                            { $ifNull: ["$recoveries.amounts.memFeesSHG", 0] },
                            { $ifNull: ["$recoveries.amounts.memFeesSamiti", 0] },
                            { $ifNull: ["$recoveries.amounts.yogdan", 0] },
                            { $ifNull: ["$recoveries.amounts.other", 0] },
                            { $ifNull: ["$recoveries.amounts.penalty", 0] }
                        ]
                    }
                }
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

