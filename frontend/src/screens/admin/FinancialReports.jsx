import React, { useEffect, useState } from "react";
import { FileText, Building2, Calendar, Loader2 } from "lucide-react";
import { getGroups } from "../../services/groupService";
import { getReceiptPaymentAccount, getIncomeExpenseAccount, getBalanceSheet } from "../../services/financialReportService";
import ReceiptPaymentAccount from "../../components/reports/ReceiptPaymentAccount";
import IncomeExpenseAccount from "../../components/reports/IncomeExpenseAccount";
import BalanceSheet from "../../components/reports/BalanceSheet";
import Loader, { OverlayLoader } from "../../components/common/Loader";
import ErrorMessage from "../../components/common/ErrorMessage";
import { handleApiError, extractErrorMessage } from "../../utils/apiErrorHandler";

export default function FinancialReports() {
    const [groups, setGroups] = useState([]);
    const [groupsLoading, setGroupsLoading] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [activeTab, setActiveTab] = useState("receipt-payment"); // receipt-payment, income-expense, balance-sheet

    // Date range for Receipt & Payment and Income & Expense
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");

    // Date for Balance Sheet
    const [asOnDate, setAsOnDate] = useState(new Date().toISOString().split("T")[0]);

    // Report data
    const [receiptPaymentData, setReceiptPaymentData] = useState(null);
    const [incomeExpenseData, setIncomeExpenseData] = useState(null);
    const [balanceSheetData, setBalanceSheetData] = useState(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [reportLoading, setReportLoading] = useState({
        receiptPayment: false,
        incomeExpense: false,
        balanceSheet: false,
    });

    useEffect(() => {
        setGroupsLoading(true);
        setError(null);
        getGroups()
            .then((res) => {
                const list = Array.isArray(res?.data) ? res.data : [];
                setGroups(
                    list.map((g) => ({
                        id: g._id,
                        name: g.group_name,
                        code: g.group_code,
                        village: g.village,
                    }))
                );
            })
            .catch((e) => {
                console.error("Failed to load groups:", e);
                const errorInfo = handleApiError(e, {
                    defaultMessage: "Failed to load groups. Please refresh the page.",
                });
                setError(errorInfo);
                setGroups([]);
            })
            .finally(() => setGroupsLoading(false));
    }, []);

    const loadReceiptPaymentAccount = async () => {
        if (!selectedGroup?.id) {
            setError({
                message: "Please select a group to view the report.",
                title: "Group Required",
                type: "client",
                shouldShow: true,
            });
            return;
        }
        try {
            setReportLoading((prev) => ({ ...prev, receiptPayment: true }));
            setError(null);
            // Date range is optional - if not provided, show full range
            const response = await getReceiptPaymentAccount(selectedGroup.id, fromDate || null, toDate || null);
            if (response.success) {
                setReceiptPaymentData(response.data);
            } else {
                const errorInfo = handleApiError(
                    { message: response.message || "Failed to load report" },
                    { defaultMessage: "Failed to load Receipt & Payment Account report." }
                );
                setError(errorInfo);
            }
        } catch (err) {
            console.error("Error loading Receipt & Payment Account:", err);
            const errorInfo = handleApiError(err, {
                defaultMessage: "Failed to load Receipt & Payment Account report. Please try again.",
            });
            setError(errorInfo);
        } finally {
            setReportLoading((prev) => ({ ...prev, receiptPayment: false }));
        }
    };

    const loadIncomeExpenseAccount = async () => {
        if (!selectedGroup?.id) {
            setError({
                message: "Please select a group to view the report.",
                title: "Group Required",
                type: "client",
                shouldShow: true,
            });
            return;
        }
        try {
            setReportLoading((prev) => ({ ...prev, incomeExpense: true }));
            setError(null);
            // Date range is optional - if not provided, show full range
            const response = await getIncomeExpenseAccount(selectedGroup.id, fromDate || null, toDate || null);
            if (response.success) {
                setIncomeExpenseData(response.data);
            } else {
                const errorInfo = handleApiError(
                    { message: response.message || "Failed to load report" },
                    { defaultMessage: "Failed to load Income & Expense Account report." }
                );
                setError(errorInfo);
            }
        } catch (err) {
            console.error("Error loading Income & Expense Account:", err);
            const errorInfo = handleApiError(err, {
                defaultMessage: "Failed to load Income & Expense Account report. Please try again.",
            });
            setError(errorInfo);
        } finally {
            setReportLoading((prev) => ({ ...prev, incomeExpense: false }));
        }
    };

    const loadBalanceSheet = async () => {
        if (!selectedGroup?.id) {
            setError({
                message: "Please select a group to view the report.",
                title: "Group Required",
                type: "client",
                shouldShow: true,
            });
            return;
        }
        if (!asOnDate) {
            setError({
                message: "Please select a date to view the balance sheet.",
                title: "Date Required",
                type: "client",
                shouldShow: true,
            });
            return;
        }
        try {
            setReportLoading((prev) => ({ ...prev, balanceSheet: true }));
            setError(null);
            const response = await getBalanceSheet(selectedGroup.id, asOnDate);
            if (response.success) {
                setBalanceSheetData(response.data);
            } else {
                const errorInfo = handleApiError(
                    { message: response.message || "Failed to load report" },
                    { defaultMessage: "Failed to load Balance Sheet report." }
                );
                setError(errorInfo);
            }
        } catch (err) {
            console.error("Error loading Balance Sheet:", err);
            const errorInfo = handleApiError(err, {
                defaultMessage: "Failed to load Balance Sheet report. Please try again.",
            });
            setError(errorInfo);
        } finally {
            setReportLoading((prev) => ({ ...prev, balanceSheet: false }));
        }
    };

    const handleLoadReport = () => {
        setError(null);
        if (activeTab === "receipt-payment") {
            loadReceiptPaymentAccount();
        } else if (activeTab === "income-expense") {
            loadIncomeExpenseAccount();
        } else if (activeTab === "balance-sheet") {
            loadBalanceSheet();
        }
    };

    const handleDismissError = () => {
        setError(null);
    };

    const handleRetry = () => {
        handleLoadReport();
    };

    useEffect(() => {
        // Auto-load when group is selected or tab changes
        if (selectedGroup?.id) {
            if (activeTab === "receipt-payment" && receiptPaymentData === null) {
                loadReceiptPaymentAccount();
            } else if (activeTab === "income-expense" && incomeExpenseData === null) {
                loadIncomeExpenseAccount();
            } else if (activeTab === "balance-sheet" && asOnDate && balanceSheetData === null) {
                loadBalanceSheet();
            }
        }
    }, [activeTab, selectedGroup]);

    // Reload when date range changes
    useEffect(() => {
        if (selectedGroup?.id && (activeTab === "receipt-payment" || activeTab === "income-expense")) {
            if (activeTab === "receipt-payment") {
                loadReceiptPaymentAccount();
            } else if (activeTab === "income-expense") {
                loadIncomeExpenseAccount();
            }
        }
    }, [fromDate, toDate]);

    // Reload when asOnDate changes for balance sheet
    useEffect(() => {
        if (selectedGroup?.id && activeTab === "balance-sheet" && asOnDate) {
            loadBalanceSheet();
        }
    }, [asOnDate]);

    if (!selectedGroup) {
        return (
            <div className="max-w-7xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <FileText size={32} />
                        Financial Reports
                    </h1>
                    <p className="text-gray-600 mt-2">Select a group to view financial reports</p>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <Building2 size={24} className="text-blue-600" />
                        Select Group
                    </h2>
                    {groupsLoading ? (
                        <Loader loading={true} message="Loading groups..." />
                    ) : error && error.shouldShow ? (
                        <div className="mb-4">
                            <ErrorMessage error={error} onDismiss={handleDismissError} onRetry={handleRetry} />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {groups.map((g) => (
                                <div
                                    key={g.id}
                                    onClick={() => setSelectedGroup(g)}
                                    className="p-6 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3 mb-3">
                                        <Building2 className="text-blue-600" size={32} />
                                        <div>
                                            <p className="font-semibold text-gray-800 text-lg">{g.name}</p>
                                            <p className="text-sm text-gray-600">Code: {g.code}</p>
                                        </div>
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        <p>Village: {g.village || "-"}</p>
                                    </div>
                                </div>
                            ))}
                            {groups.length === 0 && (
                                <div className="col-span-full text-center py-8 text-gray-500">
                                    <p>No groups found.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto">
            <div className="mb-6">
                <button
                    onClick={() => {
                        setSelectedGroup(null);
                        setReceiptPaymentData(null);
                        setIncomeExpenseData(null);
                        setBalanceSheetData(null);
                        setError(null);
                    }}
                    className="text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-2"
                >
                    ← Back to Groups
                </button>
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <FileText size={32} />
                    Financial Reports - {selectedGroup.name}
                </h1>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-lg shadow-md mb-6">
                <div className="flex border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab("receipt-payment")}
                        className={`flex-1 px-4 py-3 text-center font-semibold ${
                            activeTab === "receipt-payment"
                                ? "bg-blue-600 text-white border-b-2 border-blue-600"
                                : "text-gray-600 hover:bg-gray-100"
                        }`}
                    >
                        Receipt & Payment Account
                    </button>
                    <button
                        onClick={() => setActiveTab("income-expense")}
                        className={`flex-1 px-4 py-3 text-center font-semibold ${
                            activeTab === "income-expense"
                                ? "bg-blue-600 text-white border-b-2 border-blue-600"
                                : "text-gray-600 hover:bg-gray-100"
                        }`}
                    >
                        Income & Expense Account
                    </button>
                    <button
                        onClick={() => setActiveTab("balance-sheet")}
                        className={`flex-1 px-4 py-3 text-center font-semibold ${
                            activeTab === "balance-sheet"
                                ? "bg-blue-600 text-white border-b-2 border-blue-600"
                                : "text-gray-600 hover:bg-gray-100"
                        }`}
                    >
                        Balance Sheet
                    </button>
                </div>
            </div>

            {/* Date Filters */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(activeTab === "receipt-payment" || activeTab === "income-expense") ? (
                        <>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                                    <Calendar size={16} />
                                    From Date
                                </label>
                                <input
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                                    <Calendar size={16} />
                                    To Date
                                </label>
                                <input
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => setToDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={handleLoadReport}
                                    disabled={reportLoading.receiptPayment || reportLoading.incomeExpense}
                                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {(reportLoading.receiptPayment || reportLoading.incomeExpense) ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Loading...
                                        </>
                                    ) : (
                                        "Load Report"
                                    )}
                                </button>
                            </div>
                            <div className="col-span-3 text-sm text-gray-600">
                                <p>Leave date fields empty to view all time data. Select dates to filter by range.</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                                    <Calendar size={16} />
                                    As On Date
                                </label>
                                <input
                                    type="date"
                                    value={asOnDate}
                                    onChange={(e) => setAsOnDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={handleLoadReport}
                                    disabled={reportLoading.balanceSheet || !asOnDate}
                                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {reportLoading.balanceSheet ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Loading...
                                        </>
                                    ) : (
                                        "Load Report"
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Error Message */}
            {error && error.shouldShow && (
                <div className="mb-6">
                    <ErrorMessage
                        error={error}
                        onDismiss={handleDismissError}
                        onRetry={handleRetry}
                    />
                </div>
            )}

            {/* Report Content */}
            <div className="relative">
                {/* Loading Overlay */}
                {activeTab === "receipt-payment" && reportLoading.receiptPayment && (
                    <OverlayLoader loading={true} message="Loading Receipt & Payment Account..." />
                )}
                {activeTab === "income-expense" && reportLoading.incomeExpense && (
                    <OverlayLoader loading={true} message="Loading Income & Expense Account..." />
                )}
                {activeTab === "balance-sheet" && reportLoading.balanceSheet && (
                    <OverlayLoader loading={true} message="Loading Balance Sheet..." />
                )}

                {/* Report Components */}
                {activeTab === "receipt-payment" && (
                    <ReceiptPaymentAccount
                        data={receiptPaymentData}
                        fromDate={fromDate}
                        toDate={toDate}
                        groupName={selectedGroup.name}
                    />
                )}
                {activeTab === "income-expense" && (
                    <IncomeExpenseAccount
                        data={incomeExpenseData}
                        fromDate={fromDate}
                        toDate={toDate}
                        groupName={selectedGroup.name}
                    />
                )}
                {activeTab === "balance-sheet" && (
                    <BalanceSheet
                        data={balanceSheetData}
                        asOnDate={asOnDate}
                        groupName={selectedGroup.name}
                    />
                )}
            </div>
        </div>
    );
}

