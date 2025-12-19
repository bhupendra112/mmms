import React from "react";
import { Building2, Users, Banknote, TrendingUp } from "lucide-react";

export default function AdminDashboard() {
    const stats = [
        {
            title: "Total Groups",
            value: "24",
            icon: Building2,
            color: "bg-blue-500",
            change: "+12%",
        },
        {
            title: "Total Members",
            value: "1,234",
            icon: Users,
            color: "bg-green-500",
            change: "+8%",
        },
        {
            title: "Groups with Bank",
            value: "18",
            icon: Banknote,
            color: "bg-purple-500",
            change: "+5%",
        },
        {
            title: "Active Groups",
            value: "22",
            icon: TrendingUp,
            color: "bg-orange-500",
            change: "+15%",
        },
    ];

    return (
        <div className="max-w-7xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
                <p className="text-gray-600 mt-2">Manage village samooh groups and members</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {stats.map((stat, idx) => {
                    const Icon = stat.icon;
                    return (
                        <div
                            key={idx}
                            className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500"
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

