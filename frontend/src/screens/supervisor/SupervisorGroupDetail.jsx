import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getGroupDetail } from "../../services/groupService";

export default function SupervisorGroupDetail() {
    const { groupId } = useParams();
    const [group, setGroup] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (groupId) loadDetail();
    }, [groupId]);

    const loadDetail = async () => {
        try {
            setLoading(true);
            setError("");
            const res = await getGroupDetail(groupId);
            const data = res?.data ?? res;
            setGroup(data);
        } catch (err) {
            setError(err?.message || "Failed to load group");
            setGroup(null);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div>
                <h1 className="text-2xl font-bold text-gray-800 mb-6">Group Detail</h1>
                <p className="text-gray-500">Loading...</p>
            </div>
        );
    }

    if (error || !group) {
        return (
            <div>
                <h1 className="text-2xl font-bold text-gray-800 mb-6">Group Detail</h1>
                <p className="text-red-600">{error || "Group not found."}</p>
                <Link to="/supervisor/groups" className="mt-4 inline-block text-slate-600 hover:underline">Back to groups</Link>
            </div>
        );
    }

    const name = group.group_name || group.name;
    const code = group.group_code || group.code;

    return (
        <div>
            <div className="mb-6">
                <Link to="/supervisor/groups" className="text-slate-600 hover:underline text-sm">Back to groups</Link>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-6">{name}</h1>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <dl className="divide-y divide-gray-200">
                    <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                        <dt className="text-sm font-medium text-gray-500">Group code</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">{code}</dd>
                    </div>
                    <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                        <dt className="text-sm font-medium text-gray-500">Place</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">{group.place || "—"}</dd>
                    </div>
                    <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                        <dt className="text-sm font-medium text-gray-500">Village</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">{group.village || "—"}</dd>
                    </div>
                    <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                        <dt className="text-sm font-medium text-gray-500">Cluster</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">{group.cluster_name || group.cluster_code || "—"}</dd>
                    </div>
                    <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                        <dt className="text-sm font-medium text-gray-500">Members</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">{group.memberCount ?? group.no_members ?? "—"}</dd>
                    </div>
                </dl>
            </div>
        </div>
    );
}
