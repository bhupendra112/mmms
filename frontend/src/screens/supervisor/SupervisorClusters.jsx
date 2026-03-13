import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getClusters } from "../../services/groupService";

export default function SupervisorClusters() {
    const [clusters, setClusters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        loadClusters();
    }, []);

    const loadClusters = async () => {
        try {
            setLoading(true);
            setError("");
            const res = await getClusters();
            const data = res?.data ?? res;
            setClusters(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err?.message || "Failed to load clusters");
            setClusters([]);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div>
                <h1 className="text-2xl font-bold text-gray-800 mb-6">Clusters</h1>
                <p className="text-gray-500">Loading clusters...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div>
                <h1 className="text-2xl font-bold text-gray-800 mb-6">Clusters</h1>
                <p className="text-red-600">{error}</p>
            </div>
        );
    }

    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Clusters</h1>
            {clusters.length === 0 ? (
                <p className="text-gray-500">No clusters found in your place.</p>
            ) : (
                <ul className="space-y-2">
                    {clusters.map((c, i) => (
                        <li key={c.cluster_name ?? c.cluster_code ?? i}>
                            <Link
                                to={`/supervisor/groups?cluster_name=${encodeURIComponent(c.cluster_name || c.cluster_code || "")}`}
                                className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-slate-400 hover:shadow transition-colors"
                            >
                                <span className="font-medium text-gray-800">{c.cluster_name || c.cluster_code || "Unnamed"}</span>
                                {c.cluster_code && c.cluster_code !== c.cluster_name && (
                                    <span className="text-gray-500 text-sm ml-2">({c.cluster_code})</span>
                                )}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
