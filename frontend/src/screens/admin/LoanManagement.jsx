import React, { useEffect, useMemo, useState } from "react";
import { Building2, DollarSign, Download, Plus, Search, Wifi, WifiOff } from "lucide-react";
import { Link } from "react-router-dom";
import { getGroups } from "../../services/groupService";
import { getAllApprovals } from "../../services/approvalDB";
import { exportLoanToExcel, exportLoanToPDF } from "../../utils/exportUtils";

export default function AdminLoanManagement() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [groups, setGroupsState] = useState([]);
    const [groupsLoading, setGroupsLoading] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null); // {id,name,code,village}

    const [loanApprovals, setLoanApprovals] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all"); // all|pending|approved|rejected

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
                    }))
                );
            })
            .catch((e) => {
                console.error("Failed to load groups:", e);
                setGroupsState([]);
            })
            .finally(() => setGroupsLoading(false));
    }, []);

    const loadLoanApprovals = async (groupId) => {
        if (!groupId) return;
        try {
            setLoading(true);
            const approvals = await getAllApprovals(groupId);
            const loans = (approvals || [])
                .filter((a) => a.type === "loan")
                .map((a) => ({
                    id: a.id,
                    status: a.status,
                    groupId: a.groupId,
                    groupName: a.groupName,
                    submittedAt: a.submittedAt,
                    data: a.data || {},
                }));
            setLoanApprovals(loans);
        } catch (e) {
            console.error("Failed to load loan approvals:", e);
            setLoanApprovals([]);
        } finally {
            setLoading(false);
        }
    };

    const pendingCount = useMemo(
        () => loanApprovals.filter((a) => a.status === "pending").length,
        [loanApprovals]
    );

    const filtered = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        return loanApprovals.filter((a) => {
            const statusOk = statusFilter === "all" || a.status === statusFilter;
            if (!statusOk) return false;

            if (!q) return true;
            const d = a.data || {};
            const memberName = String(d.memberName || "").toLowerCase();
            const memberCode = String(d.memberCode || "").toLowerCase();
            const purpose = String(d.purpose || "").toLowerCase();
            const txType = String(d.transactionType || "").toLowerCase();
            const groupLoan = d.isGroupLoan ? "group" : "";
            return (
                memberName.includes(q) ||
                memberCode.includes(q) ||
                purpose.includes(q) ||
                txType.includes(q) ||
                groupLoan.includes(q)
            );
        });
    }, [loanApprovals, searchTerm, statusFilter]);

    const exportRows = useMemo(() => {
        return filtered.map((a) => {
            const d = a.data || {};
            return {
                Status: a.status,
                "Member Code": d.memberCode || "-",
                "Member Name": d.memberName || (d.isGroupLoan ? "Group Loan" : "-"),
                "Transaction Type": d.transactionType || "-",
                "Payment Mode": d.paymentMode || "-",
                Purpose: d.purpose || "-",
                Amount: d.amount ?? "-",
                Date: d.date || (a.submittedAt ? new Date(a.submittedAt).toLocaleDateString("en-GB") : "-"),
            };
        });
    }, [filtered]);

    if (!selectedGroup) {
        return (
            <div className="max-w-7xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <DollarSign size={32} />
                        Loan Management (Admin)
                    </h1>
                    <p className="text-gray-600 mt-2">Select a group to view loan transactions (approval-based)</p>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <Building2 size={24} className="text-blue-600" />
                        Select Group
                    </h2>
                    {groupsLoading ? (
                        <p className="text-gray-600">Loading groups…</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {groups.map((g) => (
                                <div
                                    key={g.id}
                                    onClick={() => {
                                        setSelectedGroup(g);
                                        loadLoanApprovals(g.id);
                                    }}
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
                                        <p className="mt-1">Members: {g.memberCount}</p>
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
            <div className="mb-6 flex items-start justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <DollarSign size={32} />
                        Loan Management (Admin)
                    </h1>
                    <p className="text-gray-600 mt-2">
                        Group: <span className="font-semibold">{selectedGroup.name}</span> ({selectedGroup.code})
                    </p>
                    <div className="flex items-center gap-2 text-sm mt-2">
                        {isOnline ? <Wifi size={16} className="text-green-600" /> : <WifiOff size={16} className="text-red-600" />}
                        <span className={isOnline ? "text-green-700" : "text-red-700"}>{isOnline ? "Online" : "Offline"}</span>
                        {pendingCount > 0 && (
                            <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
                                {pendingCount} pending
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex gap-3">
                    <Link
                        to={`/admin/loan-taking?groupId=${selectedGroup.id}`}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
                    >
                        <Plus size={18} />
                        Take New Loan
                    </Link>
                    <button
                        onClick={() => {
                            setSelectedGroup(null);
                            setLoanApprovals([]);
                            setSearchTerm("");
                            setStatusFilter("all");
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                    >
                        Change Group
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                            <input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search member code/name, purpose, transaction type..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                        </div>
                    </div>
                    <div>
                        <select
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="all">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-4">
                    <button
                        onClick={() => exportLoanToExcel(exportRows, `${selectedGroup.name}_Loans`)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold"
                    >
                        <Download size={16} />
                        Export Excel
                    </button>
                    <button
                        onClick={() => exportLoanToPDF(exportRows, `${selectedGroup.name}_Loans`)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-semibold"
                    >
                        <Download size={16} />
                        Export PDF
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="p-4 bg-gray-50 border-b">
                    <p className="font-semibold text-gray-800">
                        Loan Requests ({filtered.length}) {loading ? "— Loading…" : ""}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                        Tip: approve/reject in <span className="font-semibold">Admin → Approvals</span>.
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border p-3 text-left font-semibold text-gray-700">Status</th>
                                <th className="border p-3 text-left font-semibold text-gray-700">Member</th>
                                <th className="border p-3 text-left font-semibold text-gray-700">Type</th>
                                <th className="border p-3 text-left font-semibold text-gray-700">Payment</th>
                                <th className="border p-3 text-left font-semibold text-gray-700">Purpose</th>
                                <th className="border p-3 text-right font-semibold text-gray-700">Amount</th>
                                <th className="border p-3 text-left font-semibold text-gray-700">Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((a) => {
                                const d = a.data || {};
                                const memberLabel = d.isGroupLoan
                                    ? "Group Loan"
                                    : `${d.memberName || "-"} (${d.memberCode || "-"})`;
                                return (
                                    <tr key={a.id} className="hover:bg-gray-50">
                                        <td className="border p-3">
                                            <span
                                                className={`px-2 py-1 rounded-full text-xs font-semibold ${a.status === "pending"
                                                    ? "bg-yellow-100 text-yellow-800"
                                                    : a.status === "approved"
                                                        ? "bg-green-100 text-green-800"
                                                        : "bg-red-100 text-red-800"
                                                    }`}
                                            >
                                                {a.status}
                                            </span>
                                        </td>
                                        <td className="border p-3 text-gray-800">{memberLabel}</td>
                                        <td className="border p-3 text-gray-700">{d.transactionType || "-"}</td>
                                        <td className="border p-3 text-gray-700">{d.paymentMode || "-"}</td>
                                        <td className="border p-3 text-gray-700">{d.purpose || "-"}</td>
                                        <td className="border p-3 text-right text-gray-800">{d.amount ?? "-"}</td>
                                        <td className="border p-3 text-gray-700">
                                            {d.date || (a.submittedAt ? new Date(a.submittedAt).toLocaleDateString("en-GB") : "-")}
                                        </td>
                                    </tr>
                                );
                            })}
                            {!loading && filtered.length === 0 && (
                                <tr>
                                    <td className="border p-6 text-center text-gray-600" colSpan={7}>
                                        No loan requests found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

