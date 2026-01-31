import React, { useEffect, useMemo, useState } from "react";
import {
    DollarSign,
    Download,
    FileText,
    Search,
    Plus,
    Eye,
    Wifi,
    WifiOff,
    Filter,
} from "lucide-react";
import { Link } from "react-router-dom";
import { exportLoanToExcel, exportLoanToPDF } from "../../utils/exportUtils";
import { useGroup } from "../../contexts/GroupContext";
import { useOffline } from "../../contexts/OfflineContext";
import { getAllApprovals, getUnsyncedApprovals, syncPendingLoanApprovals } from "../../services/approvalDB";
import { getLoans as getLoansOffline } from "../../services/loanServiceOffline";
import { getLoans as getLoansOnline } from "../../services/loanService";

export default function LoanManagement() {
    const { currentGroup, isOnline } = useGroup();
    const { lastRefreshedAt } = useOffline();

    const [loans, setLoans] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all"); // all|pending|approved|rejected (same as admin)
    const [pendingCount, setPendingCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Mobile filter panel toggle
    const [showMobileFilters, setShowMobileFilters] = useState(false);

    useEffect(() => {
        loadLoans();
        if (currentGroup) loadPendingCount();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentGroup?.id, lastRefreshedAt, isOnline]);

    useEffect(() => {
        if (isOnline) syncPendingApprovals();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOnline]);

    const loadLoans = async () => {
        if (!currentGroup?.id) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError("");

            // When online, fetch from backend so status (approved/rejected) is correct; when offline use local repository
            let response;
            if (isOnline) {
                try {
                    response = await getLoansOnline(currentGroup.id);
                } catch (apiErr) {
                    console.warn("Backend getLoans failed, using offline data:", apiErr?.message);
                    response = await getLoansOffline(currentGroup.id);
                }
            } else {
                response = await getLoansOffline(currentGroup.id);
            }

            if (response?.success && response?.data) {
                const transformed = Array.isArray(response.data)
                    ? response.data.map((loan) => ({
                        id: loan._id || loan.id,
                        memberCode: loan.memberCode || loan.member_code || "",
                        memberName: loan.memberName || loan.member_name || "",
                        hasAssets: loan.hasAssets || false,
                        transactionType: loan.transactionType || loan.transaction_type || "Loan",
                        paymentMode: loan.paymentMode || loan.payment_mode || "Cash",
                        purpose: loan.purpose || "",
                        amount: Number(loan.amount || 0),
                        date:
                            loan.date ||
                            loan.createdAt ||
                            new Date().toISOString().split("T")[0],
                        status: loan.status || loan.approvalStatus || "pending",
                    }))
                    : [];
                setLoans(transformed);
            } else {
                setLoans([]);
            }
        } catch (err) {
            console.error("Error loading loans:", err);
            setError(err?.message || "Failed to load loans");
            setLoans([]);
        } finally {
            setLoading(false);
        }
    };

    const loadPendingCount = async () => {
        if (!currentGroup?.id) return;
        try {
            const approvals = await getAllApprovals(currentGroup.id);
            const pending = (approvals || []).filter(
                (a) => a?.status === "pending" && a?.type === "loan"
            );
            setPendingCount(pending.length);
        } catch (e) {
            console.error("Error loading pending count:", e);
        }
    };

    const syncPendingApprovals = async () => {
        try {
            // Sync pending loan approvals to repository (so they get added to sync_queue)
            await syncPendingLoanApprovals();
            await getUnsyncedApprovals();
        } catch (e) {
            console.error("Error syncing approvals:", e);
        }
    };

    const filteredLoans = useMemo(() => {
        const searchLower = searchTerm.trim().toLowerCase();

        return (loans || []).filter((loan) => {
            const statusOk = statusFilter === "all" || (loan.status || "pending") === statusFilter;
            if (!statusOk) return false;

            const memberName = (loan.memberName || "").toLowerCase();
            const memberCode = (loan.memberCode || "").toLowerCase();
            const purpose = (loan.purpose || "").toLowerCase();

            const matchSearch =
                searchLower === "" ||
                memberName.includes(searchLower) ||
                memberCode.includes(searchLower) ||
                purpose.includes(searchLower);

            const txType = (loan.transactionType || "").toLowerCase();
            const matchFilter =
                filterType === "all" ||
                (filterType === "withAssets" && !!loan.hasAssets) ||
                (filterType === "withoutAssets" && !loan.hasAssets) ||
                txType === filterType.toLowerCase();

            return matchSearch && matchFilter;
        });
    }, [loans, searchTerm, filterType, statusFilter]);

    const totalAmount = useMemo(() => {
        return filteredLoans.reduce((sum, loan) => sum + Number(loan.amount || 0), 0);
    }, [filteredLoans]);

    const withAssetsCount = useMemo(() => {
        return filteredLoans.filter((l) => !!l.hasAssets).length;
    }, [filteredLoans]);

    const handleExportExcel = () => {
        exportLoanToExcel(filteredLoans, currentGroup?.name || "Group_Loans");
    };

    const handleExportPDF = () => {
        exportLoanToPDF(filteredLoans, currentGroup?.name || "Group_Loans");
    };

    if (!currentGroup && !loading) {
        return (
            <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-6">
                <div className="flex items-center justify-center min-h-[300px]">
                    <div className="text-gray-600 text-sm sm:text-base">
                        Loading group information...
                    </div>
                </div>
            </div>
        );
    }

    // Small reusable UI pieces
    const SummaryCard = ({ title, value }) => (
        <div className="p-4 sm:p-5 rounded-xl border bg-white shadow-sm">
            <p className="text-xs sm:text-sm text-gray-600">{title}</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">{value}</p>
        </div>
    );

    const FiltersBlock = ({ compact = false }) => (
        <div className={`${compact ? "" : "bg-white rounded-xl border shadow-sm"} p-4 sm:p-5`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search member, code, purpose..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                </div>

                {/* Status filter (same as admin panel) */}
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                </select>

                {/* Filter */}
                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                >
                    <option value="all">All Transactions</option>
                    <option value="withAssets">With Assets</option>
                    <option value="withoutAssets">Without Assets</option>
                    <option value="loan">Loan</option>
                    <option value="saving">Saving</option>
                    <option value="fd">FD</option>
                    <option value="deposit">Deposit</option>
                    <option value="expense">Expense</option>
                </select>

                {/* Exports */}
                <div className="flex flex-col sm:flex-row gap-2">
                    <button
                        onClick={handleExportExcel}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
                    >
                        <Download size={18} />
                        Export Excel
                    </button>
                    <button
                        onClick={handleExportPDF}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm"
                    >
                        <FileText size={18} />
                        Export PDF
                    </button>
                </div>
            </div>

            {!compact && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-4">
                    <SummaryCard title="Total Transactions" value={filteredLoans.length} />
                    <SummaryCard title="Total Amount" value={`₹${totalAmount.toLocaleString()}`} />
                    <SummaryCard title="With Assets" value={withAssetsCount} />
                </div>
            )}
        </div>
    );

    return (
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-5 sm:py-6">
            {/* Header */}
            <div className="mb-4 sm:mb-6">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 sm:gap-4">
                    <div className="min-w-0">
                        <div className="flex items-start sm:items-center gap-3">
                            <div className="shrink-0 mt-0.5 sm:mt-0">
                                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                                    <DollarSign className="text-blue-700" size={22} />
                                </div>
                            </div>

                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">
                                        Loan Management
                                    </h1>
                                    {isOnline ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                                            <Wifi size={14} />
                                            Online
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                                            <WifiOff size={14} />
                                            Offline
                                        </span>
                                    )}
                                </div>

                                <p className="text-xs sm:text-sm text-gray-600 mt-1 break-words">
                                    Manage loan transactions for{" "}
                                    <span className="font-semibold text-gray-800">
                                        {currentGroup?.name || "Group"}
                                    </span>
                                </p>

                                {pendingCount > 0 && (
                                    <p className="text-orange-600 text-xs sm:text-sm mt-1">
                                        {pendingCount} loan transaction(s) pending approval
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 lg:justify-end">
                        {/* Mobile filters toggle */}
                        <button
                            type="button"
                            onClick={() => setShowMobileFilters((s) => !s)}
                            className="lg:hidden inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 text-sm font-semibold"
                        >
                            <Filter size={18} />
                            {showMobileFilters ? "Hide Filters" : "Show Filters"}
                        </button>

                        <Link
                            to="/group/loan-taking"
                            className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm"
                        >
                            <Plus size={18} />
                            Add Loan Transaction
                        </Link>
                    </div>
                </div>
            </div>

            {/* Alerts */}
            {error && (
                <div className="mb-4 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-700 text-sm">{error}</p>
                </div>
            )}

            {loading && (
                <div className="mb-4 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                    <p className="text-blue-700 text-sm sm:text-base">Loading loans...</p>
                </div>
            )}

            {/* Mobile filters panel */}
            <div className={`lg:hidden ${showMobileFilters ? "block" : "hidden"} mb-4`}>
                <FiltersBlock compact />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-3">
                    <SummaryCard title="Total Transactions" value={filteredLoans.length} />
                    <SummaryCard title="Total Amount" value={`₹${totalAmount.toLocaleString()}`} />
                    <SummaryCard title="With Assets" value={withAssetsCount} />
                </div>
            </div>

            {/* Desktop filters */}
            <div className="hidden lg:block mb-6">
                <FiltersBlock />
            </div>

            {/* CONTENT: Responsive list on mobile, table on md+ */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                {/* Mobile/Small: Cards */}
                <div className="block md:hidden">
                    {filteredLoans.length > 0 ? (
                        <div className="divide-y">
                            {filteredLoans.map((loan) => {
                                const isGroupExpense = !loan.memberName && !loan.memberCode;
                                const status = loan.status || "pending";
                                const statusCls =
                                    status === "pending"
                                        ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                        : status === "approved"
                                            ? "bg-green-50 text-green-700 border-green-200"
                                            : "bg-red-50 text-red-700 border-red-200";
                                return (
                                    <div key={loan.id} className="p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className={`px-2 py-1 rounded-full text-[11px] font-semibold border ${statusCls}`}>
                                                        {status}
                                                    </span>
                                                    <p className="text-sm font-semibold text-gray-800">
                                                        {loan.purpose || "—"}
                                                    </p>
                                                </div>
                                                <p className="text-xs text-gray-600 mt-1">
                                                    Date: <span className="font-medium">{loan.date}</span>
                                                </p>

                                                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                                    <div className="p-2 rounded-lg bg-gray-50 border">
                                                        <p className="text-gray-500">Member</p>
                                                        <p className="font-semibold text-gray-800 truncate">
                                                            {isGroupExpense ? "Group Expense" : loan.memberName || "—"}
                                                        </p>
                                                        {!isGroupExpense && (
                                                            <p className="text-gray-600 truncate">{loan.memberCode}</p>
                                                        )}
                                                    </div>

                                                    <div className="p-2 rounded-lg bg-gray-50 border">
                                                        <p className="text-gray-500">Amount</p>
                                                        <p className="font-bold text-gray-800">
                                                            ₹{Number(loan.amount || 0).toLocaleString()}
                                                        </p>
                                                    </div>

                                                    <div className="p-2 rounded-lg bg-gray-50 border">
                                                        <p className="text-gray-500">Type</p>
                                                        <p className="font-semibold text-gray-800">{loan.transactionType}</p>
                                                    </div>

                                                    <div className="p-2 rounded-lg bg-gray-50 border">
                                                        <p className="text-gray-500">Payment</p>
                                                        <p className="font-semibold text-gray-800">{loan.paymentMode}</p>
                                                    </div>

                                                    <div className="p-2 rounded-lg bg-gray-50 border col-span-2 flex items-center justify-between">
                                                        <div className="min-w-0">
                                                            <p className="text-gray-500">Assets</p>
                                                            <span
                                                                className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold border ${loan.hasAssets
                                                                    ? "bg-green-50 text-green-700 border-green-200"
                                                                    : "bg-red-50 text-red-700 border-red-200"
                                                                    }`}
                                                            >
                                                                {loan.hasAssets ? "Yes" : "No"}
                                                            </span>
                                                        </div>

                                                        <button
                                                            type="button"
                                                            className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-blue-600"
                                                            title="View"
                                                            onClick={() => {
                                                                // keep as placeholder; wire to your modal/route
                                                            }}
                                                        >
                                                            <Eye size={18} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="p-10 text-center text-gray-500 text-sm">No loans found</div>
                    )}

                    {filteredLoans.length > 0 && (
                        <div className="p-4 border-t bg-gray-50">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-gray-700">Total</span>
                                <span className="text-sm font-bold text-gray-900">
                                    ₹{totalAmount.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Tablet/Desktop: Table */}
                <div className="hidden md:block">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse min-w-[980px]">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="border-b p-3 text-left font-semibold text-gray-700 text-sm">Status</th>
                                    <th className="border-b p-3 text-left font-semibold text-gray-700 text-sm">Date</th>
                                    <th className="border-b p-3 text-left font-semibold text-gray-700 text-sm">Member Code</th>
                                    <th className="border-b p-3 text-left font-semibold text-gray-700 text-sm">Member Name</th>
                                    <th className="border-b p-3 text-center font-semibold text-gray-700 text-sm">Has Assets</th>
                                    <th className="border-b p-3 text-left font-semibold text-gray-700 text-sm">Transaction Type</th>
                                    <th className="border-b p-3 text-left font-semibold text-gray-700 text-sm">Payment Mode</th>
                                    <th className="border-b p-3 text-left font-semibold text-gray-700 text-sm">Purpose</th>
                                    <th className="border-b p-3 text-right font-semibold text-gray-700 text-sm">Amount</th>
                                    <th className="border-b p-3 text-center font-semibold text-gray-700 text-sm">Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                {filteredLoans.length > 0 ? (
                                    filteredLoans.map((loan) => {
                                        const status = loan.status || "pending";
                                        const statusCls =
                                            status === "pending"
                                                ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                                : status === "approved"
                                                    ? "bg-green-50 text-green-700 border-green-200"
                                                    : "bg-red-50 text-red-700 border-red-200";
                                        return (
                                            <tr key={loan.id} className="hover:bg-gray-50">
                                                <td className="border-b p-3">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${statusCls}`}>
                                                        {status}
                                                    </span>
                                                </td>
                                                <td className="border-b p-3 text-gray-800 text-sm whitespace-nowrap">
                                                    {loan.date}
                                                </td>
                                                <td className="border-b p-3 text-gray-800 text-sm">
                                                    {loan.memberCode ? (
                                                        loan.memberCode
                                                    ) : (
                                                        <span className="text-gray-400 italic">Group Expense</span>
                                                    )}
                                                </td>
                                                <td className="border-b p-3 text-gray-800 text-sm">
                                                    {loan.memberName ? (
                                                        loan.memberName
                                                    ) : (
                                                        <span className="text-gray-400 italic">Group Expense</span>
                                                    )}
                                                </td>
                                                <td className="border-b p-3 text-center">
                                                    <span
                                                        className={`px-2 py-1 rounded-full text-xs font-semibold border ${loan.hasAssets
                                                            ? "bg-green-50 text-green-700 border-green-200"
                                                            : "bg-red-50 text-red-700 border-red-200"
                                                            }`}
                                                    >
                                                        {loan.hasAssets ? "Yes" : "No"}
                                                    </span>
                                                </td>
                                                <td className="border-b p-3 text-gray-800 text-sm">{loan.transactionType}</td>
                                                <td className="border-b p-3 text-gray-800 text-sm">{loan.paymentMode}</td>
                                                <td className="border-b p-3 text-gray-800 text-sm max-w-[320px] truncate">
                                                    {loan.purpose || "—"}
                                                </td>
                                                <td className="border-b p-3 text-right font-semibold text-gray-900 text-sm whitespace-nowrap">
                                                    ₹{Number(loan.amount || 0).toLocaleString()}
                                                </td>
                                                <td className="border-b p-3 text-center">
                                                    <button
                                                        type="button"
                                                        className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-blue-600"
                                                        title="View"
                                                        onClick={() => {
                                                        }}
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={10} className="p-10 text-center text-gray-500 text-sm">
                                            No loans found
                                        </td>
                                    </tr>
                                )}
                            </tbody>

                            {filteredLoans.length > 0 && (
                                <tfoot>
                                    <tr className="bg-gray-50 font-semibold">
                                        <td colSpan={8} className="border-t p-3 text-right text-gray-800 text-sm">
                                            Total:
                                        </td>
                                        <td className="border-t p-3 text-right text-gray-900 text-sm whitespace-nowrap">
                                            ₹{totalAmount.toLocaleString()}
                                        </td>
                                        <td className="border-t p-3" />
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
