import React, { useEffect, useMemo, useState } from "react";
import { Building2, Users, Banknote, DollarSign, Search, Edit, Eye, Plus, TrendingUp, X } from "lucide-react";
import { Link } from "react-router-dom";
import { getGroupBanks, getGroups, getGroupDetail, getBankDetail } from "../../services/groupService";
import { getMembersByGroup } from "../../services/memberService";
import { getLoans } from "../../services/loanService";
import { getRecoveries } from "../../services/recoveryService";

export default function GroupManagement() {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [activeTab, setActiveTab] = useState("overview"); // overview, members, bank, finance
    const [groups, setGroupsState] = useState([]);
    const [groupsLoading, setGroupsLoading] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [selectedGroupData, setSelectedGroupData] = useState(null);
    const [selectedGroupRaw, setSelectedGroupRaw] = useState(null); // Store raw group data for full details
    const [groupMembers, setGroupMembers] = useState([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [groupBanks, setGroupBanks] = useState([]);
    const [banksLoading, setBanksLoading] = useState(false);
    const [selectedBank, setSelectedBank] = useState(null);
    const [bankTransactions, setBankTransactions] = useState([]);
    const [bankDetailLoading, setBankDetailLoading] = useState(false);
    const [showBankModal, setShowBankModal] = useState(false);
    const [financeData, setFinanceData] = useState({
        totalSavings: 0,
        totalLoans: 0,
        totalFD: 0,
        totalInterest: 0,
        totalYogdan: 0,
        totalRecovery: 0,
        loading: false,
    });

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
            bankDetails: bank
                ? {
                    bankName: bank.bank_name,
                    accountNo: bank.account_no,
                    ifsc: bank.ifsc,
                    branch: bank.branch_name,
                }
                : null,
            members: [], // TODO: will be loaded when member APIs are wired
            // Finance will be calculated dynamically
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
            // Store raw data for full details
            setSelectedGroupRaw(res?.data || null);
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

    const handleViewBank = async (bankId) => {
        try {
            setBankDetailLoading(true);
            setShowBankModal(true);
            const res = await getBankDetail(bankId);
            setSelectedBank(res?.data?.bank || null);
            setBankTransactions(res?.data?.transactions || []);
        } catch (error) {
            console.error("Failed to load bank detail:", error);
            alert("Failed to load bank details");
        } finally {
            setBankDetailLoading(false);
        }
    };

    const calculateFinance = async (groupId) => {
        if (!groupId) return;
        try {
            setFinanceData((prev) => ({ ...prev, loading: true }));

            // Load members, loans, and recoveries in parallel
            const [membersRes, loansRes, recoveriesRes] = await Promise.all([
                getMembersByGroup(groupId).catch(() => ({ data: [] })),
                getLoans(groupId).catch((e) => {
                    console.error("Failed to load loans:", e);
                    return { data: [] };
                }),
                getRecoveries(groupId).catch((e) => {
                    console.error("Failed to load recoveries:", e);
                    return { data: [] };
                }),
            ]);

            // Handle API response structure: services return { success, message, data: [...] }
            // So we access .data to get the actual array
            const members = Array.isArray(membersRes?.data) ? membersRes.data : [];
            const loans = Array.isArray(loansRes?.data) ? loansRes.data : [];
            const recoveries = Array.isArray(recoveriesRes?.data) ? recoveriesRes.data : [];

            // Calculate totals from members (existing member financial data)
            let totalSavings = 0;
            let totalLoans = 0;
            let totalFD = 0;
            let totalInterest = 0;
            let totalYogdan = 0;

            members.forEach((member) => {
                // Opening savings
                totalSavings += parseFloat(member.openingSaving || 0);

                // Loan details
                if (member.loanDetails?.amount) {
                    totalLoans += parseFloat(member.loanDetails.amount);
                }
                if (member.loanDetails?.overdueInterest) {
                    totalInterest += parseFloat(member.loanDetails.overdueInterest);
                }

                // FD details
                if (member.fdDetails?.amount) {
                    totalFD += parseFloat(member.fdDetails.amount);
                }

                // Opening Yogdan
                totalYogdan += parseFloat(member.openingYogdan || 0);
            });

            // Add loans from LoanMaster (approved loans)
            loans.forEach((loan) => {
                if (loan.status === "approved") {
                    if (loan.transactionType === "Loan") {
                        totalLoans += parseFloat(loan.amount || 0);
                    } else if (loan.transactionType === "Saving") {
                        totalSavings += parseFloat(loan.amount || 0);
                    } else if (loan.transactionType === "FD") {
                        totalFD += parseFloat(loan.amount || 0);
                    }
                }
            });

            // Calculate total recovery from RecoveryMaster
            let totalRecovery = 0;
            recoveries.forEach((recovery) => {
                if (recovery.status === "approved" && recovery.totals) {
                    totalRecovery += parseFloat(recovery.totals.totalAmount || 0);
                }
            });

            setFinanceData({
                totalSavings,
                totalLoans,
                totalFD,
                totalInterest,
                totalYogdan,
                totalRecovery,
                loading: false,
            });
        } catch (e) {
            console.error("Failed to calculate finance:", e);
            setFinanceData((prev) => ({ ...prev, loading: false }));
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
                                        calculateFinance(group.id);
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
                            {activeTab === "overview" && selectedGroupRaw && (
                                <div className="space-y-6">
                                    {/* Basic Group Information */}
                                    <div className="bg-white rounded-lg shadow-md p-6">
                                        <h3 className="text-xl font-semibold text-gray-800 mb-4 pb-3 border-b">Basic Group Information</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="p-4 bg-gray-50 rounded-lg">
                                                <p className="text-sm text-gray-600 mb-1">Group Name</p>
                                                <p className="font-semibold text-gray-800">{selectedGroupRaw.group_name || "-"}</p>
                                            </div>
                                            <div className="p-4 bg-gray-50 rounded-lg">
                                                <p className="text-sm text-gray-600 mb-1">Group Code</p>
                                                <p className="font-semibold text-gray-800">{selectedGroupRaw.group_code || "-"}</p>
                                            </div>
                                            <div className="p-4 bg-gray-50 rounded-lg">
                                                <p className="text-sm text-gray-600 mb-1">Village</p>
                                                <p className="font-semibold text-gray-800">{selectedGroupRaw.village || "-"}</p>
                                            </div>
                                            <div className="p-4 bg-gray-50 rounded-lg">
                                                <p className="text-sm text-gray-600 mb-1">Cluster Name</p>
                                                <p className="font-semibold text-gray-800">{selectedGroupRaw.cluster_name || "-"}</p>
                                            </div>
                                            <div className="p-4 bg-gray-50 rounded-lg">
                                                <p className="text-sm text-gray-600 mb-1">Number of Members</p>
                                                <p className="font-semibold text-gray-800">{selectedGroupRaw.no_members || selectedGroupRaw.memberCount || 0}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Formation & Meeting Details */}
                                    <div className="bg-white rounded-lg shadow-md p-6">
                                        <h3 className="text-xl font-semibold text-gray-800 mb-4 pb-3 border-b">Formation & Meeting Details</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {selectedGroupRaw.formation_date && (
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">Formation Date</p>
                                                    <p className="font-semibold text-gray-800">
                                                        {new Date(selectedGroupRaw.formation_date).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}
                                                    </p>
                                                </div>
                                            )}
                                            {selectedGroupRaw.meeting_date_1_day && (
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">Meeting Date 1 - Day</p>
                                                    <p className="font-semibold text-gray-800">{selectedGroupRaw.meeting_date_1_day}</p>
                                                </div>
                                            )}
                                            {selectedGroupRaw.meeting_date_2_day && (
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">Meeting Date 2 - Day</p>
                                                    <p className="font-semibold text-gray-800">{selectedGroupRaw.meeting_date_2_day}</p>
                                                </div>
                                            )}
                                            {selectedGroupRaw.meeting_date_2_time && (
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">Meeting Time</p>
                                                    <p className="font-semibold text-gray-800">{selectedGroupRaw.meeting_date_2_time}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Office Bearers */}
                                    {selectedGroupRaw.mitan_name && (
                                        <div className="bg-white rounded-lg shadow-md p-6">
                                            <h3 className="text-xl font-semibold text-gray-800 mb-4 pb-3 border-b">Office Bearers</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">Mitan Name</p>
                                                    <p className="font-semibold text-gray-800">{selectedGroupRaw.mitan_name}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Financial Information */}
                                    {(selectedGroupRaw.saving_per_member || selectedGroupRaw.membership_fees || selectedGroupRaw.sahyog_rashi || selectedGroupRaw.shar_capital || selectedGroupRaw.Mship_Group) && (
                                        <div className="bg-white rounded-lg shadow-md p-6">
                                            <h3 className="text-xl font-semibold text-gray-800 mb-4 pb-3 border-b">Financial Information</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {selectedGroupRaw.saving_per_member && (
                                                    <div className="p-4 bg-gray-50 rounded-lg">
                                                        <p className="text-sm text-gray-600 mb-1">Saving Per Member</p>
                                                        <p className="font-semibold text-gray-800">₹{selectedGroupRaw.saving_per_member.toLocaleString()}</p>
                                                    </div>
                                                )}
                                                {selectedGroupRaw.membership_fees && (
                                                    <div className="p-4 bg-gray-50 rounded-lg">
                                                        <p className="text-sm text-gray-600 mb-1">Membership Fees</p>
                                                        <p className="font-semibold text-gray-800">₹{selectedGroupRaw.membership_fees.toLocaleString()}</p>
                                                    </div>
                                                )}
                                                {selectedGroupRaw.sahyog_rashi && (
                                                    <div className="p-4 bg-gray-50 rounded-lg">
                                                        <p className="text-sm text-gray-600 mb-1">Sahyog Rashi</p>
                                                        <p className="font-semibold text-gray-800">{selectedGroupRaw.sahyog_rashi}</p>
                                                    </div>
                                                )}
                                                {selectedGroupRaw.shar_capital && (
                                                    <div className="p-4 bg-gray-50 rounded-lg">
                                                        <p className="text-sm text-gray-600 mb-1">Share Capital</p>
                                                        <p className="font-semibold text-gray-800">{selectedGroupRaw.shar_capital}</p>
                                                    </div>
                                                )}
                                                {selectedGroupRaw.Mship_Group && (
                                                    <div className="p-4 bg-gray-50 rounded-lg">
                                                        <p className="text-sm text-gray-600 mb-1">Membership Group</p>
                                                        <p className="font-semibold text-gray-800">{selectedGroupRaw.Mship_Group}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Government Project Information */}
                                    {(selectedGroupRaw.govt_linked || selectedGroupRaw.govt_project_type) && (
                                        <div className="bg-white rounded-lg shadow-md p-6">
                                            <h3 className="text-xl font-semibold text-gray-800 mb-4 pb-3 border-b">Government Project Information</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {selectedGroupRaw.govt_linked && (
                                                    <div className="p-4 bg-gray-50 rounded-lg">
                                                        <p className="text-sm text-gray-600 mb-1">Linked with Govt Project?</p>
                                                        <p className="font-semibold text-gray-800">{selectedGroupRaw.govt_linked}</p>
                                                    </div>
                                                )}
                                                {selectedGroupRaw.govt_project_type && (
                                                    <div className="p-4 bg-gray-50 rounded-lg">
                                                        <p className="text-sm text-gray-600 mb-1">Project Type</p>
                                                        <p className="font-semibold text-gray-800">{selectedGroupRaw.govt_project_type}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Additional Information */}
                                    {(selectedGroupRaw.other || selectedGroupRaw.remark) && (
                                        <div className="bg-white rounded-lg shadow-md p-6">
                                            <h3 className="text-xl font-semibold text-gray-800 mb-4 pb-3 border-b">Additional Information</h3>
                                            <div className="space-y-4">
                                                {selectedGroupRaw.other && (
                                                    <div className="p-4 bg-gray-50 rounded-lg">
                                                        <p className="text-sm text-gray-600 mb-2">Other Information</p>
                                                        <p className="font-semibold text-gray-800 whitespace-pre-wrap">{selectedGroupRaw.other}</p>
                                                    </div>
                                                )}
                                                {selectedGroupRaw.remark && (
                                                    <div className="p-4 bg-gray-50 rounded-lg">
                                                        <p className="text-sm text-gray-600 mb-2">Remarks</p>
                                                        <p className="font-semibold text-gray-800 whitespace-pre-wrap">{selectedGroupRaw.remark}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
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
                                                        <th className="border p-3 text-center font-semibold text-gray-700">Actions</th>
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
                                                            <td className="border p-3 text-center">
                                                                <button
                                                                    onClick={() => handleViewBank(b._id)}
                                                                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm mx-auto"
                                                                >
                                                                    <Eye size={14} />
                                                                    View
                                                                </button>
                                                            </td>
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
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => selectedGroup && calculateFinance(selectedGroup)}
                                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                                                disabled={financeData.loading}
                                            >
                                                {financeData.loading ? "Calculating..." : "Refresh"}
                                            </button>
                                            <Link
                                                to="/admin/demand-recovery"
                                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                                            >
                                                <DollarSign size={16} />
                                                Manage Recovery
                                            </Link>
                                        </div>
                                    </div>
                                    {financeData.loading ? (
                                        <div className="text-center py-8">
                                            <p className="text-gray-600">Calculating finance details...</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                                                <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="text-sm text-gray-600">Total Savings</p>
                                                            <p className="text-2xl font-bold text-gray-800">₹{financeData.totalSavings.toLocaleString()}</p>
                                                            <p className="text-xs text-gray-500 mt-1">From members + loan transactions</p>
                                                        </div>
                                                        <TrendingUp className="text-blue-600" size={24} />
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="text-sm text-gray-600">Total Loans</p>
                                                            <p className="text-2xl font-bold text-gray-800">₹{financeData.totalLoans.toLocaleString()}</p>
                                                            <p className="text-xs text-gray-500 mt-1">From members + approved loans</p>
                                                        </div>
                                                        <DollarSign className="text-green-600" size={24} />
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="text-sm text-gray-600">Total FD</p>
                                                            <p className="text-2xl font-bold text-gray-800">₹{financeData.totalFD.toLocaleString()}</p>
                                                            <p className="text-xs text-gray-500 mt-1">From members + FD transactions</p>
                                                        </div>
                                                        <Banknote className="text-purple-600" size={24} />
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-orange-50 rounded-lg border-l-4 border-orange-500">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="text-sm text-gray-600">Total Interest</p>
                                                            <p className="text-2xl font-bold text-gray-800">₹{financeData.totalInterest.toLocaleString()}</p>
                                                            <p className="text-xs text-gray-500 mt-1">Overdue interest from members</p>
                                                        </div>
                                                        <TrendingUp className="text-orange-600" size={24} />
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-indigo-50 rounded-lg border-l-4 border-indigo-500">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="text-sm text-gray-600">Total Yogdan</p>
                                                            <p className="text-2xl font-bold text-gray-800">₹{financeData.totalYogdan.toLocaleString()}</p>
                                                            <p className="text-xs text-gray-500 mt-1">Opening Yogdan from members</p>
                                                        </div>
                                                        <DollarSign className="text-indigo-600" size={24} />
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="text-sm text-gray-600">Total Recovery</p>
                                                            <p className="text-2xl font-bold text-gray-800">₹{financeData.totalRecovery.toLocaleString()}</p>
                                                            <p className="text-xs text-gray-500 mt-1">From approved recovery sessions</p>
                                                        </div>
                                                        <DollarSign className="text-yellow-600" size={24} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Net Total and Summary */}
                                            <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-6 border-2 border-gray-300">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h4 className="text-lg font-semibold text-gray-800">Net Financial Position</h4>
                                                    <TrendingUp className="text-gray-600" size={28} />
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-sm text-gray-600 mb-2">Total Assets</p>
                                                        <p className="text-3xl font-bold text-green-700">
                                                            ₹{(
                                                                financeData.totalSavings +
                                                                financeData.totalFD +
                                                                financeData.totalRecovery +
                                                                financeData.totalYogdan
                                                            ).toLocaleString()}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-gray-600 mb-2">Total Liabilities</p>
                                                        <p className="text-3xl font-bold text-red-700">
                                                            ₹{(
                                                                financeData.totalLoans +
                                                                financeData.totalInterest
                                                            ).toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="mt-4 pt-4 border-t border-gray-300">
                                                    <p className="text-sm text-gray-600 mb-1">Net Balance</p>
                                                    <p className={`text-4xl font-bold ${(financeData.totalSavings + financeData.totalFD + financeData.totalRecovery + financeData.totalYogdan) -
                                                        (financeData.totalLoans + financeData.totalInterest) >= 0
                                                        ? "text-green-700"
                                                        : "text-red-700"
                                                        }`}>
                                                        ₹{(
                                                            (financeData.totalSavings + financeData.totalFD + financeData.totalRecovery + financeData.totalYogdan) -
                                                            (financeData.totalLoans + financeData.totalInterest)
                                                        ).toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                        </>
                                    )}
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

            {/* Bank Detail Modal */}
            {showBankModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
                            <h2 className="text-2xl font-bold text-gray-800">Bank Details</h2>
                            <button
                                onClick={() => {
                                    setShowBankModal(false);
                                    setSelectedBank(null);
                                    setBankTransactions([]);
                                }}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6">
                            {bankDetailLoading ? (
                                <div className="text-center py-12">
                                    <p className="text-gray-600">Loading bank details...</p>
                                </div>
                            ) : selectedBank ? (
                                <>
                                    {/* Bank Information */}
                                    <div className="mb-8">
                                        <h3 className="text-xl font-semibold text-gray-800 mb-4 pb-3 border-b">Bank Information</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            <div className="p-4 bg-gray-50 rounded-lg">
                                                <p className="text-sm text-gray-600 mb-1">Bank Name</p>
                                                <p className="font-semibold text-gray-800">{selectedBank.bank_name || "-"}</p>
                                            </div>
                                            <div className="p-4 bg-gray-50 rounded-lg">
                                                <p className="text-sm text-gray-600 mb-1">Account Number</p>
                                                <p className="font-semibold text-gray-800">{selectedBank.account_no || "-"}</p>
                                            </div>
                                            <div className="p-4 bg-gray-50 rounded-lg">
                                                <p className="text-sm text-gray-600 mb-1">IFSC Code</p>
                                                <p className="font-semibold text-gray-800">{selectedBank.ifsc || "-"}</p>
                                            </div>
                                            <div className="p-4 bg-gray-50 rounded-lg">
                                                <p className="text-sm text-gray-600 mb-1">Branch Name</p>
                                                <p className="font-semibold text-gray-800">{selectedBank.branch_name || "-"}</p>
                                            </div>
                                            <div className="p-4 bg-gray-50 rounded-lg">
                                                <p className="text-sm text-gray-600 mb-1">Account Type</p>
                                                <p className="font-semibold text-gray-800">{selectedBank.account_type || "-"}</p>
                                            </div>
                                            <div className="p-4 bg-gray-50 rounded-lg">
                                                <p className="text-sm text-gray-600 mb-1">Short Name</p>
                                                <p className="font-semibold text-gray-800">{selectedBank.short_name || "-"}</p>
                                            </div>
                                            {selectedBank.ac_open_date && (
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">Account Open Date</p>
                                                    <p className="font-semibold text-gray-800">
                                                        {new Date(selectedBank.ac_open_date).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}
                                                    </p>
                                                </div>
                                            )}
                                            {selectedBank.opening_balance !== undefined && selectedBank.opening_balance !== null && (
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">Opening Balance</p>
                                                    <p className="font-semibold text-gray-800">₹{selectedBank.opening_balance.toLocaleString()}</p>
                                                </div>
                                            )}
                                            {selectedBank.open_bal_curr !== undefined && selectedBank.open_bal_curr !== null && (
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">Current Opening Balance</p>
                                                    <p className="font-semibold text-gray-800">₹{selectedBank.open_bal_curr.toLocaleString()}</p>
                                                </div>
                                            )}
                                            {selectedBank.cc_limit !== undefined && selectedBank.cc_limit !== null && (
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">CC Limit</p>
                                                    <p className="font-semibold text-gray-800">₹{selectedBank.cc_limit.toLocaleString()}</p>
                                                </div>
                                            )}
                                            {selectedBank.dp_limit !== undefined && selectedBank.dp_limit !== null && (
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">DP Limit</p>
                                                    <p className="font-semibold text-gray-800">₹{selectedBank.dp_limit.toLocaleString()}</p>
                                                </div>
                                            )}
                                            {selectedBank.fd_mat_dt && (
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">FD Maturity Date</p>
                                                    <p className="font-semibold text-gray-800">
                                                        {new Date(selectedBank.fd_mat_dt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}
                                                    </p>
                                                </div>
                                            )}
                                            {selectedBank.flg_acclosed && (
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">Account Closed</p>
                                                    <p className="font-semibold text-gray-800">{selectedBank.flg_acclosed}</p>
                                                </div>
                                            )}
                                            {selectedBank.acclosed_dt && (
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">Account Closed Date</p>
                                                    <p className="font-semibold text-gray-800">
                                                        {new Date(selectedBank.acclosed_dt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}
                                                    </p>
                                                </div>
                                            )}
                                            {selectedBank.govt_linked && (
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">Govt Linked</p>
                                                    <p className="font-semibold text-gray-800">{selectedBank.govt_linked}</p>
                                                </div>
                                            )}
                                            {selectedBank.govt_project_type && (
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">Project Type</p>
                                                    <p className="font-semibold text-gray-800">{selectedBank.govt_project_type}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Transactions Table */}
                                    <div>
                                        <h3 className="text-xl font-semibold text-gray-800 mb-4 pb-3 border-b">
                                            Transactions ({bankTransactions.length})
                                        </h3>
                                        {bankTransactions.length > 0 ? (
                                            <div className="overflow-x-auto">
                                                <table className="w-full border-collapse">
                                                    <thead>
                                                        <tr className="bg-gray-100">
                                                            <th className="border p-3 text-left font-semibold text-gray-700">Date</th>
                                                            <th className="border p-3 text-left font-semibold text-gray-700">Type</th>
                                                            <th className="border p-3 text-left font-semibold text-gray-700">Transaction Type</th>
                                                            <th className="border p-3 text-left font-semibold text-gray-700">Member</th>
                                                            <th className="border p-3 text-left font-semibold text-gray-700">Purpose</th>
                                                            <th className="border p-3 text-right font-semibold text-gray-700">Amount</th>
                                                            <th className="border p-3 text-left font-semibold text-gray-700">Payment Mode</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {bankTransactions.map((tx) => (
                                                            <tr key={tx.id} className="hover:bg-gray-50">
                                                                <td className="border p-3 text-gray-800">
                                                                    {tx.date
                                                                        ? new Date(tx.date).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
                                                                        : tx.createdAt
                                                                            ? new Date(tx.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
                                                                            : "-"}
                                                                </td>
                                                                <td className="border p-3 text-gray-800">
                                                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${tx.type === "Loan" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"
                                                                        }`}>
                                                                        {tx.type}
                                                                    </span>
                                                                </td>
                                                                <td className="border p-3 text-gray-800">{tx.transactionType || "-"}</td>
                                                                <td className="border p-3 text-gray-800">
                                                                    {tx.memberName || "-"}
                                                                    {tx.memberCode && <span className="text-xs text-gray-500 ml-1">({tx.memberCode})</span>}
                                                                    {tx.isGroupLoan && <span className="text-xs text-blue-600 ml-1">[Group]</span>}
                                                                </td>
                                                                <td className="border p-3 text-gray-800">{tx.purpose || "-"}</td>
                                                                <td className="border p-3 text-right font-semibold text-gray-800">₹{tx.amount?.toLocaleString() || "0"}</td>
                                                                <td className="border p-3 text-gray-800">{tx.paymentMode || "-"}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr className="bg-gray-100 font-semibold">
                                                            <td colSpan={5} className="border p-3 text-right text-gray-700">Total:</td>
                                                            <td className="border p-3 text-right text-gray-800">
                                                                ₹{bankTransactions.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0).toLocaleString()}
                                                            </td>
                                                            <td className="border p-3"></td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="text-center py-12 bg-gray-50 rounded-lg">
                                                <Banknote size={48} className="mx-auto mb-4 text-gray-400" />
                                                <p className="text-gray-600">No transactions found for this bank account</p>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-12">
                                    <p className="text-gray-600">Bank details not found</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

