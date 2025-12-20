import React, { useState, useEffect } from "react";
import { Users, DollarSign, FileText, TrendingUp } from "lucide-react";
import { useGroup } from "../../contexts/GroupContext";
import { getMembersByGroup } from "../../services/memberService";
import { getLoans } from "../../services/loanService";
import { getRecoveries } from "../../services/recoveryService";

export default function GroupDashboard() {
    const { currentGroup, isGroupLoading } = useGroup();
    const [stats, setStats] = useState([
        {
            title: "Total Members",
            value: "0",
            icon: Users,
            color: "bg-green-500",
            change: "+0",
        },
        {
            title: "Total Loans",
            value: "0",
            icon: DollarSign,
            color: "bg-blue-500",
            change: "+0",
        },
        {
            title: "Transactions",
            value: "0",
            icon: FileText,
            color: "bg-purple-500",
            change: "+0",
        },
        {
            title: "Recovery Rate",
            value: "0%",
            icon: TrendingUp,
            color: "bg-orange-500",
            change: "+0%",
        },
    ]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (currentGroup?.id) {
            loadDashboardStats();
        } else if (!isGroupLoading) {
            setLoading(false);
        }
    }, [currentGroup, isGroupLoading]);

    const loadDashboardStats = async () => {
        try {
            setLoading(true);
            setError("");

            const [membersRes, loansRes, recoveriesRes] = await Promise.all([
                getMembersByGroup(currentGroup.id).catch(() => ({ success: false, data: [] })),
                getLoans(currentGroup.id).catch(() => ({ success: false, data: [] })),
                getRecoveries(currentGroup.id).catch(() => ({ success: false, data: [] })),
            ]);

            // Calculate total members
            const members = membersRes?.data || [];
            const totalMembers = Array.isArray(members) ? members.length : 0;

            // Calculate total loans (only loan transactions)
            const loans = loansRes?.data || [];
            const totalLoans = Array.isArray(loans)
                ? loans.filter(loan => loan.transactionType === "Loan").length
                : 0;

            // Calculate total transactions (recovery sessions)
            const recoveries = recoveriesRes?.data || [];
            const totalTransactions = Array.isArray(recoveries) ? recoveries.length : 0;

            // Calculate recovery rate
            // Recovery rate = (members with at least one recovery / total members) * 100
            let membersWithRecovery = 0;
            const memberRecoverySet = new Set();

            if (Array.isArray(recoveries)) {
                recoveries.forEach(recovery => {
                    if (recovery.recoveries && Array.isArray(recovery.recoveries)) {
                        recovery.recoveries.forEach(memberRecovery => {
                            const memberId = memberRecovery.memberId || memberRecovery.memberCode;
                            if (memberId) {
                                memberRecoverySet.add(memberId);
                            }
                        });
                    }
                });
                membersWithRecovery = memberRecoverySet.size;
            }

            const recoveryRate = totalMembers > 0
                ? Math.round((membersWithRecovery / totalMembers) * 100)
                : 0;

            // Format numbers
            const formatNumber = (num) => {
                return new Intl.NumberFormat("en-IN").format(num || 0);
            };

            setStats([
                {
                    title: "Total Members",
                    value: formatNumber(totalMembers),
                    icon: Users,
                    color: "bg-green-500",
                    change: "+0", // Can be enhanced with historical comparison
                },
                {
                    title: "Total Loans",
                    value: formatNumber(totalLoans),
                    icon: DollarSign,
                    color: "bg-blue-500",
                    change: "+0",
                },
                {
                    title: "Transactions",
                    value: formatNumber(totalTransactions),
                    icon: FileText,
                    color: "bg-purple-500",
                    change: "+0",
                },
                {
                    title: "Recovery Rate",
                    value: `${recoveryRate}%`,
                    icon: TrendingUp,
                    color: "bg-orange-500",
                    change: "+0%",
                },
            ]);
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
                <h1 className="text-3xl font-bold text-gray-800">Group Dashboard</h1>
                <p className="text-gray-600 mt-2">
                    {isGroupLoading
                        ? "Loading group…"
                        : currentGroup
                            ? `Manage ${currentGroup.name}${currentGroup.village ? ` (${currentGroup.village})` : ""}`
                            : "Manage your village samooh group"}
                </p>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-700">{error}</p>
                </div>
            )}

            {loading || isGroupLoading ? (
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
                                    className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500 hover:shadow-lg transition-shadow"
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
                </>
            )}

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <a
                        href="/group/members"
                        className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors text-center"
                    >
                        <Users className="mx-auto mb-2 text-gray-400" size={32} />
                        <p className="font-medium text-gray-700">Manage Members</p>
                    </a>
                    <a
                        href="/group/demand-recovery"
                        className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors text-center"
                    >
                        <DollarSign className="mx-auto mb-2 text-gray-400" size={32} />
                        <p className="font-medium text-gray-700">Demand & Recovery</p>
                    </a>
                    <a
                        href="/group/ledger"
                        className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors text-center"
                    >
                        <FileText className="mx-auto mb-2 text-gray-400" size={32} />
                        <p className="font-medium text-gray-700">Group Ledger</p>
                    </a>
                    <a
                        href="/group/loans"
                        className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors text-center"
                    >
                        <DollarSign className="mx-auto mb-2 text-gray-400" size={32} />
                        <p className="font-medium text-gray-700">Loan Management</p>
                    </a>
                </div>
            </div>
        </div>
    );
}

