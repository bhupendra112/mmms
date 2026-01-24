import React, { useEffect, useMemo, useState, useCallback } from "react";
import { FileText, Building2, Calendar, Loader2, LayoutGrid } from "lucide-react";
import { getGroups } from "../../services/groupService";
import {
    getReceiptPaymentAccount,
    getIncomeExpenseAccount,
    getBalanceSheet,
} from "../../services/financialReportService";
import ReceiptPaymentAccount from "../../components/reports/ReceiptPaymentAccount";
import IncomeExpenseAccount from "../../components/reports/IncomeExpenseAccount";
import BalanceSheet from "../../components/reports/BalanceSheet";
import Loader, { OverlayLoader } from "../../components/common/Loader";
import ErrorMessage from "../../components/common/ErrorMessage";
import { handleApiError } from "../../utils/apiErrorHandler";

const DEBUG_INGEST =
    "http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22";

// #region agent log
function debugIngest(payload) {
    try {
        fetch(DEBUG_INGEST, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...payload,
                timestamp: payload.timestamp ?? Date.now(),
                sessionId: payload.sessionId ?? "debug-session",
                runId: payload.runId ?? "initial",
            }),
        }).catch(() => { });
    } catch (_) { }
}
// #endregion

// Viewport debug
function useViewportDebug(enable = true) {
    const log = useCallback(() => {
        if (!enable || typeof window === "undefined") return;
        const w = window.innerWidth;
        const bodyScroll = document.body?.scrollWidth ?? 0;
        const bodyClient = document.body?.clientWidth ?? 0;
        const breakpoint = w < 640 ? "phone" : w < 1024 ? "tablet" : "desktop";
        const overflow = bodyScroll > bodyClient;
        const payload = {
            location: "FinancialReports",
            windowInnerWidth: w,
            breakpoint,
            bodyScrollWidth: bodyScroll,
            bodyClientWidth: bodyClient,
            hasHorizontalOverflow: overflow,
            ts: Date.now(),
        };
        console.log("[FinancialReports viewport]", payload);
        if (overflow) {
            console.warn(
                "[FinancialReports] Horizontal overflow detected – may cause phone layout issues.",
                payload
            );
        }
        try {
            if (!window.__financialReportsViewportLog) window.__financialReportsViewportLog = [];
            window.__financialReportsViewportLog.push(payload);
            if (window.__financialReportsViewportLog.length > 50) window.__financialReportsViewportLog.shift();
        } catch (_) { }
    }, [enable]);

    useEffect(() => {
        log();
        let timeoutId;
        const onResize = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(log, 150);
        };
        window.addEventListener("resize", onResize);
        return () => {
            window.removeEventListener("resize", onResize);
            clearTimeout(timeoutId);
        };
    }, [log]);
}

