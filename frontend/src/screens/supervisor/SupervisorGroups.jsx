import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { getGroups } from "../../services/groupService";

export default function SupervisorGroups() {
    const [searchParams] = useSearchParams();
    const clusterName = searchParams.get("cluster_name") || "";
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        loadGroups();
    }, []);

    const loadGroups = async () => {
        try {
            setLoading(true);
            setError("");
            const res = await getGroups();
            const data = res?.data ?? res;
            const list = Array.isArray(data) ? data : [];
            setGroups(list);
        } catch (err) {
            setError(err?.message || "Failed to load groups");
            setGroups([]);
        } finally {
            setLoading(false);
        }
    };

    const filteredGroups = clusterName
        ? groups.filter((g) => g.cluster_name === clusterName || g.cluster_code === clusterName)
        : groups;

    if (loading) {
        return (
            <div>
                <h1 className="text-2xl font-bold text-gray-800 mb-6">Groups</h1>
                <p className="text-gray-500">Loading groups...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div>
                <h1 className="text-2xl font-bold text-gray-800 mb-6">Groups</h1>
                <p className="text-red-600">{error}</p>
            </div>
        );
    }

    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Groups</h1>
            {clusterName && (
                <p className="text-gray-600 mb-4">
                    Cluster: <span className="font-medium">{clusterName}</span>
                    {" "}
                    <Link to="/supervisor/groups" className="text-slate-600 text-sm hover:underline">Show all</Link>
                </p>
            )}
            {filteredGroups.length === 0 ? (
                <p className="text-gray-500">No groups found.</p>
            ) : (
                <ul className="space-y-2">
                    {filteredGroups.map((g) => (
                        <li key={g._id || g.id}>
                            <Link
                                to={`/supervisor/group/${g._id || g.id}`}
                                className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-slate-400 hover:shadow transition-colors"
                            >
                                <span className="font-medium text-gray-800">{g.group_name || g.name}</span>
                                <span className="text-gray-500 text-sm ml-2">({g.group_code || g.code})</span>
                                {g.village && <span className="text-gray-400 text-sm ml-2">— {g.village}</span>}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
