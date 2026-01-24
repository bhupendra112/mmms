import React, { useEffect, useMemo, useState } from "react";
import {
    Building2,
    DollarSign,
    Download,
    Plus,
    Search,
    Wifi,
    WifiOff,
    Filter,
    ArrowLeft,
} from "lucide-react";
import { Link } from "react-router-dom";
import { getGroups } from "../../services/groupService";
import { getLoans } from "../../services/loanService";
import { exportLoanToExcel, exportLoanToPDF } from "../../utils/exportUtils";

export default function AdminLoanManagement() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    const [groups, setGroupsState] = useState([]);
    const [groupsLoading, setGroupsLoading] = useState(false);

    const [selectedGroup, setSelectedGroup] = useState(null); // {id,name,code,village,...}
    const [selectedClusterKey, setSelectedClusterKey] = useState("");

    const [loans, setLoans] = useState([]);
    const [loading, setLoading] = useState(false);

    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all"); // all|pending|approved|rejected

    // mobile UI toggles
    const [showMobileFilters, setShowMobileFilters] = useState(false);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    useEffect(() => {
        setGroupsLoading(true);
        getGroups()
            .then((res) => {
                const list = Array.isArray(res?.data) ? res.data : [];
                setGroupsState(
                    list.map((g) => ({
                        id: g._id,
                        name: g.group_name,
                        code: g.group_code,
                        village: g.village,
                        memberCount: g.memberCount ?? g.no_members ?? 0,
                        clusterName: g.cluster_name || "",
                        clusterCode: g.cluster_code || "",
                    }))
                );
            })
            .catch((e) => {
                console.error("Failed to load groups:", e);
                setGroupsState([]);
            })
            .finally(() => setGroupsLoading(false));
    }, []);

    const loadLoans = async (groupId) => {
        if (!groupId) return;
        try {
            setLoading(true);
            const response = await getLoans(groupId);
            const loansList = Array.isArray(response?.data) ? response.data : [];
            setLoans(loansList);
        } catch (e) {
            console.error("Failed to load loans:", e);
            setLoans([]);
        } finally {
            setLoading(false);
        }
    };

    const clusterOptions = useMemo(() => {
        const uniqueClusters = Array.from(
            new Set(groups.map((g) => `${g.clusterName}|${g.clusterCode}`))
        );
        return uniqueClusters
            .filter((k) => k !== "|") // avoid pure empty
            .map((key) => {
                const [name, code] = key.split("|");
                return { value: key, label: `${name || "No Name"} (${code || "No Code"})` };
            });
    }, [groups]);

    const filteredGroups = useMemo(() => {
        if (!selectedClusterKey) return [];
        const [cName, cCode] = selectedClusterKey.split("|");
        return groups.filter((g) => g.clusterName === cName && g.clusterCode === cCode);
    }, [groups, selectedClusterKey]);

    const filteredLoans = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();

        return (loans || []).filter((loan) => {
            const statusOk = statusFilter === "all" || loan.status === statusFilter;
            if (!statusOk) return false;

            if (!q) return true;

            const memberName = String(loan.memberName || "").toLowerCase();
            const memberCode = String(loan.memberCode || "").toLowerCase();
            const purpose = String(loan.purpose || "").toLowerCase();
            const txType = String(loan.transactionType || "").toLowerCase();
            const groupLoan = loan.isGroupLoan ? "group" : "";

            return (
                memberName.includes(q) ||
                memberCode.includes(q) ||
                purpose.includes(q) ||
                txType.includes(q) ||
                groupLoan.includes(q)
            );
        });
    }, [loans, searchTerm, statusFilter]);

    const exportRows = useMemo(() => {
        return filteredLoans.map((loan) => ({
            Status: loan.status,
            "Member Code": loan.memberCode || "-",
            "Member Name": loan.memberName || (loan.isGroupLoan ? "Group Loan" : "-"),
            "Transaction Type": loan.transactionType || "-",
            "Payment Mode": loan.paymentMode || "-",
            Purpose: loan.purpose || "-",
            Amount: loan.amount ?? "-",
            Date: loan.date
                ? new Date(loan.date).toLocaleDateString("en-GB")
                : loan.createdAt
                    ? new Date(loan.createdAt).toLocaleDateString("en-GB")
                    : "-",
        }));
    }, [filteredLoans]);

    const totalAmount = useMemo(() => {
        return filteredLoans.reduce((sum, loan) => sum + Number(loan.amount || 0), 0);
    }, [filteredLoans]);

    const SummaryCard = ({ title, value }) => (
        <div className="p-4 sm:p-5 rounded-xl border bg-white shadow-sm">
            <p className="text-xs sm:text-sm text-gray-600">{title}</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">{value}</p>
        </div>
    );

    // ============ SCREEN 1: SELECT GROUP ============
    if (!selectedGroup) {
        return (
            <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-5 sm:py-6">
                {/* Header */}
                <div className="mb-4 sm:mb-6">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                                    <DollarSign className="text-blue-700" size={22} />
                                </div>

                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">
                                            Loan Management (Admin)
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

                                    <p className="text-xs sm:text-sm text-gray-600 mt-1">
                                        Select a cluster, then choose a group to view loan transactions.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Select Group Card */}
                <div className="bg-white rounded-xl border shadow-sm p-4 sm:p-6">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <h2 className="text-base sm:text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <Building2 size={20} className="text-blue-600" />
                            Select Group
                        </h2>

                        {/* Mobile: quick cluster count */}
                        <span className="text-xs sm:text-sm text-gray-500">
                            Clusters: {clusterOptions.length}
                        </span>
                    </div>

                    {/* Cluster select */}
                    <div className="mb-4">
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                            Cluster
                        </label>
                        <select
                            value={selectedClusterKey}
                            onChange={(e) => {
                                setSelectedClusterKey(e.target.value);
                                setSelectedGroup(null);
                                setLoans([]);
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Select Cluster</option>
                            {clusterOptions.map((c) => (
                                <option key={c.value} value={c.value}>
                                    {c.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Groups */}
                    {groupsLoading ? (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                            <p className="text-blue-700 text-sm sm:text-base">Loading groups…</p>
                        </div>
                    ) : (
                        <>
                            {!selectedClusterKey && (
                                <div className="p-8 text-center text-gray-500 text-sm">
                                    Please select a cluster to view groups.
                                </div>
                            )}

                            {selectedClusterKey && filteredGroups.length === 0 && (
                                <div className="p-8 text-center text-gray-500 text-sm">
                                    No groups found in this cluster.
                                </div>
                            )}

                            {selectedClusterKey && filteredGroups.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                    {filteredGroups.map((g) => (
                                        <button
                                            type="button"
                                            key={g.id}
                                            onClick={() => {
                                                setSelectedGroup(g);
                                                loadLoans(g.id);
                                            }}
                                            className="text-left p-4 sm:p-5 border rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-white border border-blue-100 flex items-center justify-center shrink-0">
                                                    <Building2 className="text-blue-600" size={20} />
                                                </div>

                                                <div className="min-w-0">
                                                    <p className="font-semibold text-gray-800 text-base sm:text-lg truncate">
                                                        {g.name}
                                                    </p>
                                                    <p className="text-xs sm:text-sm text-gray-600">
                                                        Code: <span className="font-medium">{g.code}</span>
                                                    </p>

                                                    <div className="mt-2 text-xs sm:text-sm text-gray-600 space-y-0.5">
                                                        <p className="truncate">Village: {g.village || "-"}</p>
                                                        <p>Members: {g.memberCount}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    }

    // ============ SCREEN 2: LOANS LIST ============
    return (
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-5 sm:py-6">
            {/* Header */}
            <div className="mb-4 sm:mb-6">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 sm:gap-4">
                    <div className="min-w-0">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                                <DollarSign className="text-blue-700" size={22} />
                            </div>

                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">
                                        Loan Management (Admin)
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
                                    Group:{" "}
                                    <span className="font-semibold text-gray-800">{selectedGroup.name}</span>{" "}
                                    <span className="text-gray-500">({selectedGroup.code})</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 lg:justify-end">
                        <button
                            type="button"
                            onClick={() => setShowMobileFilters((s) => !s)}
                            className="lg:hidden inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 text-sm font-semibold"
                        >
                            <Filter size={18} />
                            {showMobileFilters ? "Hide Filters" : "Show Filters"}
                        </button>

                        <Link
                            to={`/admin/loan-taking?groupId=${selectedGroup.id}`}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm"
                        >
                            <Plus size={18} />
                            Take New Loan
                        </Link>

                        <button
                            type="button"
                            onClick={() => {
                                setSelectedGroup(null);
                                setLoans([]);
                                setSearchTerm("");
                                setStatusFilter("all");
                                setSelectedClusterKey("");
                                setShowMobileFilters(false);
                            }}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-semibold text-sm"
                        >
                            <ArrowLeft size={18} />
                            Change Group
                        </button>
                    </div>
                </div>
            </div>

            {/* Filters + Export */}
            <div className="mb-4 sm:mb-6">
                {/* Mobile filters block */}
                <div className={`lg:hidden ${showMobileFilters ? "block" : "hidden"}`}>
                    <div className="bg-white rounded-xl border shadow-sm p-4 sm:p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search member, purpose, type..."
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                            </div>

                            <select
                                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="all">All Status</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4">
                            <button
                                onClick={() => exportLoanToExcel(exportRows, `${selectedGroup.name}_Loans`)}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold"
                            >
                                <Download size={16} />
                                Export Excel
                            </button>
                            <button
                                onClick={() => exportLoanToPDF(exportRows, `${selectedGroup.name}_Loans`)}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-semibold"
                            >
                                <Download size={16} />
                                Export PDF
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                            <SummaryCard title="Requests" value={filteredLoans.length} />
                            <SummaryCard title="Total Amount" value={`₹${totalAmount.toLocaleString()}`} />
                            <SummaryCard title="Status" value={statusFilter === "all" ? "All" : statusFilter} />
                        </div>
                    </div>
                </div>

                {/* Desktop filters block */}
                <div className="hidden lg:block">
                    <div className="bg-white rounded-xl border shadow-sm p-5">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="lg:col-span-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Search member code/name, purpose, transaction type..."
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                    />
                                </div>
                            </div>

                            <select
                                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="all">All Status</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>

                        <div className="flex justify-end gap-3 mt-4">
                            <button
                                onClick={() => exportLoanToExcel(exportRows, `${selectedGroup.name}_Loans`)}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold"
                            >
                                <Download size={16} />
                                Export Excel
                            </button>
                            <button
                                onClick={() => exportLoanToPDF(exportRows, `${selectedGroup.name}_Loans`)}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-semibold"
                            >
                                <Download size={16} />
                                Export PDF
                            </button>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mt-4">
                            <SummaryCard title="Requests" value={filteredLoans.length} />
                            <SummaryCard title="Total Amount" value={`₹${totalAmount.toLocaleString()}`} />
                            <SummaryCard title="Selected Status" value={statusFilter === "all" ? "All" : statusFilter} />
                        </div>
                    </div>
                </div>
            </div>

            {/* List container */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5 bg-gray-50 border-b">
                    <p className="font-semibold text-gray-800 text-sm sm:text-base">
                        Loan Requests ({filteredLoans.length}) {loading ? "— Loading…" : ""}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">
                        All loans are directly saved to the database.
                    </p>
                </div>

                {/* Mobile cards */}
                <div className="block md:hidden">
                    {filteredLoans.length > 0 ? (
                        <div className="divide-y">
                            {filteredLoans.map((loan) => {
                                const memberLabel = loan.isGroupLoan
                                    ? "Group Loan"
                                    : `${loan.memberName || "-"} (${loan.memberCode || "-"})`;

                                const dateLabel = loan.date
                                    ? new Date(loan.date).toLocaleDateString("en-GB")
                                    : loan.createdAt
                                        ? new Date(loan.createdAt).toLocaleDateString("en-GB")
                                        : "-";

                                const statusCls =
                                    loan.status === "pending"
                                        ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                        : loan.status === "approved"
                                            ? "bg-green-50 text-green-700 border-green-200"
                                            : "bg-red-50 text-red-700 border-red-200";

                                return (
                                    <div key={loan._id || loan.id} className="p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className={`px-2 py-1 rounded-full text-[11px] font-semibold border ${statusCls}`}>
                                                        {loan.status || "-"}
                                                    </span>
                                                    <span className="text-xs text-gray-500">Date: {dateLabel}</span>
                                                </div>

                                                <p className="mt-2 text-sm font-semibold text-gray-800">
                                                    {loan.purpose || "—"}
                                                </p>

                                                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                                    <div className="p-2 rounded-lg bg-gray-50 border">
                                                        <p className="text-gray-500">Member</p>
                                                        <p className="font-semibold text-gray-800 truncate">{memberLabel}</p>
                                                    </div>

                                                    <div className="p-2 rounded-lg bg-gray-50 border">
                                                        <p className="text-gray-500">Amount</p>
                                                        <p className="font-bold text-gray-800">
                                                            ₹{Number(loan.amount || 0).toLocaleString()}
                                                        </p>
                                                    </div>

                                                    <div className="p-2 rounded-lg bg-gray-50 border">
                                                        <p className="text-gray-500">Type</p>
                                                        <p className="font-semibold text-gray-800">{loan.transactionType || "-"}</p>
                                                    </div>

                                                    <div className="p-2 rounded-lg bg-gray-50 border">
                                                        <p className="text-gray-500">Payment</p>
                                                        <p className="font-semibold text-gray-800">{loan.paymentMode || "-"}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        !loading && <div className="p-10 text-center text-gray-500 text-sm">No loan requests found.</div>
                    )}

                    {filteredLoans.length > 0 && (
                        <div className="p-4 border-t bg-gray-50">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-gray-700">Total</span>
                                <span className="text-sm font-bold text-gray-900">₹{totalAmount.toLocaleString()}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Tablet/Desktop table */}
                <div className="hidden md:block">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse min-w-[900px]">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border-b p-3 text-left font-semibold text-gray-700 text-sm">Status</th>
                                    <th className="border-b p-3 text-left font-semibold text-gray-700 text-sm">Member</th>
                                    <th className="border-b p-3 text-left font-semibold text-gray-700 text-sm">Type</th>
                                    <th className="border-b p-3 text-left font-semibold text-gray-700 text-sm">Payment</th>
                                    <th className="border-b p-3 text-left font-semibold text-gray-700 text-sm">Purpose</th>
                                    <th className="border-b p-3 text-right font-semibold text-gray-700 text-sm">Amount</th>
                                    <th className="border-b p-3 text-left font-semibold text-gray-700 text-sm">Date</th>
                                </tr>
                            </thead>

                            <tbody>
                                {filteredLoans.map((loan) => {
                                    const memberLabel = loan.isGroupLoan
                                        ? "Group Loan"
                                        : `${loan.memberName || "-"} (${loan.memberCode || "-"})`;

                                    const dateLabel = loan.date
                                        ? new Date(loan.date).toLocaleDateString("en-GB")
                                        : loan.createdAt
                                            ? new Date(loan.createdAt).toLocaleDateString("en-GB")
                                            : "-";

                                    const statusCls =
                                        loan.status === "pending"
                                            ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                            : loan.status === "approved"
                                                ? "bg-green-50 text-green-700 border-green-200"
                                                : "bg-red-50 text-red-700 border-red-200";

                                    return (
                                        <tr key={loan._id || loan.id} className="hover:bg-gray-50">
                                            <td className="border-b p-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${statusCls}`}>
                                                    {loan.status || "-"}
                                                </span>
                                            </td>
                                            <td className="border-b p-3 text-gray-800 text-sm">{memberLabel}</td>
                                            <td className="border-b p-3 text-gray-700 text-sm">{loan.transactionType || "-"}</td>
                                            <td className="border-b p-3 text-gray-700 text-sm">{loan.paymentMode || "-"}</td>
                                            <td className="border-b p-3 text-gray-700 text-sm max-w-[320px] truncate">
                                                {loan.purpose || "-"}
                                            </td>
                                            <td className="border-b p-3 text-right text-gray-800 text-sm font-semibold whitespace-nowrap">
                                                ₹{Number(loan.amount || 0).toLocaleString()}
                                            </td>
                                            <td className="border-b p-3 text-gray-700 text-sm whitespace-nowrap">{dateLabel}</td>
                                        </tr>
                                    );
                                })}

                                {!loading && filteredLoans.length === 0 && (
                                    <tr>
                                        <td className="border-b p-8 text-center text-gray-600 text-sm" colSpan={7}>
                                            No loan requests found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>

                            {filteredLoans.length > 0 && (
                                <tfoot>
                                    <tr className="bg-gray-50 font-semibold">
                                        <td colSpan={5} className="border-t p-3 text-right text-gray-800 text-sm">
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
