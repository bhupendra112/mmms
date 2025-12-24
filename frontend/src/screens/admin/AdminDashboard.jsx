import React, { useState, useEffect } from "react";
import { Building2, Users, Banknote, TrendingUp, Download, FileText } from "lucide-react";
import { getDashboardStatistics } from "../../services/dataManagementService";
import { exportMemberLedger } from "../../services/memberService";
import { exportMemberLedgerToExcel, exportMemberLedgerToPDF } from "../../utils/exportUtils";

export default function AdminDashboard() {
    const [stats, setStats] = useState([
        {
            title: "Total Groups",
            value: "0",
            icon: Building2,
            color: "bg-blue-500",
            change: "+0%",
        },
        {
            title: "Total Members",
            value: "0",
            icon: Users,
            color: "bg-green-500",
            change: "+0%",
        },
        {
            title: "Groups with Bank",
            value: "0",
            icon: Banknote,
            color: "bg-purple-500",
            change: "+0%",
        },
        {
            title: "Active Groups",
            value: "0",
            icon: TrendingUp,
            color: "bg-orange-500",
            change: "+0%",
        },
    ]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [exportLoading, setExportLoading] = useState(false);
    const [dateRange, setDateRange] = useState({ fromDate: "", toDate: "" });

    const handleExportAllMembers = async (format = 'excel') => {
        try {
            setExportLoading(true);
            const filters = {
                fromDate: dateRange.fromDate || undefined,
                toDate: dateRange.toDate || undefined,
            };

            const response = await exportMemberLedger(filters);

            if (response?.success && response?.data && response.data.length > 0) {
                if (format === 'excel') {
                    exportMemberLedgerToExcel(response.data, `All_Members_Ledger_All_Groups`);
                } else {
                    exportMemberLedgerToPDF(response.data, `All_Members_Ledger_All_Groups`);
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
        loadDashboardStats();
    }, []);

    const loadDashboardStats = async () => {
        try {
            setLoading(true);
            setError("");
            const response = await getDashboardStatistics();

            if (response.success && response.data) {
                const data = response.data;

                // Format numbers with Indian locale
                const formatNumber = (num) => {
                    return new Intl.NumberFormat("en-IN").format(num || 0);
                };

                setStats([
                    {
                        title: "Total Groups",
                        value: formatNumber(data.totalGroups),
                        icon: Building2,
                        color: "bg-blue-500",
                        change: data.changes?.groups || "+0%",
                    },
                    {
                        title: "Total Members",
                        value: formatNumber(data.totalMembers),
                        icon: Users,
                        color: "bg-green-500",
                        change: data.changes?.members || "+0%",
                    },
                    {
                        title: "Groups with Bank",
                        value: formatNumber(data.groupsWithBank),
                        icon: Banknote,
                        color: "bg-purple-500",
                        change: data.changes?.groupsWithBank || "+0%",
                    },
                    {
                        title: "Active Groups",
                        value: formatNumber(data.activeGroups),
                        icon: TrendingUp,
                        color: "bg-orange-500",
                        change: data.changes?.activeGroups || "+0%",
                    },
                ]);
            }
        } catch (err) {
            console.error("Error loading dashboard stats:", err);
            setError(err.message || "Failed to load dashboard statistics");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
                <p className="text-gray-600 mt-2">Manage village samooh groups and members</p>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-700">{error}</p>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-gray-600">Loading dashboard statistics...</div>
                </div>
            ) : (
                <>
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        {stats.map((stat, idx) => {
                            const Icon = stat.icon;
                            return (
                                <div
                                    key={idx}
                                    className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500 hover:shadow-lg transition-shadow"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-gray-600 text-sm font-medium">{stat.title}</p>
                                            <p className="text-3xl font-bold text-gray-800 mt-2">{stat.value}</p>
                                            <p className="text-green-600 text-sm mt-1">{stat.change} from last month</p>
                                        </div>
                                        <div className={`${stat.color} p-3 rounded-full`}>
                                            <Icon className="text-white" size={24} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Export All Members Ledger Section */}

                </>
            )}

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <a
                        href="/admin/group-management"
                        className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-center"
                    >
                        <Building2 className="mx-auto mb-2 text-blue-600" size={32} />
                        <p className="font-medium text-gray-700">Group Management</p>
                        <p className="text-xs text-gray-500 mt-1">Manage all groups</p>
                    </a>
                    <a
                        href="/admin/create-group"
                        className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-center"
                    >
                        <Building2 className="mx-auto mb-2 text-gray-400" size={32} />
                        <p className="font-medium text-gray-700">Create New Group</p>
                    </a>
                    <a
                        href="/admin/bank-details"
                        className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-center"
                    >
                        <Banknote className="mx-auto mb-2 text-gray-400" size={32} />
                        <p className="font-medium text-gray-700">Add Bank Details</p>
                    </a>
                    <a
                        href="/admin/members"
                        className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-center"
                    >
                        <Users className="mx-auto mb-2 text-gray-400" size={32} />
                        <p className="font-medium text-gray-700">Manage Members</p>
                    </a>
                </div>
            </div>
        </div>
    );
}

