import React from "react";
import { Users, DollarSign, FileText, TrendingUp } from "lucide-react";
import { useGroup } from "../../contexts/GroupContext";

export default function GroupDashboard() {
    const { currentGroup, isGroupLoading } = useGroup();
    const stats = [
        {
            title: "Total Members",
            value: "45",
            icon: Users,
            color: "bg-green-500",
            change: "+3",
        },
        {
            title: "Total Loans",
            value: "12",
            icon: DollarSign,
            color: "bg-blue-500",
            change: "+2",
        },
        {
            title: "Transactions",
            value: "234",
            icon: FileText,
            color: "bg-purple-500",
            change: "+15",
        },
        {
            title: "Recovery Rate",
            value: "85%",
            icon: TrendingUp,
            color: "bg-orange-500",
            change: "+5%",
        },
    ];

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

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {stats.map((stat, idx) => {
                    const Icon = stat.icon;
                    return (
                        <div
                            key={idx}
                            className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500"
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