export default function FinancialReports() {
    const [groups, setGroups] = useState([]);
    const [groupsLoading, setGroupsLoading] = useState(false);

    const [selectedCluster, setSelectedCluster] = useState(null); // { name, code }
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

    const [error, setError] = useState(null);
    const [reportLoading, setReportLoading] = useState({
        receiptPayment: false,
        incomeExpense: false,
        balanceSheet: false,
    });

    useViewportDebug(true);

    // #region agent log
    useEffect(() => {
        const run = () => {
            const w = window.innerWidth;
            const bodyScroll = document.body?.scrollWidth ?? 0;
            const bodyClient = document.body?.clientWidth ?? 0;
            const breakpoint = w < 640 ? "phone" : w < 1024 ? "tablet" : "desktop";
            const overflow = bodyScroll > bodyClient;
            const screen = selectedGroup ? "report" : "cluster";
            debugIngest({
                location: "FinancialReports.jsx:viewport",
                message: "Viewport and screen",
                data: {
                    windowInnerWidth: w,
                    breakpoint,
                    bodyScrollWidth: bodyScroll,
                    bodyClientWidth: bodyClient,
                    hasHorizontalOverflow: overflow,
                    screen,
                    activeTab: selectedGroup ? activeTab : null,
                },
                hypothesisId: overflow ? "H1" : "H2",
            });

            setTimeout(() => {
                const tabs = document.querySelector("[data-debug='fr-tabs']");
                const report = document.querySelector("[data-debug='fr-report']");
                if (tabs) {
                    const tw = tabs.scrollWidth;
                    const tc = tabs.clientWidth;
                    debugIngest({
                        location: "FinancialReports.jsx:tabs",
                        message: "Tabs container dimensions",
                        data: {
                            scrollWidth: tw,
                            clientWidth: tc,
                            overflows: tw > tc,
                            windowInnerWidth: w,
                            breakpoint,
                        },
                        hypothesisId: "H4",
                    });
                }
                if (report) {
                    const rw = report.scrollWidth;
                    const rc = report.clientWidth;
                    const table = report.querySelector("table");
                    const tScroll = table ? table.scrollWidth : null;
                    const tClient = table ? table.clientWidth : null;
                    debugIngest({
                        location: "FinancialReports.jsx:report",
                        message: "Report container and table",
                        data: {
                            containerScrollWidth: rw,
                            containerClientWidth: rc,
                            containerOverflows: rw > rc,
                            tableScrollWidth: tScroll,
                            tableClientWidth: tClient,
                            tableOverflows: tScroll != null && tClient != null && tScroll > tClient,
                            windowInnerWidth: w,
                            breakpoint,
                            activeTab,
                        },
                        hypothesisId: "H3",
                    });
                }
            }, 120);
        };

        run();
        let t;
        const onResize = () => {
            clearTimeout(t);
            t = setTimeout(run, 200);
        };
        window.addEventListener("resize", onResize);
        return () => {
            window.removeEventListener("resize", onResize);
            clearTimeout(t);
        };
    }, [selectedGroup, activeTab]);
    // #endregion

    // ----------------------------
    // Fetch groups
    // ----------------------------
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
                        cluster_name: g.cluster_name,
                        cluster_code: g.cluster_code,
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

    // ----------------------------
    // Cluster list (unique)
    // ----------------------------
    const clusterList = useMemo(() => {
        const map = new Map();
        for (const g of groups) {
            const name = g.cluster_name || "";
            const code = g.cluster_code || "";
            const key = `${name}|${code}`;
            if (!map.has(key)) map.set(key, { name, code });
        }
        return Array.from(map.values()).filter((c) =>
            groups.some(
                (g) =>
                    (g.cluster_name || "") === c.name && (g.cluster_code || "") === c.code
            )
        );
    }, [groups]);

    // ----------------------------
    // Filter groups by selected cluster
    // ----------------------------
    const filteredGroups = useMemo(() => {
        if (!selectedCluster) return [];
        return groups.filter(
            (g) =>
                (g.cluster_name || "") === (selectedCluster.name || "") &&
                (g.cluster_code || "") === (selectedCluster.code || "")
        );
    }, [groups, selectedCluster]);

    // ----------------------------
    // API Loaders
    // ----------------------------
    const ensureGroupSelected = () => {
        if (!selectedGroup?.id) {
            setError({
                message: "Please select a group to view the report.",
                title: "Group Required",
                type: "client",
                shouldShow: true,
            });
            return false;
        }
        return true;
    };

    const loadReceiptPaymentAccount = async () => {
        if (!ensureGroupSelected()) return;

        try {
            setReportLoading((prev) => ({ ...prev, receiptPayment: true }));
            setError(null);

            const response = await getReceiptPaymentAccount(
                selectedGroup.id,
                fromDate || null,
                toDate || null
            );

            if (response?.success) {
                setReceiptPaymentData(response.data);
            } else {
                setError(
                    handleApiError(
                        { message: response?.message || "Failed to load report" },
                        { defaultMessage: "Failed to load Receipt & Payment Account report." }
                    )
                );
            }
        } catch (err) {
            console.error("Error loading Receipt & Payment Account:", err);
            setError(
                handleApiError(err, {
                    defaultMessage:
                        "Failed to load Receipt & Payment Account report. Please try again.",
                })
            );
        } finally {
            setReportLoading((prev) => ({ ...prev, receiptPayment: false }));
        }
    };

    const loadIncomeExpenseAccount = async () => {
        if (!ensureGroupSelected()) return;

        try {
            setReportLoading((prev) => ({ ...prev, incomeExpense: true }));
            setError(null);

            const response = await getIncomeExpenseAccount(
                selectedGroup.id,
                fromDate || null,
                toDate || null
            );

            if (response?.success) {
                setIncomeExpenseData(response.data);
            } else {
                setError(
                    handleApiError(
                        { message: response?.message || "Failed to load report" },
                        { defaultMessage: "Failed to load Income & Expense Account report." }
                    )
                );
            }
        } catch (err) {
            console.error("Error loading Income & Expense Account:", err);
            setError(
                handleApiError(err, {
                    defaultMessage:
                        "Failed to load Income & Expense Account report. Please try again.",
                })
            );
        } finally {
            setReportLoading((prev) => ({ ...prev, incomeExpense: false }));
        }
    };

    const loadBalanceSheet = async () => {
        if (!ensureGroupSelected()) return;

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

            if (response?.success) {
                setBalanceSheetData(response.data);
            } else {
                setError(
                    handleApiError(
                        { message: response?.message || "Failed to load report" },
                        { defaultMessage: "Failed to load Balance Sheet report." }
                    )
                );
            }
        } catch (err) {
            console.error("Error loading Balance Sheet:", err);
            setError(
                handleApiError(err, {
                    defaultMessage: "Failed to load Balance Sheet report. Please try again.",
                })
            );
        } finally {
            setReportLoading((prev) => ({ ...prev, balanceSheet: false }));
        }
    };

    const handleLoadReport = () => {
        setError(null);
        if (activeTab === "receipt-payment") loadReceiptPaymentAccount();
        if (activeTab === "income-expense") loadIncomeExpenseAccount();
        if (activeTab === "balance-sheet") loadBalanceSheet();
    };

    const handleDismissError = () => setError(null);
    const handleRetry = () => handleLoadReport();

    // ----------------------------
    // Auto-load on tab/group changes
    // ----------------------------
    useEffect(() => {
        if (!selectedGroup?.id) return;

        if (activeTab === "receipt-payment" && receiptPaymentData === null) {
            loadReceiptPaymentAccount();
        } else if (activeTab === "income-expense" && incomeExpenseData === null) {
            loadIncomeExpenseAccount();
        } else if (activeTab === "balance-sheet" && asOnDate && balanceSheetData === null) {
            loadBalanceSheet();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, selectedGroup?.id]);

    // Reload when date range changes (only for receipt/income tabs)
    useEffect(() => {
        if (!selectedGroup?.id) return;
        if (activeTab === "receipt-payment") loadReceiptPaymentAccount();
        if (activeTab === "income-expense") loadIncomeExpenseAccount();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fromDate, toDate]);

    // Reload when asOnDate changes (only for balance tab)
    useEffect(() => {
        if (!selectedGroup?.id) return;
        if (activeTab === "balance-sheet" && asOnDate) loadBalanceSheet();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [asOnDate]);

    // ----------------------------
    // UI Helpers (responsive)
    // ----------------------------
    const isAnyReportLoading =
        reportLoading.receiptPayment || reportLoading.incomeExpense || reportLoading.balanceSheet;

    // ✅ Mobile-first tab (scrollable pills on phone)
    const TabPill = ({ id, label, shortLabel }) => {
        const active = activeTab === id;
        return (
            <button
                onClick={() => setActiveTab(id)}
                title={label}
                type="button"
                className={[
                    "snap-start shrink-0",
                    "px-3 py-2 min-h-[44px]",
                    "rounded-lg border text-sm font-semibold",
                    "transition touch-manipulation whitespace-nowrap",
                    active
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 active:bg-gray-100",
                ].join(" ")}
            >
                <span className="sm:hidden">{shortLabel ?? label}</span>
                <span className="hidden sm:inline">{label}</span>
            </button>
        );
    };

    // ----------------------------
    // CLUSTER/GROUP selection screen
    // ----------------------------
    if (!selectedGroup) {
        return (
            <div className="w-full min-w-0 overflow-x-clip">
                <div className="mx-auto w-full max-w-7xl px-2 sm:px-4 lg:px-6 pb-4 sm:pb-6">
                    {/* Header */}
                    <div className="mb-3 sm:mb-6">
                        <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-gray-800 flex items-center gap-2 sm:gap-3">
                            <FileText className="shrink-0 w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8" />
                            <span className="leading-tight">Financial Reports</span>
                        </h1>
                        <p className="text-xs sm:text-sm md:text-base text-gray-600 mt-1 sm:mt-2">
                            Select a group to view financial reports
                        </p>
                    </div>

                    {/* Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 md:p-6">
                        {/* Top row */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
                            <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 flex items-center gap-2 min-w-0">
                                <Building2 size={22} className="text-blue-600 shrink-0" />
                                <span className="leading-tight truncate">
                                    {selectedCluster
                                        ? `Groups in ${selectedCluster.name || "Cluster"}`
                                        : "Select Cluster"}
                                </span>
                            </h2>

                            {selectedCluster && (
                                <button
                                    onClick={() => {
                                        setSelectedCluster(null);
                                        setSelectedGroup(null);
                                    }}
                                    className="text-sm text-blue-600 hover:text-blue-800 font-medium w-full sm:w-auto self-start sm:self-auto py-1 min-h-[44px]"
                                    type="button"
                                >
                                    ← Back to Clusters
                                </button>
                            )}
                        </div>

                        {/* Body */}
                        {groupsLoading ? (
                            <div className="py-8">
                                <Loader loading={true} message="Loading groups..." />
                            </div>
                        ) : error && error.shouldShow ? (
                            <div className="mb-4">
                                <ErrorMessage error={error} onDismiss={handleDismissError} onRetry={handleRetry} />
                            </div>
                        ) : (
                            <>
                                {/* Responsive Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
                                    {!selectedCluster ? (
                                        <>
                                            {clusterList.length > 0 ? (
                                                clusterList.map((cluster) => {
                                                    const clusterGroups = groups.filter(
                                                        (g) =>
                                                            (g.cluster_name || "") === cluster.name &&
                                                            (g.cluster_code || "") === cluster.code
                                                    );

                                                    const displayName =
                                                        cluster.name || cluster.code ? cluster.name || "No Name" : "Unassigned";

                                                    const displayCode = cluster.code || (cluster.name ? "" : "No Code");

                                                    return (
                                                        <button
                                                            key={`${cluster.name}|${cluster.code}`}
                                                            type="button"
                                                            onClick={() =>
                                                                setSelectedCluster({
                                                                    name: cluster.name || "",
                                                                    code: cluster.code || "",
                                                                })
                                                            }
                                                            className={[
                                                                "text-left w-full p-3 sm:p-4 md:p-5 rounded-xl border-2 transition touch-manipulation",
                                                                "border-gray-200 hover:border-blue-500 hover:bg-blue-50 active:bg-blue-100",
                                                                "focus:outline-none focus:ring-2 focus:ring-blue-400",
                                                            ].join(" ")}
                                                        >
                                                            <div className="flex items-start gap-2 sm:gap-3">
                                                                <LayoutGrid className="text-blue-600 shrink-0 mt-0.5 w-6 h-6 sm:w-7 sm:h-7" />
                                                                <div className="min-w-0">
                                                                    <p className="font-semibold text-gray-800 text-base sm:text-lg truncate">
                                                                        {displayName}
                                                                    </p>
                                                                    <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
                                                                        Code: {displayCode || "-"}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <div className="mt-3 text-xs sm:text-sm text-gray-600">
                                                                <p>Groups: {clusterGroups.length}</p>
                                                            </div>
                                                        </button>
                                                    );
                                                })
                                            ) : (
                                                <div className="col-span-full text-center py-8 sm:py-10 text-gray-500 text-sm sm:text-base">
                                                    <p>No clusters found.</p>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            {filteredGroups.length > 0 ? (
                                                filteredGroups.map((g) => (
                                                    <button
                                                        key={g.id}
                                                        type="button"
                                                        onClick={() => setSelectedGroup(g)}
                                                        className={[
                                                            "text-left w-full p-3 sm:p-4 md:p-5 rounded-xl border-2 transition touch-manipulation",
                                                            "border-gray-200 hover:border-blue-500 hover:bg-blue-50 active:bg-blue-100",
                                                            "focus:outline-none focus:ring-2 focus:ring-blue-400",
                                                        ].join(" ")}
                                                    >
                                                        <div className="flex items-start gap-2 sm:gap-3">
                                                            <Building2 className="text-blue-600 shrink-0 mt-0.5 w-6 h-6 sm:w-7 sm:h-7" />
                                                            <div className="min-w-0">
                                                                <p className="font-semibold text-gray-800 text-base sm:text-lg truncate">
                                                                    {g.name}
                                                                </p>
                                                                <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
                                                                    Code: {g.code}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="mt-3 text-xs sm:text-sm text-gray-600">
                                                            <p className="truncate">Village: {g.village || "-"}</p>
                                                        </div>
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="col-span-full text-center py-8 sm:py-10 text-gray-500 text-sm sm:text-base">
                                                    <p>No groups found in this cluster.</p>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ----------------------------
    // REPORT screen
    // ----------------------------
    return (
        <div className="w-full min-w-0 overflow-x-clip">
            <div className="mx-auto w-full max-w-7xl px-2 sm:px-4 lg:px-6 pb-4 sm:pb-6">
                {/* Top bar */}
                <div className="mb-4 sm:mb-6">
                    <button
                        onClick={() => {
                            setSelectedGroup(null);
                            setReceiptPaymentData(null);
                            setIncomeExpenseData(null);
                            setBalanceSheetData(null);
                            setError(null);
                        }}
                        className="text-blue-600 hover:text-blue-800 mb-1 sm:mb-2 flex items-center gap-2 text-sm w-full sm:w-auto min-h-[44px]"
                        type="button"
                    >
                        ← Back to Groups
                    </button>

                    <div className="flex flex-col gap-1 sm:gap-2 min-w-0">
                        <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-gray-800 flex flex-wrap items-center gap-2 sm:gap-3">
                            <FileText className="shrink-0 w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8" />
                            <span className="leading-tight min-w-0">
                                <span className="text-gray-700">Financial Reports</span>
                                <span className="text-gray-400 mx-1 sm:mx-2">–</span>
                                <span className="text-gray-900 truncate">{selectedGroup.name}</span>
                            </span>
                        </h1>
                    </div>
                </div>

                {/* ✅ Tabs (mobile scroll) */}
                <div data-debug="fr-tabs" className="bg-white rounded-xl shadow-sm border border-gray-100 mb-3 sm:mb-6 overflow-hidden">
                    <div className="border-b border-gray-200">
                        <div className="flex gap-2 p-2 overflow-x-auto overscroll-x-contain snap-x snap-mandatory">
                            <TabPill id="receipt-payment" label="Receipt & Payment Account" shortLabel="Receipt & Payment" />
                            <TabPill id="income-expense" label="Income & Expense Account" shortLabel="Income & Expense" />
                            <TabPill id="balance-sheet" label="Balance Sheet" shortLabel="Balance Sheet" />
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 md:p-6 mb-4 sm:mb-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                        {activeTab === "receipt-payment" || activeTab === "income-expense" ? (
                            <>
                                <div className="min-w-0">
                                    <label className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                                        <Calendar size={14} className="sm:w-4 sm:h-4 shrink-0" />
                                        From Date
                                    </label>
                                    <input
                                        type="date"
                                        value={fromDate}
                                        onChange={(e) => setFromDate(e.target.value)}
                                        className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                    />
                                </div>

                                <div className="min-w-0">
                                    <label className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                                        <Calendar size={14} className="sm:w-4 sm:h-4 shrink-0" />
                                        To Date
                                    </label>
                                    <input
                                        type="date"
                                        value={toDate}
                                        onChange={(e) => setToDate(e.target.value)}
                                        className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                    />
                                </div>

                                <div className="flex items-end sm:col-span-2 md:col-span-1">
                                    <button
                                        onClick={handleLoadReport}
                                        disabled={isAnyReportLoading}
                                        type="button"
                                        className="w-full min-h-[44px] px-4 py-2.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm touch-manipulation"
                                    >
                                        {isAnyReportLoading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                                                Loading...
                                            </>
                                        ) : (
                                            "Load Report"
                                        )}
                                    </button>
                                </div>

                                <div className="sm:col-span-2 md:col-span-3 text-xs sm:text-sm text-gray-600">
                                    <p>
                                        Leave date fields empty to view all time data. Select dates to filter by range.
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="min-w-0">
                                    <label className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                                        <Calendar size={14} className="sm:w-4 sm:h-4 shrink-0" />
                                        As On Date
                                    </label>
                                    <input
                                        type="date"
                                        value={asOnDate}
                                        onChange={(e) => setAsOnDate(e.target.value)}
                                        className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                    />
                                </div>

                                <div className="flex items-end">
                                    <button
                                        onClick={handleLoadReport}
                                        disabled={reportLoading.balanceSheet || !asOnDate}
                                        type="button"
                                        className="w-full min-h-[44px] px-4 py-2.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm touch-manipulation"
                                    >
                                        {reportLoading.balanceSheet ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
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

                {/* Error */}
                {error && error.shouldShow && (
                    <div className="mb-4 sm:mb-6">
                        <ErrorMessage error={error} onDismiss={handleDismissError} onRetry={handleRetry} />
                    </div>
                )}

                {/* ✅ Report Content (IMPORTANT: page never scrolls horizontally; only table area can) */}
                <div data-debug="fr-report" className="relative w-full min-w-0 overflow-x-hidden">
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
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 md:p-6 w-full min-w-0">
                        {/* ✅ Only inner content scrolls on X if tables are wide */}
                        <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain">
                            {/* ✅ Ensure tables have minimum width on phone so user can scroll inside */}
                            <div className="min-w-[720px] sm:min-w-0">
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
                    </div>
                </div>
            </div>
        </div>
    );
}
