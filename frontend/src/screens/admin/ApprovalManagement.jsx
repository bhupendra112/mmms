import React, { useState, useEffect } from "react";
import {
    CheckCircle,
    XCircle,
    Clock,
    User,
    DollarSign,
    FileText,
    Eye,
    RefreshCw,
    Filter,
    Edit,
    Save,
    X,
} from "lucide-react";
import { initApprovalDB, getAllApprovals, approveRequest, rejectRequest, updateApprovalData } from "../../services/approvalDB";
import { getGroups } from "../../services/groupService";

export default function ApprovalManagement() {
    const [approvals, setApprovals] = useState([]);
    const [filter, setFilter] = useState("pending"); // pending, approved, rejected, all
    const [groups, setGroups] = useState([]);
    const [selectedGroupId, setSelectedGroupId] = useState(""); // "" means all
    const [selectedApproval, setSelectedApproval] = useState(null);
    const [rejectionReason, setRejectionReason] = useState("");
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editedData, setEditedData] = useState(null);

    useEffect(() => {
        loadApprovals();
    }, [filter, selectedGroupId]);

    useEffect(() => {
        // Load groups for filtering (admin can view approvals across all groups)
        getGroups()
            .then((res) => {
                const list = Array.isArray(res?.data) ? res.data : [];
                setGroups(
                    list.map((g) => ({
                        id: g._id,
                        name: g.group_name,
                        code: g.group_code,
                    }))
                );
            })
            .catch((e) => {
                console.error("Error loading groups for approvals filter:", e);
                setGroups([]);
            });
    }, []);

    const loadApprovals = async () => {
        setLoading(true);
        try {
            await initApprovalDB();
            let allApprovals = await getAllApprovals(selectedGroupId || null);

            if (filter === "pending") {
                allApprovals = allApprovals.filter((a) => a.status === "pending");
            } else if (filter === "approved") {
                allApprovals = allApprovals.filter((a) => a.status === "approved");
            } else if (filter === "rejected") {
                allApprovals = allApprovals.filter((a) => a.status === "rejected");
            }

            // Sort by submitted date (newest first)
            allApprovals.sort((a, b) => b.submittedAt - a.submittedAt);
            setApprovals(allApprovals);
        } catch (error) {
            console.error("Error loading approvals:", error);
            alert("Error loading approvals: " + error.message);
            setApprovals([]);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id) => {
        if (window.confirm("Are you sure you want to approve this request?")) {
            try {
                await approveRequest(id, "Admin User"); // In real app, get from auth
                alert("Request approved successfully!");
                loadApprovals();
            } catch (error) {
                console.error("Error approving request:", error);
                alert("Error approving request");
            }
        }
    };

    const handleReject = async (id) => {
        if (!rejectionReason.trim()) {
            alert("Please provide a rejection reason");
            return;
        }
        if (window.confirm("Are you sure you want to reject this request?")) {
            try {
                // If there are edits, save them first
                if (isEditing && editedData) {
                    await updateApprovalData(id, editedData);
                    setIsEditing(false);
                    setEditedData(null);
                }
                await rejectRequest(id, "Admin User", rejectionReason); // In real app, get from auth
                alert("Request rejected successfully!");
                setSelectedApproval(null);
                setRejectionReason("");
                loadApprovals();
            } catch (error) {
                console.error("Error rejecting request:", error);
                alert("Error rejecting request");
            }
        }
    };

    const handleEdit = () => {
        if (selectedApproval) {
            setIsEditing(true);
            setEditedData(JSON.parse(JSON.stringify(selectedApproval.data))); // Deep copy
        }
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditedData(null);
    };

    const handleSaveEdit = async () => {
        if (!selectedApproval || !editedData) return;

        try {
            await updateApprovalData(selectedApproval.id, editedData);
            // Reload the approval to get updated data
            const updatedApprovals = await getAllApprovals();
            const updated = updatedApprovals.find(a => a.id === selectedApproval.id);
            if (updated) {
                setSelectedApproval(updated);
            }
            setIsEditing(false);
            alert("Changes saved successfully!");
        } catch (error) {
            console.error("Error saving edits:", error);
            alert("Error saving changes");
        }
    };

    const updateEditedField = (path, value) => {
        if (!editedData) return;

        const keys = path.split('.');
        const newData = JSON.parse(JSON.stringify(editedData));
        let current = newData;

        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }

        current[keys[keys.length - 1]] = value;
        setEditedData(newData);
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case "member":
                return <User className="text-blue-600" size={20} />;
            case "recovery":
                return <DollarSign className="text-green-600" size={20} />;
            case "loan":
                return <FileText className="text-purple-600" size={20} />;
            default:
                return <FileText size={20} />;
        }
    };

    const getTypeLabel = (type) => {
        switch (type) {
            case "member":
                return "Add Member";
            case "recovery":
                return "Demand & Recovery";
            case "loan":
                return "Loan Application";
            default:
                return type;
        }
    };

    const formatAmount = (amount) => {
        return `₹${parseFloat(amount || 0).toLocaleString('en-IN')}`;
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case "pending":
                return (
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium flex items-center gap-1">
                        <Clock size={12} />
                        Pending
                    </span>
                );
            case "approved":
                return (
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium flex items-center gap-1">
                        <CheckCircle size={12} />
                        Approved
                    </span>
                );
            case "rejected":
                return (
                    <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium flex items-center gap-1">
                        <XCircle size={12} />
                        Rejected
                    </span>
                );
            default:
                return null;
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return "-";
        const date = new Date(timestamp);
        return date.toLocaleDateString("en-GB") + " " + date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    };

    return (
        <div className="max-w-7xl mx-auto">
            <div className="mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                            <CheckCircle size={32} />
                            Approval Management
                        </h1>
                        <p className="text-gray-600 mt-2">Review and manage approval requests from groups</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={loadApprovals}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                        >
                            <RefreshCw size={18} />
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-md p-4 mb-6">
                <div className="flex items-center gap-4 flex-wrap">
                    <Filter size={20} className="text-gray-600" />
                    <span className="font-semibold text-gray-700">Filter:</span>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-700">Group:</span>
                        <select
                            value={selectedGroupId}
                            onChange={(e) => setSelectedGroupId(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                            <option value="">All Groups</option>
                            {groups.map((g) => (
                                <option key={g.id} value={g.id}>
                                    {g.name} {g.code ? `(${g.code})` : ""}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={() => setFilter("all")}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === "all"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilter("pending")}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === "pending"
                            ? "bg-yellow-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                    >
                        Pending
                    </button>
                    <button
                        onClick={() => setFilter("approved")}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === "approved"
                            ? "bg-green-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                    >
                        Approved
                    </button>
                    <button
                        onClick={() => setFilter("rejected")}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === "rejected"
                            ? "bg-red-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                    >
                        Rejected
                    </button>
                </div>
            </div>

            {/* Approvals List */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center">
                        <p className="text-gray-600">Loading approvals...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border p-3 text-left font-semibold text-gray-700">Type</th>
                                    <th className="border p-3 text-left font-semibold text-gray-700">Group</th>
                                    <th className="border p-3 text-left font-semibold text-gray-700">Submitted</th>
                                    <th className="border p-3 text-center font-semibold text-gray-700">Status</th>
                                    <th className="border p-3 text-left font-semibold text-gray-700">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {approvals.length > 0 ? (
                                    approvals.map((approval) => (
                                        <tr key={approval.id} className="hover:bg-gray-50">
                                            <td className="border p-3">
                                                <div className="flex items-center gap-2">
                                                    {getTypeIcon(approval.type)}
                                                    <span className="font-medium text-gray-800">
                                                        {getTypeLabel(approval.type)}
                                                    </span>
                                                </div>
                                                {/* Show summary for recovery */}
                                                {approval.type === "recovery" && approval.data?.totals && (
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Total: {formatAmount(approval.data.totals.totalAmount)}
                                                    </p>
                                                )}
                                                {/* Show summary for loan */}
                                                {approval.type === "loan" && approval.data?.amount && (
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Amount: {formatAmount(approval.data.amount)}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="border p-3">
                                                <div>
                                                    <p className="font-medium text-gray-800">{approval.groupName || "Group"}</p>
                                                    <p className="text-sm text-gray-600">ID: {approval.groupId}</p>
                                                </div>
                                            </td>
                                            <td className="border p-3 text-gray-600">{formatDate(approval.submittedAt)}</td>
                                            <td className="border p-3 text-center">{getStatusBadge(approval.status)}</td>
                                            <td className="border p-3">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => setSelectedApproval(approval)}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="View Details"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                    {approval.status === "pending" && (
                                                        <>
                                                            <button
                                                                onClick={() => handleApprove(approval.id)}
                                                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                                title="Approve"
                                                            >
                                                                <CheckCircle size={18} />
                                                            </button>
                                                            <button
                                                                onClick={() => setSelectedApproval(approval)}
                                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Reject"
                                                            >
                                                                <XCircle size={18} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="border p-8 text-center text-gray-500">
                                            <div className="flex flex-col items-center gap-2">
                                                <p className="text-lg font-medium">No approvals found</p>
                                                <p className="text-sm text-gray-400">
                                                    {filter === "pending"
                                                        ? "There are no pending approval requests at this time."
                                                        : filter === "approved"
                                                            ? "No approved requests found."
                                                            : filter === "rejected"
                                                                ? "No rejected requests found."
                                                                : "No approvals found in the system."}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Approval Detail Modal */}
            {selectedApproval && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-gray-800">
                                    Approval Details - {selectedApproval.type.toUpperCase()}
                                    {isEditing && (
                                        <span className="ml-3 text-sm font-normal text-orange-600">(Editing)</span>
                                    )}
                                </h2>
                                <div className="flex items-center gap-2">
                                    {selectedApproval.status === "pending" && !isEditing && (
                                        <button
                                            onClick={handleEdit}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="Edit"
                                        >
                                            <Edit size={20} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                            setSelectedApproval(null);
                                            setRejectionReason("");
                                            setIsEditing(false);
                                            setEditedData(null);
                                        }}
                                        className="text-gray-500 hover:text-gray-700"
                                    >
                                        <X size={24} />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="space-y-4 mb-6">
                                <div>
                                    <p className="text-sm font-semibold text-gray-600">Group</p>
                                    <p className="text-gray-800">{selectedApproval.groupName} ({selectedApproval.groupId})</p>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-600">Status</p>
                                    <div className="mt-1">{getStatusBadge(selectedApproval.status)}</div>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-600">Submitted At</p>
                                    <p className="text-gray-800">{formatDate(selectedApproval.submittedAt)}</p>
                                </div>
                                {selectedApproval.approvedAt && (
                                    <div>
                                        <p className="text-sm font-semibold text-gray-600">
                                            {selectedApproval.status === "approved" ? "Approved" : "Rejected"} At
                                        </p>
                                        <p className="text-gray-800">{formatDate(selectedApproval.approvedAt)}</p>
                                    </div>
                                )}
                                {selectedApproval.rejectionReason && (
                                    <div>
                                        <p className="text-sm font-semibold text-gray-600">Rejection Reason</p>
                                        <p className="text-gray-800">{selectedApproval.rejectionReason}</p>
                                    </div>
                                )}
                            </div>

                            {/* Approval Dashboard based on type */}
                            <div className="border-t pt-4">
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-sm font-semibold text-gray-600">Approval Details</p>
                                    {selectedApproval.status === "pending" && !isEditing && (
                                        <button
                                            onClick={handleEdit}
                                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
                                        >
                                            <Edit size={16} />
                                            Edit
                                        </button>
                                    )}
                                    {isEditing && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleCancelEdit}
                                                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm"
                                            >
                                                <X size={16} />
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleSaveEdit}
                                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
                                            >
                                                <Save size={16} />
                                                Save Changes
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Recovery Dashboard */}
                                {selectedApproval.type === "recovery" && (isEditing ? editedData : selectedApproval.data) && (
                                    <div className="space-y-4">
                                        {(() => {
                                            const data = isEditing ? editedData : selectedApproval.data;
                                            return (
                                                <>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        <div className="p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
                                                            <p className="text-sm text-gray-600">Total Cash</p>
                                                            {isEditing ? (
                                                                <input
                                                                    type="number"
                                                                    value={data.totals?.totalCash || 0}
                                                                    onChange={(e) => {
                                                                        const newData = JSON.parse(JSON.stringify(data));
                                                                        if (!newData.totals) newData.totals = {};
                                                                        newData.totals.totalCash = parseFloat(e.target.value) || 0;
                                                                        // Recalculate totalAmount
                                                                        newData.totals.totalAmount = (newData.totals.totalCash || 0) + (newData.totals.totalOnline || 0);
                                                                        setEditedData(newData);
                                                                    }}
                                                                    className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-2xl font-bold"
                                                                />
                                                            ) : (
                                                                <p className="text-2xl font-bold text-gray-800">
                                                                    {formatAmount(data.totals?.totalCash)}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                                                            <p className="text-sm text-gray-600">Total Online</p>
                                                            {isEditing ? (
                                                                <input
                                                                    type="number"
                                                                    value={data.totals?.totalOnline || 0}
                                                                    onChange={(e) => {
                                                                        const newData = JSON.parse(JSON.stringify(data));
                                                                        if (!newData.totals) newData.totals = {};
                                                                        newData.totals.totalOnline = parseFloat(e.target.value) || 0;
                                                                        // Recalculate totalAmount
                                                                        newData.totals.totalAmount = (newData.totals.totalCash || 0) + (newData.totals.totalOnline || 0);
                                                                        setEditedData(newData);
                                                                    }}
                                                                    className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-2xl font-bold"
                                                                />
                                                            ) : (
                                                                <p className="text-2xl font-bold text-gray-800">
                                                                    {formatAmount(data.totals?.totalOnline)}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="p-4 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                                                            <p className="text-sm text-gray-600">Grand Total</p>
                                                            <p className="text-2xl font-bold text-gray-800">
                                                                {formatAmount(data.totals?.totalAmount || ((data.totals?.totalCash || 0) + (data.totals?.totalOnline || 0)))}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="p-4 bg-gray-50 rounded-lg">
                                                        <p className="text-sm font-semibold text-gray-700 mb-2">Meeting Information</p>
                                                        {isEditing ? (
                                                            <div className="space-y-2">
                                                                <input
                                                                    type="text"
                                                                    value={data.date || ""}
                                                                    onChange={(e) => updateEditedField("date", e.target.value)}
                                                                    placeholder="Date"
                                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                                />
                                                                <input
                                                                    type="number"
                                                                    value={data.memberCount || 0}
                                                                    onChange={(e) => updateEditedField("memberCount", parseInt(e.target.value) || 0)}
                                                                    placeholder="Member Count"
                                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <p className="text-gray-600">Date: {data.date}</p>
                                                                <p className="text-gray-600">Members Processed: {data.memberCount}</p>
                                                            </>
                                                        )}
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* Loan Dashboard */}
                                {selectedApproval.type === "loan" && (isEditing ? editedData : selectedApproval.data) && (
                                    <div className="space-y-4">
                                        {(() => {
                                            const data = isEditing ? editedData : selectedApproval.data;
                                            return (
                                                <>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                                                            <p className="text-sm text-gray-600">Loan Amount</p>
                                                            {isEditing ? (
                                                                <input
                                                                    type="number"
                                                                    value={data.amount || 0}
                                                                    onChange={(e) => updateEditedField("amount", parseFloat(e.target.value) || 0)}
                                                                    className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-2xl font-bold"
                                                                />
                                                            ) : (
                                                                <p className="text-2xl font-bold text-gray-800">
                                                                    {formatAmount(data.amount)}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
                                                            <p className="text-sm text-gray-600">Has Assets</p>
                                                            {isEditing ? (
                                                                <select
                                                                    value={data.hasAssets ? "yes" : "no"}
                                                                    onChange={(e) => updateEditedField("hasAssets", e.target.value === "yes")}
                                                                    className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-2xl font-bold"
                                                                >
                                                                    <option value="yes">Yes</option>
                                                                    <option value="no">No</option>
                                                                </select>
                                                            ) : (
                                                                <p className="text-2xl font-bold text-gray-800">
                                                                    {data.hasAssets ? "Yes" : "No"}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                                                        <p className="text-sm font-semibold text-gray-700">Loan Details</p>
                                                        {isEditing ? (
                                                            <div className="space-y-3">
                                                                <input
                                                                    type="text"
                                                                    value={data.memberName || ""}
                                                                    onChange={(e) => updateEditedField("memberName", e.target.value)}
                                                                    placeholder="Member Name"
                                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                                />
                                                                <input
                                                                    type="text"
                                                                    value={data.memberCode || ""}
                                                                    onChange={(e) => updateEditedField("memberCode", e.target.value)}
                                                                    placeholder="Member Code"
                                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                                />
                                                                <select
                                                                    value={data.transactionType || ""}
                                                                    onChange={(e) => updateEditedField("transactionType", e.target.value)}
                                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                                >
                                                                    <option value="">Select Transaction Type</option>
                                                                    <option value="Loan">Loan</option>
                                                                    <option value="Saving">Saving</option>
                                                                    <option value="FD">FD</option>
                                                                    <option value="Deposit">Deposit</option>
                                                                    <option value="Expense">Expense</option>
                                                                    <option value="Other">Other</option>
                                                                </select>
                                                                <select
                                                                    value={data.paymentMode || ""}
                                                                    onChange={(e) => updateEditedField("paymentMode", e.target.value)}
                                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                                >
                                                                    <option value="">Select Payment Mode</option>
                                                                    <option value="Cash">Cash</option>
                                                                    <option value="Bank">Bank</option>
                                                                </select>
                                                                <textarea
                                                                    value={data.purpose || ""}
                                                                    onChange={(e) => updateEditedField("purpose", e.target.value)}
                                                                    placeholder="Purpose"
                                                                    rows={3}
                                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                                />
                                                                <input
                                                                    type="text"
                                                                    value={data.date || ""}
                                                                    onChange={(e) => updateEditedField("date", e.target.value)}
                                                                    placeholder="Date"
                                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <p className="text-gray-600">
                                                                    <span className="font-medium">Member:</span> {data.memberName || "Group Loan"} ({data.memberCode || "N/A"})
                                                                </p>
                                                                <p className="text-gray-600">
                                                                    <span className="font-medium">Transaction Type:</span> {data.transactionType}
                                                                </p>
                                                                <p className="text-gray-600">
                                                                    <span className="font-medium">Payment Mode:</span> {data.paymentMode}
                                                                </p>
                                                                <p className="text-gray-600">
                                                                    <span className="font-medium">Purpose:</span> {data.purpose}
                                                                </p>
                                                                <p className="text-gray-600">
                                                                    <span className="font-medium">Date:</span> {data.date}
                                                                </p>
                                                            </>
                                                        )}
                                                    </div>
                                                </>
                                            );
                                        })()}
                                        {(() => {
                                            const data = isEditing ? editedData : selectedApproval.data;
                                            return data.bachanPathraPhoto && (
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm font-semibold text-gray-700 mb-2">Bachan Pathra Photo</p>
                                                    <img
                                                        src={data.bachanPathraPhoto}
                                                        alt="Bachan Pathra"
                                                        className="max-w-full h-auto rounded-lg border-2 border-gray-300"
                                                    />
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* Member Dashboard */}
                                {selectedApproval.type === "member" && (isEditing ? editedData : selectedApproval.data) && (
                                    <div className="space-y-4">
                                        {(() => {
                                            const data = isEditing ? editedData : selectedApproval.data;
                                            return (
                                                <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                                                    <p className="text-sm font-semibold text-gray-700 mb-2">Member Information</p>
                                                    {isEditing ? (
                                                        <div className="space-y-3">
                                                            <input
                                                                type="text"
                                                                value={data.Member_Nm || data.name || ""}
                                                                onChange={(e) => {
                                                                    const newData = JSON.parse(JSON.stringify(data));
                                                                    newData.Member_Nm = e.target.value;
                                                                    newData.name = e.target.value;
                                                                    setEditedData(newData);
                                                                }}
                                                                placeholder="Member Name"
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={data.Member_Id || data.memberId || ""}
                                                                onChange={(e) => {
                                                                    const newData = JSON.parse(JSON.stringify(data));
                                                                    newData.Member_Id = e.target.value;
                                                                    newData.memberId = e.target.value;
                                                                    setEditedData(newData);
                                                                }}
                                                                placeholder="Member ID"
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={data.F_H_Name || data.fatherName || ""}
                                                                onChange={(e) => {
                                                                    const newData = JSON.parse(JSON.stringify(data));
                                                                    newData.F_H_Name = e.target.value;
                                                                    newData.fatherName = e.target.value;
                                                                    setEditedData(newData);
                                                                }}
                                                                placeholder="Father/Husband Name"
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={data.Village || data.village || ""}
                                                                onChange={(e) => {
                                                                    const newData = JSON.parse(JSON.stringify(data));
                                                                    newData.Village = e.target.value;
                                                                    newData.village = e.target.value;
                                                                    setEditedData(newData);
                                                                }}
                                                                placeholder="Village"
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={data.Dt_Join || data.joinDate || ""}
                                                                onChange={(e) => {
                                                                    const newData = JSON.parse(JSON.stringify(data));
                                                                    newData.Dt_Join = e.target.value;
                                                                    newData.joinDate = e.target.value;
                                                                    setEditedData(newData);
                                                                }}
                                                                placeholder="Join Date"
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-2 text-sm">
                                                            <p className="text-gray-600">
                                                                <span className="font-medium">Name:</span> {data.Member_Nm || data.name}
                                                            </p>
                                                            <p className="text-gray-600">
                                                                <span className="font-medium">Member ID:</span> {data.Member_Id || data.memberId}
                                                            </p>
                                                            <p className="text-gray-600">
                                                                <span className="font-medium">Father/Husband Name:</span> {data.F_H_Name || data.fatherName}
                                                            </p>
                                                            <p className="text-gray-600">
                                                                <span className="font-medium">Village:</span> {data.Village || data.village}
                                                            </p>
                                                            <p className="text-gray-600">
                                                                <span className="font-medium">Join Date:</span> {data.Dt_Join || data.joinDate}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* Fallback for other types */}
                                {!["recovery", "loan", "member"].includes(selectedApproval.type) && (
                                    <div className="border-t pt-4">
                                        <p className="text-sm font-semibold text-gray-600 mb-2">Request Data</p>
                                        <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm">
                                            {JSON.stringify(selectedApproval.data, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>

                            {selectedApproval.status === "pending" && !isEditing && (
                                <div className="mt-6 border-t pt-4">
                                    <div className="mb-4">
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Rejection Reason (if rejecting)
                                        </label>
                                        <textarea
                                            value={rejectionReason}
                                            onChange={(e) => setRejectionReason(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            rows={3}
                                            placeholder="Enter reason for rejection..."
                                        />
                                    </div>
                                    <div className="flex justify-end gap-4">
                                        <button
                                            onClick={() => {
                                                setSelectedApproval(null);
                                                setRejectionReason("");
                                                setIsEditing(false);
                                                setEditedData(null);
                                            }}
                                            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => handleReject(selectedApproval.id)}
                                            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                                        >
                                            Reject
                                        </button>
                                        <button
                                            onClick={() => handleApprove(selectedApproval.id)}
                                            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                                        >
                                            Approve
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

