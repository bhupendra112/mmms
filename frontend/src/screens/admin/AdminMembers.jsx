import React, { useEffect, useMemo, useState } from "react";
import { Users, Search, Plus, Building2, Download, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { getGroups } from "../../services/groupService";
import { getMembersByGroup, exportMemberLedger } from "../../services/memberService";
import { exportMemberLedgerToExcel, exportMemberLedgerToPDF } from "../../utils/exportUtils";

export default function AdminMembers() {
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
                    exportMemberLedgerToExcel([memberData], `Member_${memberCode}_Ledger`);
                } else {
                    exportMemberLedgerToPDF([memberData], `Member_${memberCode}_Ledger`);
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
                    exportMemberLedgerToExcel(response.data, `${groupName}_All_Members_Ledger`);
                } else {
                    exportMemberLedgerToPDF(response.data, `${groupName}_All_Members_Ledger`);
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

    return (
        <div className="max-w-7xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <Users size={32} />
                    Manage Members
                </h1>
                <p className="text-gray-600 mt-2">
                    View and manage members across all village samooh groups
                </p>
            </div>

            {/* Group Selection */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Select Group to View Members</h2>
                <div className="mb-4">
                    <select
                        value={selectedClusterKey}
                        onChange={(e) => {
                            setSelectedClusterKey(e.target.value);
                            setSelectedGroup(null);
                            setMembers([]);
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Select Cluster</option>
                        {clusterOptions.map((c) => (
                            <option key={c.value} value={c.value}>
                                {c.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search groups by name or code..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                {groupsLoading && <p className="text-gray-600 mb-4">Loading groups…</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {!selectedClusterKey ? (
                        <div className="col-span-full text-center py-8 text-gray-500">
                            <p>Please select a cluster to view groups.</p>
                        </div>
                    ) : (
                        filteredGroups.map((group) => (
                            <div
                                key={group.id}
                                onClick={() => setSelectedGroup(group)}
                                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${selectedGroup?.id === group.id
                                    ? "border-blue-500 bg-blue-50"
                                    : "border-gray-200 hover:border-blue-300"
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Building2 className="text-blue-500" size={24} />
                                    <div>
                                        <p className="font-semibold text-gray-800">{group.name}</p>
                                        <p className="text-sm text-gray-600">Code: {group.code}</p>
                                        <p className="text-sm text-gray-500">Members: {group.memberCount}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Members List */}
            {selectedGroup && (
                <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-gray-800">
                            Members of {selectedGroup.name}
                        </h2>
                        <Link
                            to={`/admin/member-registration?groupId=${selectedGroup.id}`}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                        >
                            <Plus size={20} />
                            Add Member
                        </Link>
                    </div>
                    
                    {/* Date Range and Bulk Export */}
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Export Options</h3>
                        <div className="flex items-center gap-4 mb-3">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">From Date</label>
                                <input
                                    type="date"
                                    value={dateRange.fromDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, fromDate: e.target.value }))}
                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">To Date</label>
                                <input
                                    type="date"
                                    value={dateRange.toDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, toDate: e.target.value }))}
                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                            </div>
                            <div className="flex items-end gap-2">
                                <button
                                    onClick={() => handleBulkExport('excel')}
                                    disabled={exportLoading}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
                                >
                                    <Download size={16} />
                                    {exportLoading ? "Exporting..." : "Export All (Excel)"}
                                </button>
                                <button
                                    onClick={() => handleBulkExport('pdf')}
                                    disabled={exportLoading}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:opacity-50"
                                >
                                    <FileText size={16} />
                                    {exportLoading ? "Exporting..." : "Export All (PDF)"}
                                </button>
                            </div>
                        </div>
                    </div>

                    {membersLoading ? (
                        <div className="text-center py-12 text-gray-500">
                            <Users size={48} className="mx-auto mb-4 text-gray-400" />
                            <p>Loading members…</p>
                        </div>
                    ) : members.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="border p-3 text-left font-semibold text-gray-700">Code</th>
                                        <th className="border p-3 text-left font-semibold text-gray-700">Name</th>
                                        <th className="border p-3 text-left font-semibold text-gray-700">Village</th>
                                        <th className="border p-3 text-center font-semibold text-gray-700">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {members.map((member) => (
                                        <tr key={member._id} className="hover:bg-gray-50">
                                            <td className="border p-3 text-gray-800">{member.Member_Id}</td>
                                            <td className="border p-3 text-gray-800">{member.Member_Nm}</td>
                                            <td className="border p-3 text-gray-600">{member.Village || "-"}</td>
                                            <td className="border p-3">
                                                <div className="flex items-center justify-center gap-2">
                                                    <Link
                                                        to={`/admin/members/${member._id}`}
                                                        className="text-blue-600 hover:text-blue-800 text-sm"
                                                    >
                                                        View
                                                    </Link>
                                                    <button
                                                        onClick={() => handleExportMember(member._id, 'excel')}
                                                        disabled={exportLoading}
                                                        className="bg-green-600 text-white px-2 py-1 rounded text-sm disabled:opacity-50"
                                                        title="Export Ledger (Excel)"
                                                    >
                                                        <Download size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleExportMember(member._id, 'pdf')}
                                                        disabled={exportLoading}
                                                        className="bg-red-600 text-white px-2 py-1 rounded text-sm disabled:opacity-50"
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
                    ) : (
                        <div className="text-center py-12 text-gray-500">
                            <Users size={48} className="mx-auto mb-4 text-gray-400" />
                            <p>No members found for this group.</p>
                            <p className="text-sm mt-2">Add a member to see it here.</p>
                        </div>
                    )}
                </div>
            )}

            {!selectedGroup && (
                <div className="bg-white rounded-lg shadow-md p-12 text-center">
                    <Building2 size={64} className="mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-600">Please select a group to view its members</p>
                </div>
            )}
        </div>
    );
}

