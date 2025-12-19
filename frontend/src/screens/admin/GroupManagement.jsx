import React, { useEffect, useMemo, useState } from "react";
import { Building2, Users, Banknote, DollarSign, Search, Edit, Eye, Plus, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { getGroupBanks, getGroups, getGroupDetail } from "../../services/groupService";
import { getMembersByGroup } from "../../services/memberService";

export default function GroupManagement() {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [activeTab, setActiveTab] = useState("overview"); // overview, members, bank, finance
    const [groups, setGroupsState] = useState([]);
    const [groupsLoading, setGroupsLoading] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [selectedGroupData, setSelectedGroupData] = useState(null);
    const [groupMembers, setGroupMembers] = useState([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [groupBanks, setGroupBanks] = useState([]);
    const [banksLoading, setBanksLoading] = useState(false);

    const mapGroupToUI = (g) => {
        if (!g) return null;
        const bank = g.bankmaster || g.bank || null;
        return {
            id: g._id || g.id,
            code: g.group_code || g.code,
            name: g.group_name || g.name,
            village: g.village,
            cluster: g.cluster || g.cluster_name,
            formationDate: g.formation_date ? new Date(g.formation_date).toLocaleDateString("en-GB") : "",
            noMembers: g.memberCount ?? g.no_members ?? 0,
            president: g.president_name || "",
            secretary: g.secretary_name || "",
            treasurer: g.treasurer_name || "",
            bankDetails: bank
                ? {
                    bankName: bank.bank_name,
                    accountNo: bank.account_no,
                    ifsc: bank.ifsc,
                    branch: bank.branch_name,
                }
                : null,
            members: [], // TODO: will be loaded when member APIs are wired
            finance: {
                totalSavings: 0,
                totalLoans: 0,
                totalFD: 0,
                totalInterest: 0,
                totalRecovery: 0,
            },
        };
    };

    useEffect(() => {
        setGroupsLoading(true);
        getGroups()
            .then((res) => {
                const list = Array.isArray(res?.data) ? res.data : [];
                setGroupsState(list.map(mapGroupToUI).filter(Boolean));
            })
            .catch((e) => {
                console.error("Failed to load groups:", e);
                setGroupsState([]);
            })
            .finally(() => setGroupsLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredGroups = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return groups;
        return groups.filter(
            (group) =>
                (group.name || "").toLowerCase().includes(q) ||
                (group.code || "").toLowerCase().includes(q) ||
                (group.village || "").toLowerCase().includes(q)
        );
    }, [groups, searchTerm]);

    const loadGroupDetail = async (groupId) => {
        if (!groupId) return;
        try {
            setDetailLoading(true);
            const res = await getGroupDetail(groupId);
            const mapped = mapGroupToUI(res?.data);
            if (mapped) setSelectedGroupData(mapped);
        } catch (e) {
            console.error("Failed to load group detail:", e);
        } finally {
            setDetailLoading(false);
        }
    };

    const loadGroupMembers = async (groupId) => {
        if (!groupId) return;
        try {
            setMembersLoading(true);
            const res = await getMembersByGroup(groupId);
            setGroupMembers(Array.isArray(res?.data) ? res.data : []);
        } catch (e) {
            console.error("Failed to load group members:", e);
            setGroupMembers([]);
        } finally {
            setMembersLoading(false);
        }
    };

    const loadBanks = async (groupId) => {
        if (!groupId) return;
        try {
            setBanksLoading(true);
            const res = await getGroupBanks(groupId);
            setGroupBanks(Array.isArray(res?.data) ? res.data : []);
        } catch (e) {
            console.error("Failed to load banks:", e);
            setGroupBanks([]);
        } finally {
            setBanksLoading(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <Building2 size={32} />
                    Group Management Dashboard
                </h1>
                <p className="text-gray-600 mt-2">Manage all village samooh groups, members, bank details, and finance</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Sidebar - Groups List */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="Search groups..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                        </div>
                        <Link
                            to="/admin/create-group"
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
                        >
                            <Plus size={18} />
                            Create New Group
                        </Link>
                    </div>

                    <div className="bg-white rounded-lg shadow-md overflow-hidden">
                        <div className="p-4 bg-gray-50 border-b">
                            <h3 className="font-semibold text-gray-800">
                                {groupsLoading ? "Loading groups..." : `All Groups (${filteredGroups.length})`}
                            </h3>
                        </div>
                        <div className="max-h-[600px] overflow-y-auto">
                            {filteredGroups.map((group) => (
                                <div
                                    key={group.id}
                                    onClick={() => {
                                        setSelectedGroup(group.id);
                                        setSelectedGroupData(group);
                                        setActiveTab("overview");
                                        loadGroupDetail(group.id);
                                        loadGroupMembers(group.id);
                                        loadBanks(group.id);
                                    }}
                                    className={`p-4 border-b cursor-pointer transition-colors ${selectedGroup === group.id
                                        ? "bg-blue-50 border-l-4 border-l-blue-600"
                                        : "hover:bg-gray-50"
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <p className="font-semibold text-gray-800">{group.name}</p>
                                            <p className="text-sm text-gray-600">Code: {group.code}</p>
                                            <p className="text-sm text-gray-500">{group.village}</p>
                                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <Users size={14} />
                                                    {group.noMembers} members
                                                </span>
                                            </div>
                                        </div>
                                        <Building2
                                            className={selectedGroup === group.id ? "text-blue-600" : "text-gray-400"}
                                            size={20}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Side - Group Details */}
                <div className="lg:col-span-2">
                    {selectedGroupData ? (
                        <div className="space-y-6">
                            {/* Group Header */}
                            <div className="bg-white rounded-lg shadow-md p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-800">{selectedGroupData.name}</h2>
                                        <p className="text-gray-600">Code: {selectedGroupData.code} | Village: {selectedGroupData.village}</p>
                                    </div>
                                    <Link
                                        to={`/admin/create-group?edit=${selectedGroupData.id}`}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                                    >
                                        <Edit size={16} />
                                        Edit Group
                                    </Link>
                                </div>
                                {detailLoading && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                        <p className="text-blue-700 text-sm font-medium">Refreshing group details…</p>
                                    </div>
                                )}

                                {/* Tabs */}
                                <div className="flex gap-2 border-b">
                                    {[
                                        { id: "overview", label: "Overview", icon: Eye },
                                        { id: "members", label: "Members", icon: Users },
                                        { id: "bank", label: "Bank Details", icon: Banknote },
                                        { id: "finance", label: "Finance", icon: DollarSign },
                                    ].map((tab) => {
                                        const Icon = tab.icon;
                                        return (
                                            <button
                                                key={tab.id}
                                                onClick={() => setActiveTab(tab.id)}
                                                className={`flex items-center gap-2 px-4 py-2 font-medium text-sm transition-colors ${activeTab === tab.id
                                                    ? "text-blue-600 border-b-2 border-blue-600"
                                                    : "text-gray-600 hover:text-gray-800"
                                                    }`}
                                            >
                                                <Icon size={18} />
                                                {tab.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Tab Content */}
                            {activeTab === "overview" && (
                                <div className="bg-white rounded-lg shadow-md p-6">
                                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Group Overview</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        <div className="p-4 bg-gray-50 rounded-lg">
                                            <p className="text-sm text-gray-600">Formation Date</p>
                                            <p className="font-semibold text-gray-800">{selectedGroupData.formationDate}</p>
                                        </div>
                                        <div className="p-4 bg-gray-50 rounded-lg">
                                            <p className="text-sm text-gray-600">Total Members</p>
                                            <p className="font-semibold text-gray-800">{selectedGroupData.noMembers}</p>
                                        </div>
                                        <div className="p-4 bg-gray-50 rounded-lg">
                                            <p className="text-sm text-gray-600">Cluster</p>
                                            <p className="font-semibold text-gray-800">{selectedGroupData.cluster}</p>
                                        </div>
                                        <div className="p-4 bg-gray-50 rounded-lg">
                                            <p className="text-sm text-gray-600">President</p>
                                            <p className="font-semibold text-gray-800">{selectedGroupData.president}</p>
                                        </div>
                                        <div className="p-4 bg-gray-50 rounded-lg">
                                            <p className="text-sm text-gray-600">Secretary</p>
                                            <p className="font-semibold text-gray-800">{selectedGroupData.secretary}</p>
                                        </div>
                                        <div className="p-4 bg-gray-50 rounded-lg">
                                            <p className="text-sm text-gray-600">Treasurer</p>
                                            <p className="font-semibold text-gray-800">{selectedGroupData.treasurer}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === "members" && (
                                <div className="bg-white rounded-lg shadow-md p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-xl font-semibold text-gray-800">Group Members</h3>
                                        <Link
                                            to={`/admin/member-registration?groupId=${selectedGroupData.id}`}
                                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                                        >
                                            <Plus size={16} />
                                            Add Member
                                        </Link>
                                    </div>
                                    {membersLoading && (
                                        <p className="text-gray-600 mb-4">Loading members…</p>
                                    )}
                                    <div className="overflow-x-auto">
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="bg-gray-100">
                                                    <th className="border p-3 text-left font-semibold text-gray-700">Code</th>
                                                    <th className="border p-3 text-left font-semibold text-gray-700">Name</th>
                                                    <th className="border p-3 text-center font-semibold text-gray-700">Status</th>
                                                    <th className="border p-3 text-right font-semibold text-gray-700">Balance</th>
                                                    <th className="border p-3 text-center font-semibold text-gray-700">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {groupMembers.map((member) => (
                                                    <tr key={member._id} className="hover:bg-gray-50">
                                                        <td className="border p-3 text-gray-800">{member.Member_Id}</td>
                                                        <td className="border p-3 text-gray-800">{member.Member_Nm}</td>
                                                        <td className="border p-3 text-center">
                                                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                                                                Active
                                                            </span>
                                                        </td>
                                                        <td className="border p-3 text-right text-gray-800">₹0</td>
                                                        <td className="border p-3 text-center">
                                                            <Link
                                                                to={`/admin/members/${member._id}`}
                                                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                                            >
                                                                View
                                                            </Link>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {!membersLoading && groupMembers.length === 0 && (
                                                    <tr>
                                                        <td className="border p-3 text-center text-gray-600" colSpan={5}>
                                                            No members found for this group.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {activeTab === "bank" && (
                                <div className="bg-white rounded-lg shadow-md p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-xl font-semibold text-gray-800">Bank Details</h3>
                                        <Link
                                            to={`/admin/bank-details?groupId=${selectedGroupData.id}`}
                                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                                        >
                                            <Edit size={16} />
                                            Edit Bank Details
                                        </Link>
                                    </div>
                                    {banksLoading ? (
                                        <p className="text-gray-600">Loading bank accounts…</p>
                                    ) : groupBanks.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="w-full border-collapse">
                                                <thead>
                                                    <tr className="bg-gray-100">
                                                        <th className="border p-3 text-left font-semibold text-gray-700">Bank</th>
                                                        <th className="border p-3 text-left font-semibold text-gray-700">Account No</th>
                                                        <th className="border p-3 text-left font-semibold text-gray-700">IFSC</th>
                                                        <th className="border p-3 text-left font-semibold text-gray-700">Type</th>
                                                        <th className="border p-3 text-left font-semibold text-gray-700">Branch</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {groupBanks.map((b) => (
                                                        <tr key={b._id} className="hover:bg-gray-50">
                                                            <td className="border p-3 text-gray-800">{b.bank_name}</td>
                                                            <td className="border p-3 text-gray-800">{b.account_no}</td>
                                                            <td className="border p-3 text-gray-600">{b.ifsc || "-"}</td>
                                                            <td className="border p-3 text-gray-600">{b.account_type}</td>
                                                            <td className="border p-3 text-gray-600">{b.branch_name || "-"}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="text-center py-12">
                                            <Banknote size={48} className="mx-auto mb-4 text-gray-400" />
                                            <p className="text-gray-600">No bank accounts added yet</p>
                                            <Link
                                                to={`/admin/bank-details?groupId=${selectedGroupData.id}`}
                                                className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                            >
                                                Add Bank Account
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === "finance" && (
                                <div className="bg-white rounded-lg shadow-md p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-xl font-semibold text-gray-800">Finance Summary</h3>
                                        <Link
                                            to="/admin/demand-recovery"
                                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                                        >
                                            <DollarSign size={16} />
                                            Manage Recovery
                                        </Link>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm text-gray-600">Total Savings</p>
                                                    <p className="text-2xl font-bold text-gray-800">₹{selectedGroupData.finance.totalSavings.toLocaleString()}</p>
                                                </div>
                                                <TrendingUp className="text-blue-600" size={24} />
                                            </div>
                                        </div>
                                        <div className="p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm text-gray-600">Total Loans</p>
                                                    <p className="text-2xl font-bold text-gray-800">₹{selectedGroupData.finance.totalLoans.toLocaleString()}</p>
                                                </div>
                                                <DollarSign className="text-green-600" size={24} />
                                            </div>
                                        </div>
                                        <div className="p-4 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm text-gray-600">Total FD</p>
                                                    <p className="text-2xl font-bold text-gray-800">₹{selectedGroupData.finance.totalFD.toLocaleString()}</p>
                                                </div>
                                                <Banknote className="text-purple-600" size={24} />
                                            </div>
                                        </div>
                                        <div className="p-4 bg-orange-50 rounded-lg border-l-4 border-orange-500">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm text-gray-600">Total Interest</p>
                                                    <p className="text-2xl font-bold text-gray-800">₹{selectedGroupData.finance.totalInterest.toLocaleString()}</p>
                                                </div>
                                                <TrendingUp className="text-orange-600" size={24} />
                                            </div>
                                        </div>
                                        <div className="p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm text-gray-600">Total Recovery</p>
                                                    <p className="text-2xl font-bold text-gray-800">₹{selectedGroupData.finance.totalRecovery.toLocaleString()}</p>
                                                </div>
                                                <DollarSign className="text-yellow-600" size={24} />
                                            </div>
                                        </div>
                                        <div className="p-4 bg-gray-50 rounded-lg border-l-4 border-gray-500">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm text-gray-600">Net Total</p>
                                                    <p className="text-2xl font-bold text-gray-800">
                                                        ₹{(
                                                            selectedGroupData.finance.totalSavings +
                                                            selectedGroupData.finance.totalLoans +
                                                            selectedGroupData.finance.totalFD +
                                                            selectedGroupData.finance.totalInterest +
                                                            selectedGroupData.finance.totalRecovery
                                                        ).toLocaleString()}
                                                    </p>
                                                </div>
                                                <TrendingUp className="text-gray-600" size={24} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white rounded-lg shadow-md p-12 text-center">
                            <Building2 size={64} className="mx-auto mb-4 text-gray-400" />
                            <p className="text-gray-600 text-lg">Please select a group to view details</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

