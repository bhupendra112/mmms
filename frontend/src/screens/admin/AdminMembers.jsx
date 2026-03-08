import React, { useEffect, useMemo, useRef, useState } from "react";
import { Users, Search, Plus, Building2, Download, FileText } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { getGroups } from "../../services/groupService";
import { getMembersByGroup, exportMemberLedger } from "../../services/memberService";
import { exportMemberSummaryToExcel, exportMemberSummaryToPDF } from "../../utils/exportUtils";

const STORAGE_KEY_CLUSTER = "adminMembers_selectedCluster";
const STORAGE_KEY_GROUP = "adminMembers_selectedGroup";

export default function AdminMembers() {
    const [searchParams, setSearchParams] = useSearchParams();
    const hasRestoredRef = useRef(false);

    const [searchTerm, setSearchTerm] = useState("");
    const [selectedGroup, setSelectedGroup] = useState(null); // {id, name, code}
    const [selectedClusterKey, setSelectedClusterKey] = useState("");
    const [groups, setGroupsState] = useState([]);
    const [groupsLoading, setGroupsLoading] = useState(false);
    const [members, setMembers] = useState([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);
    const [dateRange, setDateRange] = useState({ fromDate: "", toDate: "" });

    const handleExportMember = async (memberId, format = 'excel') => {
        try {
            setExportLoading(true);
            const filters = {
                memberId: memberId,
                fromDate: dateRange.fromDate || undefined,
                toDate: dateRange.toDate || undefined,
            };
            
            const response = await exportMemberLedger(filters);
            
            if (response?.success && response?.data && response.data.length > 0) {
                const memberData = response.data[0];
                const memberCode = memberData.memberInfo?.code || "Member";
                
                if (format === 'excel') {
                    exportMemberSummaryToExcel([memberData], `Member_${memberCode}_Summary`);
                } else {
                    exportMemberSummaryToPDF([memberData], `Member_${memberCode}_Summary`);
                }
            } else {
                alert("No ledger data found to export");
            }
        } catch (error) {
            console.error("Error exporting ledger:", error);
            alert("Failed to export ledger. Please try again.");
        } finally {
            setExportLoading(false);
        }
    };

    const handleBulkExport = async (format = 'excel') => {
        if (!selectedGroup?.id) {
            alert("Please select a group first");
            return;
        }
        
        try {
            setExportLoading(true);
            const filters = {
                groupId: selectedGroup.id,
                fromDate: dateRange.fromDate || undefined,
                toDate: dateRange.toDate || undefined,
            };
            
            const response = await exportMemberLedger(filters);
            
            if (response?.success && response?.data && response.data.length > 0) {
                const groupName = selectedGroup.name || "Group";
                if (format === 'excel') {
                    exportMemberSummaryToExcel(response.data, `${groupName}_All_Members_Summary`);
                } else {
                    exportMemberSummaryToPDF(response.data, `${groupName}_All_Members_Summary`);
                }
            } else {
                alert("No ledger data found to export");
            }
        } catch (error) {
            console.error("Error exporting ledger:", error);
            alert("Failed to export ledger. Please try again.");
        } finally {
            setExportLoading(false);
        }
    };

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
                        memberCount: g.no_members ?? 0,
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

    useEffect(() => {
        if (!selectedGroup?.id) return;
        setMembersLoading(true);
        getMembersByGroup(selectedGroup.id)
            .then((res) => setMembers(Array.isArray(res?.data) ? res.data : []))
            .catch((e) => {
                console.error("Failed to load members:", e);
                setMembers([]);
            })
            .finally(() => setMembersLoading(false));
    }, [selectedGroup?.id]);

    const clusterOptions = useMemo(() => {
        const uniqueClusters = Array.from(
            new Set(groups.map((g) => `${g.clusterName}|${g.clusterCode}`))
        );
        return uniqueClusters.map((key) => {
            const [name, code] = key.split("|");
            return { value: key, label: `${name || "No Name"} (${code || "No Code"})` };
        });
    }, [groups]);

    const filteredGroups = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!selectedClusterKey) return [];
        const [cName, cCode] = selectedClusterKey.split("|");
        const scoped = groups.filter(
            (group) => group.clusterName === cName && group.clusterCode === cCode
        );
        if (!q) return scoped;
        return scoped.filter(
            (group) =>
                (group.name || "").toLowerCase().includes(q) ||
                (group.code || "").toLowerCase().includes(q)
        );
    }, [groups, searchTerm, selectedClusterKey]);

    // Restore cluster/group from URL or sessionStorage when returning (e.g. after Back from member detail)
    useEffect(() => {
        if (groups.length === 0 || hasRestoredRef.current) return;
        hasRestoredRef.current = true;
        let cluster = searchParams.get("cluster") || "";
        let groupId = searchParams.get("group") || "";
        if (!cluster && !groupId) {
            cluster = sessionStorage.getItem(STORAGE_KEY_CLUSTER) || "";
            groupId = sessionStorage.getItem(STORAGE_KEY_GROUP) || "";
            if (cluster || groupId) {
                const next = {};
                if (cluster) next.cluster = cluster;
                if (groupId) next.group = groupId;
                setSearchParams(next, { replace: true });
            }
        }
        if (cluster) setSelectedClusterKey(cluster);
        if (groupId) {
            const groupInList = groups.find((g) => g.id === groupId);
            if (groupInList) setSelectedGroup(groupInList);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groups]);

    return (
        <div className="w-full p-3 sm:p-4 md:p-6">
            <div className="mb-4 sm:mb-6">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2 sm:gap-3">
                    <Users size={24} className="shrink-0 w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
                    <span className="truncate">Manage Members</span>
                </h1>
                <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2 break-words">
                    View and manage members across all village samooh groups
                </p>
            </div>

            {/* Group Selection */}
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5 md:p-6 mb-4 sm:mb-6">
                <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 mb-3 sm:mb-4">Select Group to View Members</h2>
                <div className="mb-3 sm:mb-4">
                    <select
                        value={selectedClusterKey}
                        onChange={(e) => {
                            const val = e.target.value;
                            setSelectedClusterKey(val);
                            setSelectedGroup(null);
                            setMembers([]);
                            if (val) {
                                setSearchParams({ cluster: val }, { replace: true });
                                sessionStorage.setItem(STORAGE_KEY_CLUSTER, val);
                                sessionStorage.removeItem(STORAGE_KEY_GROUP);
                            } else {
                                setSearchParams({}, { replace: true });
                                sessionStorage.removeItem(STORAGE_KEY_CLUSTER);
                                sessionStorage.removeItem(STORAGE_KEY_GROUP);
                            }
                        }}
                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                    >
                        <option value="">Select Cluster</option>
                        {clusterOptions.map((c) => (
                            <option key={c.value} value={c.value}>
                                {c.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="relative mb-3 sm:mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                    <input
                        type="text"
                        placeholder="Search groups by name or code..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                    />
                </div>
                {groupsLoading && <p className="text-gray-600 mb-4 text-sm sm:text-base">Loading groups…</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {!selectedClusterKey ? (
                        <div className="col-span-full text-center py-6 sm:py-8 text-gray-500 text-sm sm:text-base">
                            <p>Please select a cluster to view groups.</p>
                        </div>
                    ) : (
                        filteredGroups.map((group) => (
                            <div
                                key={group.id}
                                onClick={() => {
                                    setSelectedGroup(group);
                                    if (selectedClusterKey) {
                                        setSearchParams({ cluster: selectedClusterKey, group: group.id }, { replace: true });
                                        sessionStorage.setItem(STORAGE_KEY_CLUSTER, selectedClusterKey);
                                        sessionStorage.setItem(STORAGE_KEY_GROUP, group.id);
                                    }
                                }}
                                className={`p-3 sm:p-4 border-2 rounded-lg cursor-pointer transition-colors ${selectedGroup?.id === group.id
                                    ? "border-blue-500 bg-blue-50"
                                    : "border-gray-200 hover:border-blue-300"
                                    }`}
                            >
                                <div className="flex items-center gap-2 sm:gap-3">
                                    <Building2 className="text-blue-500 shrink-0 w-5 h-5 sm:w-6 sm:h-6" />
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-gray-800 truncate text-sm sm:text-base">{group.name}</p>
                                        <p className="text-xs sm:text-sm text-gray-600">Code: {group.code}</p>
                                        <p className="text-xs sm:text-sm text-gray-500">Members: {group.memberCount}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Members List */}
            {selectedGroup && (
                <div className="bg-white rounded-lg shadow-md p-4 sm:p-5 md:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
                        <h2 className="text-lg sm:text-xl font-semibold text-gray-800 truncate">
                            Members of {selectedGroup.name}
                        </h2>
                        <Link
                            to={`/admin/member-registration?groupId=${selectedGroup.id}`}
                            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 text-sm sm:text-base w-full sm:w-auto shrink-0"
                        >
                            <Plus size={18} className="sm:w-5 sm:h-5" />
                            Add Member
                        </Link>
                    </div>

                    {/* Date Range and Bulk Export */}
                    <div className="mb-4 sm:mb-5 p-3 sm:p-4 bg-gray-50 rounded-lg">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Export Options</h3>
                        <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
                            <div className="w-full sm:w-auto">
                                <label className="block text-sm font-semibold text-gray-700 mb-1">From Date</label>
                                <input
                                    type="date"
                                    value={dateRange.fromDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, fromDate: e.target.value }))}
                                    className="w-full sm:w-auto min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                            </div>
                            <div className="w-full sm:w-auto">
                                <label className="block text-sm font-semibold text-gray-700 mb-1">To Date</label>
                                <input
                                    type="date"
                                    value={dateRange.toDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, toDate: e.target.value }))}
                                    className="w-full sm:w-auto min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-end gap-2 w-full sm:w-auto">
                                <button
                                    onClick={() => handleBulkExport('excel')}
                                    disabled={exportLoading}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50 w-full sm:w-auto"
                                >
                                    <Download size={16} />
                                    {exportLoading ? "Exporting…" : "Export All (Excel)"}
                                </button>
                                <button
                                    onClick={() => handleBulkExport('pdf')}
                                    disabled={exportLoading}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:opacity-50 w-full sm:w-auto"
                                >
                                    <FileText size={16} />
                                    {exportLoading ? "Exporting…" : "Export All (PDF)"}
                                </button>
                            </div>
                        </div>
                    </div>

                    {membersLoading ? (
                        <div className="text-center py-10 sm:py-12 text-gray-500">
                            <Users size={40} className="mx-auto mb-3 sm:mb-4 text-gray-400 sm:w-12 sm:h-12" />
                            <p className="text-sm sm:text-base">Loading members…</p>
                        </div>
                    ) : members.length > 0 ? (
                        <>
                            {/* Mobile Card View */}
                            <div className="block sm:hidden space-y-3 sm:space-y-4">
                                {members.map((member) => (
                                    <div key={member._id} className="bg-white border rounded-lg p-4 shadow-sm">
                                        <div className="flex justify-between items-start gap-3 mb-3">
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-semibold text-gray-800 text-sm sm:text-base truncate">{member.Member_Nm}</h3>
                                                <p className="text-xs sm:text-sm text-gray-600">Code: {member.Member_Id}</p>
                                                {member.Village && (
                                                    <p className="text-xs sm:text-sm text-gray-600 truncate">Village: {member.Village}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                                            <Link
                                                to={`/admin/members/${member._id}`}
                                                className="flex-1 min-w-[80px] bg-blue-600 text-white px-3 py-2 rounded-lg text-center text-sm font-medium hover:bg-blue-700"
                                            >
                                                View
                                            </Link>
                                            <button
                                                onClick={() => handleExportMember(member._id, 'excel')}
                                                disabled={exportLoading}
                                                className="flex-1 min-w-[80px] flex items-center justify-center gap-1.5 bg-green-600 text-white px-3 py-2 rounded-lg text-sm disabled:opacity-50"
                                                title="Export Excel"
                                            >
                                                <Download size={14} />
                                                Excel
                                            </button>
                                            <button
                                                onClick={() => handleExportMember(member._id, 'pdf')}
                                                disabled={exportLoading}
                                                className="flex-1 min-w-[80px] flex items-center justify-center gap-1.5 bg-red-600 text-white px-3 py-2 rounded-lg text-sm disabled:opacity-50"
                                                title="Export PDF"
                                            >
                                                <FileText size={14} />
                                                PDF
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Tablet / Desktop Table View */}
                            <div className="hidden sm:block w-full overflow-x-auto rounded-lg border border-gray-200 bg-white">
                                <table className="min-w-[580px] sm:min-w-[640px] w-full border-collapse text-xs sm:text-sm">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            <th className="border border-gray-200 p-2 sm:p-3 text-left font-semibold text-gray-700">Code</th>
                                            <th className="border border-gray-200 p-2 sm:p-3 text-left font-semibold text-gray-700">Name</th>
                                            <th className="border border-gray-200 p-2 sm:p-3 text-left font-semibold text-gray-700 hidden md:table-cell">Village</th>
                                            <th className="border border-gray-200 p-2 sm:p-3 text-center font-semibold text-gray-700">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {members.map((member) => (
                                            <tr key={member._id} className="hover:bg-gray-50">
                                                <td className="border border-gray-200 p-2 sm:p-3 text-gray-800">{member.Member_Id}</td>
                                                <td className="border border-gray-200 p-2 sm:p-3 text-gray-800">{member.Member_Nm}</td>
                                                <td className="border border-gray-200 p-2 sm:p-3 text-gray-600 hidden md:table-cell">{member.Village || "-"}</td>
                                                <td className="border border-gray-200 p-2 sm:p-3">
                                                    <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
                                                        <Link
                                                            to={`/admin/members/${member._id}`}
                                                            className="bg-blue-600 text-white px-2 sm:px-3 py-1.5 rounded text-xs sm:text-sm hover:bg-blue-700"
                                                        >
                                                            View
                                                        </Link>
                                                        <button
                                                            onClick={() => handleExportMember(member._id, 'excel')}
                                                            disabled={exportLoading}
                                                            className="bg-green-600 text-white px-2 py-1.5 rounded text-xs sm:text-sm disabled:opacity-50"
                                                            title="Export Ledger (Excel)"
                                                        >
                                                            <Download size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleExportMember(member._id, 'pdf')}
                                                            disabled={exportLoading}
                                                            className="bg-red-600 text-white px-2 py-1.5 rounded text-xs sm:text-sm disabled:opacity-50"
                                                            title="Export Ledger (PDF)"
                                                        >
                                                            <FileText size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-10 sm:py-12 text-gray-500">
                            <Users size={40} className="mx-auto mb-3 sm:mb-4 text-gray-400 sm:w-12 sm:h-12" />
                            <p className="text-sm sm:text-base">No members found for this group.</p>
                            <p className="text-xs sm:text-sm mt-2">Add a member to see it here.</p>
                        </div>
                    )}
                </div>
            )}

            {!selectedGroup && (
                <div className="bg-white rounded-lg shadow-md p-8 sm:p-10 md:p-12 text-center">
                    <Building2 className="mx-auto mb-3 sm:mb-4 text-gray-400 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16" />
                    <p className="text-gray-600 text-sm sm:text-base">Please select a group to view its members</p>
                </div>
            )}
        </div>
    );
}

