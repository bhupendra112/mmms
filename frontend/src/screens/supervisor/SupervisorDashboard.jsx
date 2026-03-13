import React from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { Layers, Users } from "lucide-react";

export default function SupervisorDashboard() {
    const supervisor = useSelector((state) => state.supervisorAuth.supervisor);

    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Supervisor Dashboard</h1>
            <p className="text-gray-600 mb-8">
                Welcome, {supervisor?.name || supervisor?.email}. You can view all clusters and groups in your place ({supervisor?.place || "—"}).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                <Link
                    to="/supervisor/clusters"
                    className="flex items-center gap-4 p-6 bg-white rounded-lg border border-gray-200 shadow-sm hover:border-slate-400 hover:shadow transition-colors"
                >
                    <div className="bg-slate-100 p-3 rounded-lg">
                        <Layers size={32} className="text-slate-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800">View Clusters</h2>
                        <p className="text-sm text-gray-500">Browse clusters in your place</p>
                    </div>
                </Link>
                <Link
                    to="/supervisor/groups"
                    className="flex items-center gap-4 p-6 bg-white rounded-lg border border-gray-200 shadow-sm hover:border-slate-400 hover:shadow transition-colors"
                >
                    <div className="bg-slate-100 p-3 rounded-lg">
                        <Users size={32} className="text-slate-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800">View Groups</h2>
                        <p className="text-sm text-gray-500">Browse all groups in your place</p>
                    </div>
                </Link>
            </div>
        </div>
    );
}
