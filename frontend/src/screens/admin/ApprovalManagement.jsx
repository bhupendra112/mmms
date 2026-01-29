import React, { useState, useEffect, useMemo } from "react";
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
    ArrowLeftRight,
    Receipt,
} from "lucide-react";
import { initApprovalDB, getAllApprovals, approveRequest, rejectRequest, updateApprovalData } from "../../services/approvalDB";
import { getGroups } from "../../services/groupService";
import { getPendingConversions, approveConversion, rejectConversion } from "../../services/cashToBankService";
import { getLoans, approveLoan, rejectLoan } from "../../services/loanService";
import { getPendingMembers, approveMember, rejectMember } from "../../services/memberService";
import { getAllFDs, approveFD, rejectFD } from "../../services/fdService";
import { getRecoveries, approveRecovery, rejectRecovery } from "../../services/recoveryService";
import { getExpenses, approveExpense, rejectExpense } from "../../services/expenseService";
import { getPayments, approvePayment, rejectPayment } from "../../services/paymentService";

export default function ApprovalManagement() {
    const [approvals, setApprovals] = useState([]);
    const [filter, setFilter] = useState("pending"); // pending, approved, rejected, all
    const [groups, setGroups] = useState([]);
    const [selectedGroupId, setSelectedGroupId] = useState(""); // "" means all
    const [selectedClusterKey, setSelectedClusterKey] = useState("");
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
                        clusterName: g.cluster_name || "",
                        clusterCode: g.cluster_code || "",
                    }))
                );
            })
            .catch((e) => {
                console.error("Error loading groups for approvals filter:", e);
                setGroups([]);
            });
    }, []);

    const clusterOptions = useMemo(() => {
        const uniqueClusters = Array.from(
            new Set(groups.map((g) => `${g.clusterName}|${g.clusterCode}`))
        );
        return uniqueClusters.map((key) => {
            const [name, code] = key.split("|");
            return { value: key, label: `${name || "No Name"} (${code || "No Code"})` };
        });
    }, [groups]);

    const groupOptions = useMemo(() => {
        if (!selectedClusterKey) return [];
        const [cName, cCode] = selectedClusterKey.split("|");
        return groups
            .filter((g) => g.clusterName === cName && g.clusterCode === cCode)
            .map((g) => ({ value: g.id, label: `${g.name} ${g.code ? `(${g.code})` : ""}` }));
    }, [groups, selectedClusterKey]);

    const loadApprovals = async () => {
        setLoading(true);
        try {
            await initApprovalDB();
            let allApprovals = await getAllApprovals(selectedGroupId || null);

            // Load CashToBankConversion approvals from backend
            try {
                const cashToBankRes = await getPendingConversions();
                if (cashToBankRes?.success && Array.isArray(cashToBankRes.data)) {
                    const cashToBankApprovals = cashToBankRes.data.map((conversion) => ({
                        id: conversion._id || conversion.id,
                        type: "cash_to_bank", // Keep as cash_to_bank for backward compatibility, but use conversionType from data
                        status: conversion.status || "pending",
                        groupId: conversion.groupId?._id || conversion.groupId || "",
                        groupName: conversion.groupName || conversion.groupId?.group_name || "",
                        data: conversion,
                        conversionType: conversion.conversionType || "cash_to_bank", // Store conversion type
                        submittedAt: conversion.createdAt ? new Date(conversion.createdAt).getTime() : Date.now(),
                        approvedAt: conversion.approvedAt ? new Date(conversion.approvedAt).getTime() : null,
                        approvedBy: conversion.approvedBy || null,
                        rejectionReason: conversion.rejectionReason || null,
                        synced: true, // Backend data is always synced
                        _isBackendApproval: true, // Flag to identify backend approvals
                    }));

                    // Merge with local approvals
                    allApprovals = [...allApprovals, ...cashToBankApprovals];
                }
            } catch (error) {
                console.error("Error loading CashToBank conversions:", error);
                // Continue with local approvals even if backend fails
            }

            // Load Loan approvals from backend
            // Fetch loans based on current filter status (or all if filter is "all")
            try {
                // Determine which status to fetch based on current filter
                // We fetch all loans and filter client-side since the backend list endpoint
                // accepts status as a query param, but we want to show loans in approval context
                const loansRes = await getLoans();
                if (loansRes?.success && Array.isArray(loansRes.data)) {
                    // Transform all loans (we'll filter by status later)
                    const loanApprovals = loansRes.data.map((loan) => ({
                        id: loan._id || loan.id,
                        type: "loan",
                        status: loan.status || "pending",
                        groupId: loan.groupId?._id || loan.groupId || "",
                        groupName: loan.groupName || loan.groupId?.group_name || "",
                        data: loan,
                        submittedAt: loan.createdAt ? new Date(loan.createdAt).getTime() : Date.now(),
                        approvedAt: loan.approvedAt ? new Date(loan.approvedAt).getTime() : null,
                        approvedBy: loan.approvedBy || null,
                        rejectionReason: loan.rejectionReason || null,
                        synced: true, // Backend data is always synced
                        _isBackendApproval: true, // Flag to identify backend approvals
                    }));

                    // Merge with existing approvals
                    allApprovals = [...allApprovals, ...loanApprovals];
                }
            } catch (error) {
                console.error("Error loading loans:", error);
                // Continue with other approvals even if backend fails
            }

            // Load pending members from backend (synced from group, require admin approval)
            try {
                const membersRes = await getPendingMembers();
                if (membersRes?.success && Array.isArray(membersRes.data)) {
                    const memberApprovals = membersRes.data.map((m) => ({
                        id: m._id || m.id,
                        type: "member",
                        status: m.approvalStatus || "pending",
                        groupId: m.group?._id || m.group || "",
                        groupName: m.group?.group_name || "",
                        data: m,
                        submittedAt: m.createdAt ? new Date(m.createdAt).getTime() : Date.now(),
                        approvedAt: null,
                        approvedBy: null,
                        rejectionReason: m.rejectionReason || null,
                        synced: true,
                        _isBackendApproval: true,
                    }));
                    allApprovals = [...allApprovals, ...memberApprovals];
                }
            } catch (error) {
                console.error("Error loading pending members:", error);
            }

            // Load FD approvals from backend
            try {
                const fdsRes = await getAllFDs();
                if (fdsRes?.success && Array.isArray(fdsRes.data)) {
                    const fdApprovals = fdsRes.data.map((fd) => ({
                        id: fd._id || fd.id,
                        type: "fd",
                        status: fd.approvalStatus || "approved", // Default to approved for backward compatibility
                        groupId: fd.groupId?._id || fd.groupId || "",
                        groupName: fd.groupName || fd.groupId?.group_name || "",
                        data: fd,
                        submittedAt: fd.createdAt ? new Date(fd.createdAt).getTime() : Date.now(),
                        approvedAt: fd.approvedAt ? new Date(fd.approvedAt).getTime() : null,
                        approvedBy: fd.approvedBy || null,
                        rejectionReason: fd.rejectionReason || null,
                        synced: true,
                        _isBackendApproval: true,
                    }));

                    // Merge with existing approvals
                    allApprovals = [...allApprovals, ...fdApprovals];
                }
            } catch (error) {
                console.error("Error loading FDs:", error);
                // Continue with other approvals even if backend fails
            }

            // Load Recovery approvals from backend
            try {
                const recoveriesRes = await getRecoveries();

                // #region agent log
                fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'ApprovalManagement.jsx:201', message: 'Loading recoveries for approval', data: { success: recoveriesRes?.success, isArray: Array.isArray(recoveriesRes?.data), totalCount: recoveriesRes?.data?.length || 0, pendingCount: recoveriesRes?.data?.filter((r) => r.approvalStatus === 'pending')?.length || 0 }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H3' }) }).catch(() => { });
                // #endregion

                if (recoveriesRes?.success && Array.isArray(recoveriesRes.data)) {
                    const recoveryApprovals = recoveriesRes.data
                        .filter((recovery) => recovery.approvalStatus === "pending") // Only show pending recoveries
                        .map((recovery) => ({
                            id: recovery._id || recovery.id,
                            type: "recovery",
                            status: recovery.approvalStatus || "approved",
                            groupId: recovery.groupId?._id || recovery.groupId || "",
                            groupName: recovery.groupName || recovery.groupId?.group_name || "",
                            data: recovery,
                            submittedAt: recovery.createdAt ? new Date(recovery.createdAt).getTime() : Date.now(),
                            approvedAt: recovery.approvedAt ? new Date(recovery.approvedAt).getTime() : null,
                            approvedBy: recovery.approvedBy || null,
                            rejectionReason: recovery.rejectionReason || null,
                            synced: true,
                            _isBackendApproval: true,
                        }));

                    // Merge with existing approvals
                    allApprovals = [...allApprovals, ...recoveryApprovals];

                    // Deduplicate recovery approvals: same session can appear as local (approvalDB) + backend (getRecoveries). Keep one per (groupId, date), prefer backend.
                    const recoveryByKey = new Map();
                    allApprovals.forEach((a) => {
                        if (a.type !== "recovery") return;
                        const gid = (a.groupId?._id ?? a.groupId ?? "").toString();
                        const dateStr = a.data?.date ? (typeof a.data.date === "string" ? a.data.date : new Date(a.data.date).toISOString().slice(0, 10)) : "";
                        const key = `${gid}|${dateStr}`;
                        const existing = recoveryByKey.get(key);
                        if (!existing || (a._isBackendApproval && !existing._isBackendApproval)) {
                            recoveryByKey.set(key, a);
                        }
                    });
                    allApprovals = allApprovals.filter((a) => {
                        if (a.type !== "recovery") return true;
                        const gid = (a.groupId?._id ?? a.groupId ?? "").toString();
                        const dateStr = a.data?.date ? (typeof a.data.date === "string" ? a.data.date : new Date(a.data.date).toISOString().slice(0, 10)) : "";
                        return recoveryByKey.get(`${gid}|${dateStr}`) === a;
                    });

                    // #region agent log
                    fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'ApprovalManagement.jsx:221', message: 'Recovery approvals processed', data: { recoveryApprovalsCount: recoveryApprovals.length, totalApprovalsCount: allApprovals.length }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H3' }) }).catch(() => { });
                    // #endregion
                }
            } catch (error) {
                console.error("Error loading recoveries:", error);
                // #region agent log
                fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'ApprovalManagement.jsx:224', message: 'Error loading recoveries', data: { error: error.message, stack: error.stack }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H3' }) }).catch(() => { });
                // #endregion
                // Continue with other approvals even if backend fails
            }

            // Load Expense approvals from backend
            try {
                const expensesRes = await getExpenses();
                if (expensesRes?.success && Array.isArray(expensesRes.data)) {
                    const expenseApprovals = expensesRes.data
                        .filter((expense) => expense.approvalStatus === "pending") // Only show pending expenses
                        .map((expense) => ({
                            id: expense._id || expense.id,
                            type: "expense",
                            status: expense.approvalStatus || "approved",
                            groupId: expense.groupId?._id || expense.groupId || "",
                            groupName: expense.groupName || expense.groupId?.group_name || "",
                            data: expense,
                            submittedAt: expense.createdAt ? new Date(expense.createdAt).getTime() : Date.now(),
                            approvedAt: expense.approvedAt ? new Date(expense.approvedAt).getTime() : null,
                            approvedBy: expense.approvedBy || null,
                            rejectionReason: expense.rejectionReason || null,
                            synced: true,
                            _isBackendApproval: true,
                        }));

                    // Merge with existing approvals
                    allApprovals = [...allApprovals, ...expenseApprovals];
                }
            } catch (error) {
                console.error("Error loading expenses:", error);
                // Continue with other approvals even if backend fails
            }

            // Load Payment approvals from backend
            try {
                const paymentsRes = await getPayments({ status: "pending" });
                if (paymentsRes?.success && Array.isArray(paymentsRes.data)) {
                    const paymentApprovals = paymentsRes.data
                        .filter((payment) => payment.status === "pending") // Only show pending payments
                        .map((payment) => ({
                            id: payment._id || payment.id,
                            type: "payment",
                            status: payment.status || "pending",
                            groupId: payment.groupId?._id || payment.groupId || "",
                            groupName: payment.groupName || payment.groupId?.group_name || "",
                            data: payment,
                            submittedAt: payment.createdAt ? new Date(payment.createdAt).getTime() : Date.now(),
                            approvedAt: payment.approvedAt ? new Date(payment.approvedAt).getTime() : null,
                            approvedBy: payment.approvedBy || null,
                            rejectionReason: payment.rejectionReason || null,
                            synced: true,
                            _isBackendApproval: true,
                        }));

                    // Merge with existing approvals
                    allApprovals = [...allApprovals, ...paymentApprovals];
                }
            } catch (error) {
                console.error("Error loading payments:", error);
                // Continue with other approvals even if backend fails
            }

            // Exclude local (approvalDB) member approvals only; keep backend pending members
            allApprovals = allApprovals.filter((a) => a.type !== "member" || a._isBackendApproval);

            // Filter by group if selected
            if (selectedGroupId) {
                allApprovals = allApprovals.filter((a) => {
                    const approvalGroupId = a.groupId?._id || a.groupId || "";
                    return approvalGroupId === selectedGroupId || approvalGroupId.toString() === selectedGroupId;
                });
            }

            // Filter by status
            if (filter === "pending") {
                allApprovals = allApprovals.filter((a) => a.status === "pending");
            } else if (filter === "approved") {
                allApprovals = allApprovals.filter((a) => a.status === "approved");
            } else if (filter === "rejected") {
                allApprovals = allApprovals.filter((a) => a.status === "rejected");
            }
            // Note: For "all" filter, we keep all approvals (no filtering)

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

    const handleApprove = async (approval) => {
        if (window.confirm("Are you sure you want to approve this request?")) {
            try {
                // Check if this is a backend approval
                if (approval._isBackendApproval) {
                    if (approval.type === "cash_to_bank") {
                        const res = await approveConversion(approval.id);
                        if (res?.success) {
                            const conversionType = approval.conversionType || approval.data?.conversionType;
                            const message = conversionType === "bank_to_bank"
                                ? "Bank to Bank transfer approved successfully!"
                                : "Cash to Bank conversion approved successfully!";
                            alert(message);
                        } else {
                            throw new Error(res?.message || "Failed to approve conversion");
                        }
                    } else if (approval.type === "loan") {
                        const res = await approveLoan(approval.id);
                        if (res?.success) {
                            alert("Loan approved successfully!");
                        } else {
                            throw new Error(res?.message || "Failed to approve loan");
                        }
                    } else if (approval.type === "member") {
                        const res = await approveMember(approval.id);
                        if (res?.success) {
                            alert("Member approved successfully!");
                        } else {
                            throw new Error(res?.message || "Failed to approve member");
                        }
                    } else if (approval.type === "fd") {
                        const res = await approveFD(approval.id);
                        if (res?.success) {
                            alert("FD approved successfully!");
                        } else {
                            throw new Error(res?.message || "Failed to approve FD");
                        }
                    } else if (approval.type === "recovery") {
                        const res = await approveRecovery(approval.id);
                        if (res?.success) {
                            alert("Recovery approved successfully!");
                        } else {
                            throw new Error(res?.message || "Failed to approve recovery");
                        }
                    } else if (approval.type === "expense") {
                        const res = await approveExpense(approval.id);
                        if (res?.success) {
                            alert("Expense approved successfully!");
                        } else {
                            throw new Error(res?.message || "Failed to approve expense");
                        }
                    } else if (approval.type === "payment") {
                        const res = await approvePayment(approval.id);
                        if (res?.success) {
                            alert("Payment approved successfully!");
                        } else {
                            throw new Error(res?.message || "Failed to approve payment");
                        }
                    } else {
                        throw new Error("Unknown approval type");
                    }
                } else {
                    // Local approval (from approvalDB)
                    await approveRequest(approval.id, "Admin User"); // In real app, get from auth
                    alert("Request approved successfully!");
                }
                loadApprovals();
            } catch (error) {
                console.error("Error approving request:", error);
                alert("Error approving request: " + (error.message || error));
            }
        }
    };

    const handleReject = async (approval) => {
        if (!rejectionReason.trim()) {
            alert("Please provide a rejection reason");
            return;
        }
        if (window.confirm("Are you sure you want to reject this request?")) {
            try {
                // Check if this is a backend approval
                if (approval._isBackendApproval) {
                    if (approval.type === "cash_to_bank") {
                        const res = await rejectConversion(approval.id, rejectionReason);
                        if (res?.success) {
                            const conversionType = approval.conversionType || approval.data?.conversionType;
                            const message = conversionType === "bank_to_bank"
                                ? "Bank to Bank transfer rejected successfully!"
                                : "Cash to Bank conversion rejected successfully!";
                            alert(message);
                        } else {
                            throw new Error(res?.message || "Failed to reject conversion");
                        }
                    } else if (approval.type === "loan") {
                        const res = await rejectLoan(approval.id, rejectionReason);
                        if (res?.success) {
                            alert("Loan rejected successfully!");
                        } else {
                            throw new Error(res?.message || "Failed to reject loan");
                        }
                    } else if (approval.type === "member") {
                        const res = await rejectMember(approval.id, rejectionReason);
                        if (res?.success) {
                            alert("Member rejected.");
                        } else {
                            throw new Error(res?.message || "Failed to reject member");
                        }
                    } else if (approval.type === "fd") {
                        const res = await rejectFD(approval.id, rejectionReason);
                        if (res?.success) {
                            alert("FD rejected successfully!");
                        } else {
                            throw new Error(res?.message || "Failed to reject FD");
                        }
                    } else if (approval.type === "recovery") {
                        const res = await rejectRecovery(approval.id, rejectionReason);
                        if (res?.success) {
                            alert("Recovery rejected successfully!");
                        } else {
                            throw new Error(res?.message || "Failed to reject recovery");
                        }
                    } else if (approval.type === "expense") {
                        const res = await rejectExpense(approval.id, rejectionReason);
                        if (res?.success) {
                            alert("Expense rejected successfully!");
                        } else {
                            throw new Error(res?.message || "Failed to reject expense");
                        }
                    } else if (approval.type === "payment") {
                        const res = await rejectPayment(approval.id, rejectionReason);
                        if (res?.success) {
                            alert("Payment rejected successfully!");
                        } else {
                            throw new Error(res?.message || "Failed to reject payment");
                        }
                    } else {
                        throw new Error("Unknown approval type");
                    }
                } else {
                    // Local approval (from approvalDB)
                    // If there are edits, save them first
                    if (isEditing && editedData) {
                        await updateApprovalData(approval.id, editedData);
                        setIsEditing(false);
                        setEditedData(null);
                    }
                    await rejectRequest(approval.id, "Admin User", rejectionReason); // In real app, get from auth
                    alert("Request rejected successfully!");
                }
                setSelectedApproval(null);
                setRejectionReason("");
                loadApprovals();
            } catch (error) {
                console.error("Error rejecting request:", error);
                alert("Error rejecting request: " + (error.message || error));
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
            case "fd":
                return <DollarSign className="text-indigo-600" size={20} />;
            case "expense":
                return <Receipt className="text-red-600" size={20} />;
            case "payment":
                return <DollarSign className="text-teal-600" size={20} />;
            case "cash_to_bank":
                return <ArrowLeftRight className="text-orange-600" size={20} />;
            default:
                return <FileText size={20} />;
        }
    };

    const getTypeLabel = (type, approval = null) => {
        switch (type) {
            case "member":
                return "Add Member";
            case "recovery":
                return "Demand & Recovery";
            case "loan":
                return "Loan Application";
            case "fd":
                return "Fixed Deposit";
            case "expense":
                return "Expense";
            case "payment":
                const paymentType = approval?.data?.paymentType;
                if (paymentType === 'fd_maturity') {
                    return "FD Maturity Payment";
                } else if (paymentType === 'saving_withdrawal') {
                    return "Savings Withdrawal";
                }
                return "Payment";
            case "cash_to_bank":
                // Check if we have conversionType in the approval data
                const conversionType = approval?.conversionType || approval?.data?.conversionType;
                if (conversionType === "bank_to_bank") {
                    return "Bank to Bank Transfer";
                }
                return "Cash to Bank Conversion";
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
        <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6">
            <div className="mb-4 sm:mb-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2 sm:gap-3">
                            <CheckCircle size={24} className="shrink-0 w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" />
                            <span className="truncate">Approval Management</span>
                        </h1>
                        <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">Review and manage approval requests from groups</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <button
                            onClick={loadApprovals}
                            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm w-full sm:w-auto"
                        >
                            <RefreshCw size={16} className="sm:w-[18px] sm:h-[18px]" />
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 md:p-5 mb-4 sm:mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <div className="flex items-center gap-2 shrink-0">
                        <Filter size={18} className="text-gray-600 sm:w-5 sm:h-5" />
                        <span className="font-semibold text-gray-700 text-sm sm:text-base">Filter:</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:flex-wrap md:items-center gap-2 sm:gap-3 md:gap-4 flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                            <span className="text-xs sm:text-sm font-semibold text-gray-700">Cluster:</span>
                            <select
                                value={selectedClusterKey}
                                onChange={(e) => {
                                    setSelectedClusterKey(e.target.value);
                                    setSelectedGroupId("");
                                }}
                                className="w-full sm:min-w-[140px] px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            >
                                <option value="">All Clusters</option>
                                {clusterOptions.map((c) => (
                                    <option key={c.value} value={c.value}>
                                        {c.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                            <span className="text-xs sm:text-sm font-semibold text-gray-700">Group:</span>
                            <select
                                value={selectedGroupId}
                                onChange={(e) => setSelectedGroupId(e.target.value)}
                                className="w-full sm:min-w-[140px] px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                disabled={!selectedClusterKey}
                            >
                                <option value="">All Groups</option>
                                {groupOptions.map((g) => (
                                    <option key={g.value} value={g.value}>
                                        {g.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-wrap gap-1 sm:gap-2 col-span-1 sm:col-span-2 md:col-span-auto">
                            {[
                                { key: "all", label: "All", active: filter === "all", bg: "bg-blue-600" },
                                { key: "pending", label: "Pending", active: filter === "pending", bg: "bg-yellow-600" },
                                { key: "approved", label: "Approved", active: filter === "approved", bg: "bg-green-600" },
                                { key: "rejected", label: "Rejected", active: filter === "rejected", bg: "bg-red-600" },
                            ].map(({ key, label, active, bg }) => (
                                <button
                                    key={key}
                                    onClick={() => setFilter(key)}
                                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-sm transition-colors ${active
                                        ? `${bg} text-white`
                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                        }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Approvals List */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                {loading ? (
                    <div className="p-6 sm:p-8 text-center">
                        <p className="text-gray-600 text-sm sm:text-base">Loading approvals...</p>
                    </div>
                ) : approvals.length === 0 ? (
                    <div className="p-6 sm:p-8 md:p-10 text-center text-gray-500">
                        <div className="flex flex-col items-center gap-2">
                            <p className="text-base sm:text-lg font-medium">No approvals found</p>
                            <p className="text-xs sm:text-sm text-gray-400">
                                {filter === "pending"
                                    ? "There are no pending approval requests at this time."
                                    : filter === "approved"
                                        ? "No approved requests found."
                                        : filter === "rejected"
                                            ? "No rejected requests found."
                                            : "No approvals found in the system."}
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Mobile / Tablet: Card layout */}
                        <div className="block md:hidden divide-y divide-gray-200">
                            {approvals.map((approval) => (
                                <div
                                    key={approval.id}
                                    className="p-3 sm:p-4 hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            {getTypeIcon(approval.type)}
                                            <span className="font-medium text-gray-800 text-sm sm:text-base truncate">
                                                {getTypeLabel(approval.type, approval)}
                                            </span>
                                        </div>
                                        {getStatusBadge(approval.status)}
                                    </div>
                                    {approval.type === "recovery" && approval.data?.totals && (
                                        <p className="text-xs text-gray-500 mb-1">Total: {formatAmount(approval.data.totals.totalAmount)}</p>
                                    )}
                                    {approval.type === "loan" && approval.data?.amount && (
                                        <p className="text-xs text-gray-500 mb-1">Amount: {formatAmount(approval.data.amount)}</p>
                                    )}
                                    {approval.type === "fd" && approval.data?.amount && (
                                        <p className="text-xs text-gray-500 mb-1">Amount: {formatAmount(approval.data.amount)} | Period: {approval.data?.time_period ? `${(approval.data.time_period / 12).toFixed(1)} years` : '-'}</p>
                                    )}
                                    {approval.type === "expense" && approval.data?.amount && (
                                        <p className="text-xs text-gray-500 mb-1">Amount: {formatAmount(approval.data.amount)} | Type: {approval.data.expenseType || 'N/A'}</p>
                                    )}
                                    {approval.type === "payment" && approval.data?.amount && (
                                        <p className="text-xs text-gray-500 mb-1">Amount: {formatAmount(approval.data.amount)} | Type: {approval.data.paymentType === 'fd_maturity' ? 'FD Maturity' : approval.data.paymentType === 'saving_withdrawal' ? 'Savings Withdrawal' : approval.data.paymentType || 'N/A'}</p>
                                    )}
                                    {approval.type === "cash_to_bank" && approval.data?.totalCashAmount && (
                                        <p className="text-xs text-gray-500 mb-1">Amount: {formatAmount(approval.data.totalCashAmount)}</p>
                                    )}
                                    <p className="text-xs sm:text-sm text-gray-600 mb-1">
                                        <span className="font-medium text-gray-700">Group:</span> {approval.groupName || "Group"}
                                    </p>
                                    <p className="text-xs text-gray-500 mb-3">{formatDate(approval.submittedAt)}</p>
                                    <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                        <button
                                            onClick={() => setSelectedApproval(approval)}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="View Details"
                                        >
                                            <Eye size={16} className="sm:w-[18px] sm:h-[18px]" />
                                        </button>
                                        {approval.status === "pending" && (
                                            <>
                                                <button
                                                    onClick={() => handleApprove(approval)}
                                                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                    title="Approve"
                                                >
                                                    <CheckCircle size={16} className="sm:w-[18px] sm:h-[18px]" />
                                                </button>
                                                <button
                                                    onClick={() => setSelectedApproval(approval)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Reject"
                                                >
                                                    <XCircle size={16} className="sm:w-[18px] sm:h-[18px]" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop: Table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="min-w-[640px] w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="border border-gray-200 p-2 lg:p-3 text-left text-xs lg:text-sm font-semibold text-gray-700">Type</th>
                                        <th className="border border-gray-200 p-2 lg:p-3 text-left text-xs lg:text-sm font-semibold text-gray-700">Group</th>
                                        <th className="border border-gray-200 p-2 lg:p-3 text-left text-xs lg:text-sm font-semibold text-gray-700">Submitted</th>
                                        <th className="border border-gray-200 p-2 lg:p-3 text-center text-xs lg:text-sm font-semibold text-gray-700">Status</th>
                                        <th className="border border-gray-200 p-2 lg:p-3 text-left text-xs lg:text-sm font-semibold text-gray-700">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {approvals.map((approval) => (
                                        <tr key={approval.id} className="hover:bg-gray-50">
                                            <td className="border border-gray-200 p-2 lg:p-3">
                                                <div className="flex items-center gap-2">
                                                    {getTypeIcon(approval.type)}
                                                    <span className="font-medium text-gray-800 text-sm">
                                                        {getTypeLabel(approval.type, approval)}
                                                    </span>
                                                </div>
                                                {approval.type === "recovery" && approval.data?.totals && (
                                                    <p className="text-xs text-gray-500 mt-1">Total: {formatAmount(approval.data.totals.totalAmount)}</p>
                                                )}
                                                {approval.type === "loan" && approval.data?.amount && (
                                                    <p className="text-xs text-gray-500 mt-1">Amount: {formatAmount(approval.data.amount)}</p>
                                                )}
                                                {approval.type === "fd" && approval.data?.amount && (
                                                    <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                                                        <p>Amount: {formatAmount(approval.data.amount)}</p>
                                                        <p>Time Period: {approval.data?.time_period ? `${(approval.data.time_period / 12).toFixed(1)} years` : '-'}</p>
                                                        <p>FD Rate: {approval.data?.fd_rate_snapshot ? `${approval.data.fd_rate_snapshot}%` : '-'}</p>
                                                        {approval.data?.maturityAmount && (
                                                            <p>Maturity Amount: {formatAmount(approval.data.maturityAmount)}</p>
                                                        )}
                                                    </div>
                                                )}
                                                {approval.type === "expense" && approval.data?.amount && (
                                                    <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                                                        <p>Amount: {formatAmount(approval.data.amount)}</p>
                                                        <p>Type: {approval.data.expenseType || 'N/A'}</p>
                                                        <p>Payment Mode: {approval.data.paymentMode || 'N/A'}</p>
                                                        {approval.data.purpose && (
                                                            <p>Purpose: {approval.data.purpose}</p>
                                                        )}
                                                    </div>
                                                )}
                                                {approval.type === "payment" && approval.data?.amount && (
                                                    <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                                                        <p>Amount: {formatAmount(approval.data.amount)}</p>
                                                        <p>Type: {approval.data.paymentType === 'fd_maturity' ? 'FD Maturity' : approval.data.paymentType === 'saving_withdrawal' ? 'Savings Withdrawal' : approval.data.paymentType || 'N/A'}</p>
                                                        <p>Payment Mode: {approval.data.paymentMode || 'N/A'}</p>
                                                        {approval.data.memberName && (
                                                            <p>Member: {approval.data.memberName} ({approval.data.memberCode})</p>
                                                        )}
                                                    </div>
                                                )}
                                                {approval.type === "cash_to_bank" && approval.data?.totalCashAmount && (
                                                    <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                                                        <p>Amount: {formatAmount(approval.data.totalCashAmount)}</p>
                                                        {approval.data?.conversionType === "bank_to_bank" ? (
                                                            <>
                                                                {approval.data?.fromBankName && (
                                                                    <p>From: {approval.data.fromBankName} - {approval.data.fromAccountNumber}</p>
                                                                )}
                                                                {approval.data?.bankName && (
                                                                    <p>To: {approval.data.bankName} - {approval.data.accountNumber}</p>
                                                                )}
                                                            </>
                                                        ) : (
                                                            approval.data?.bankName && (
                                                                <p>Bank: {approval.data.bankName} - {approval.data.accountNumber}</p>
                                                            )
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="border border-gray-200 p-2 lg:p-3">
                                                <p className="font-medium text-gray-800 text-sm">{approval.groupName || "Group"}</p>
                                                <p className="text-xs text-gray-600">ID: {approval.groupId}</p>
                                            </td>
                                            <td className="border border-gray-200 p-2 lg:p-3 text-gray-600 text-sm whitespace-nowrap">{formatDate(approval.submittedAt)}</td>
                                            <td className="border border-gray-200 p-2 lg:p-3 text-center">{getStatusBadge(approval.status)}</td>
                                            <td className="border border-gray-200 p-2 lg:p-3">
                                                <div className="flex items-center gap-1 lg:gap-2">
                                                    <button
                                                        onClick={() => setSelectedApproval(approval)}
                                                        className="p-1.5 lg:p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="View Details"
                                                    >
                                                        <Eye size={16} className="lg:w-[18px] lg:h-[18px]" />
                                                    </button>
                                                    {approval.status === "pending" && (
                                                        <>
                                                            <button
                                                                onClick={() => handleApprove(approval)}
                                                                className="p-1.5 lg:p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                                title="Approve"
                                                            >
                                                                <CheckCircle size={16} className="lg:w-[18px] lg:h-[18px]" />
                                                            </button>
                                                            <button
                                                                onClick={() => setSelectedApproval(approval)}
                                                                className="p-1.5 lg:p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Reject"
                                                            >
                                                                <XCircle size={16} className="lg:w-[18px] lg:h-[18px]" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {/* Approval Detail Modal */}
            {selectedApproval && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto my-4 sm:my-0">
                        <div className="p-4 sm:p-5 md:p-6 border-b sticky top-0 bg-white z-10">
                            <div className="flex items-start sm:items-center justify-between gap-3">
                                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 min-w-0 flex-1 truncate">
                                    Approval Details - {selectedApproval.type.toUpperCase()}
                                    {isEditing && (
                                        <span className="ml-2 sm:ml-3 text-xs sm:text-sm font-normal text-orange-600">(Editing)</span>
                                    )}
                                </h2>
                                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                                    {selectedApproval.status === "pending" && !isEditing && (
                                        <button
                                            onClick={handleEdit}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="Edit"
                                        >
                                            <Edit size={18} className="sm:w-5 sm:h-5" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                            setSelectedApproval(null);
                                            setRejectionReason("");
                                            setIsEditing(false);
                                            setEditedData(null);
                                        }}
                                        className="text-gray-500 hover:text-gray-700 p-1.5 sm:p-2"
                                    >
                                        <X size={20} className="sm:w-6 sm:h-6" />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 sm:p-5 md:p-6">
                            <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                                <div>
                                    <p className="text-xs sm:text-sm font-semibold text-gray-600">Group</p>
                                    <p className="text-sm sm:text-base text-gray-800 break-words">{selectedApproval.groupName} ({selectedApproval.groupId})</p>
                                </div>
                                <div>
                                    <p className="text-xs sm:text-sm font-semibold text-gray-600">Status</p>
                                    <div className="mt-1">{getStatusBadge(selectedApproval.status)}</div>
                                </div>
                                <div>
                                    <p className="text-xs sm:text-sm font-semibold text-gray-600">Submitted At</p>
                                    <p className="text-sm sm:text-base text-gray-800">{formatDate(selectedApproval.submittedAt)}</p>
                                </div>
                                {selectedApproval.approvedAt && (
                                    <div>
                                        <p className="text-xs sm:text-sm font-semibold text-gray-600">
                                            {selectedApproval.status === "approved" ? "Approved" : "Rejected"} At
                                        </p>
                                        <p className="text-sm sm:text-base text-gray-800">{formatDate(selectedApproval.approvedAt)}</p>
                                    </div>
                                )}
                                {selectedApproval.rejectionReason && (
                                    <div>
                                        <p className="text-xs sm:text-sm font-semibold text-gray-600">Rejection Reason</p>
                                        <p className="text-sm sm:text-base text-gray-800 break-words">{selectedApproval.rejectionReason}</p>
                                    </div>
                                )}
                            </div>

                            {/* Approval Dashboard based on type */}
                            <div className="border-t pt-4">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                                    <p className="text-sm font-semibold text-gray-600">Approval Details</p>
                                    {selectedApproval.status === "pending" && !isEditing && (
                                        <button
                                            onClick={handleEdit}
                                            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm w-full sm:w-auto"
                                        >
                                            <Edit size={16} />
                                            Edit
                                        </button>
                                    )}
                                    {isEditing && (
                                        <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:w-auto">
                                            <button
                                                onClick={handleCancelEdit}
                                                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm w-full sm:w-auto"
                                            >
                                                <X size={16} />
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleSaveEdit}
                                                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm w-full sm:w-auto"
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
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                                                        <div className="p-3 sm:p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
                                                            <p className="text-xs sm:text-sm text-gray-600">Total Cash</p>
                                                            {isEditing ? (
                                                                <input
                                                                    type="number"
                                                                    value={data.totals?.totalCash || 0}
                                                                    onChange={(e) => {
                                                                        const newData = JSON.parse(JSON.stringify(data));
                                                                        if (!newData.totals) newData.totals = {};
                                                                        newData.totals.totalCash = parseFloat(e.target.value) || 0;
                                                                        newData.totals.totalAmount = (newData.totals.totalCash || 0) + (newData.totals.totalOnline || 0);
                                                                        setEditedData(newData);
                                                                    }}
                                                                    className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-lg sm:text-2xl font-bold"
                                                                />
                                                            ) : (
                                                                <p className="text-xl sm:text-2xl font-bold text-gray-800">{formatAmount(data.totals?.totalCash)}</p>
                                                            )}
                                                        </div>
                                                        <div className="p-3 sm:p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                                                            <p className="text-xs sm:text-sm text-gray-600">Total Online</p>
                                                            {isEditing ? (
                                                                <input
                                                                    type="number"
                                                                    value={data.totals?.totalOnline || 0}
                                                                    onChange={(e) => {
                                                                        const newData = JSON.parse(JSON.stringify(data));
                                                                        if (!newData.totals) newData.totals = {};
                                                                        newData.totals.totalOnline = parseFloat(e.target.value) || 0;
                                                                        newData.totals.totalAmount = (newData.totals.totalCash || 0) + (newData.totals.totalOnline || 0);
                                                                        setEditedData(newData);
                                                                    }}
                                                                    className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-lg sm:text-2xl font-bold"
                                                                />
                                                            ) : (
                                                                <p className="text-xl sm:text-2xl font-bold text-gray-800">{formatAmount(data.totals?.totalOnline)}</p>
                                                            )}
                                                        </div>
                                                        <div className="p-3 sm:p-4 bg-purple-50 rounded-lg border-l-4 border-purple-500 sm:col-span-2 md:col-span-1">
                                                            <p className="text-xs sm:text-sm text-gray-600">Grand Total</p>
                                                            <p className="text-xl sm:text-2xl font-bold text-gray-800">
                                                                {formatAmount(data.totals?.totalAmount || ((data.totals?.totalCash || 0) + (data.totals?.totalOnline || 0)))}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                                                        <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">Meeting Information</p>
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
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                                        <div className="p-3 sm:p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                                                            <p className="text-xs sm:text-sm text-gray-600">Loan Amount</p>
                                                            {isEditing ? (
                                                                <input
                                                                    type="number"
                                                                    value={data.amount || 0}
                                                                    onChange={(e) => updateEditedField("amount", parseFloat(e.target.value) || 0)}
                                                                    className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-lg sm:text-2xl font-bold"
                                                                />
                                                            ) : (
                                                                <p className="text-xl sm:text-2xl font-bold text-gray-800">{formatAmount(data.amount)}</p>
                                                            )}
                                                        </div>
                                                        <div className="p-3 sm:p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
                                                            <p className="text-xs sm:text-sm text-gray-600">Has Assets</p>
                                                            {isEditing ? (
                                                                <select
                                                                    value={data.hasAssets ? "yes" : "no"}
                                                                    onChange={(e) => updateEditedField("hasAssets", e.target.value === "yes")}
                                                                    className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-lg sm:text-2xl font-bold"
                                                                >
                                                                    <option value="yes">Yes</option>
                                                                    <option value="no">No</option>
                                                                </select>
                                                            ) : (
                                                                <p className="text-xl sm:text-2xl font-bold text-gray-800">{data.hasAssets ? "Yes" : "No"}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="p-3 sm:p-4 bg-gray-50 rounded-lg space-y-2">
                                                        <p className="text-xs sm:text-sm font-semibold text-gray-700">Loan Details</p>
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
                                                <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">Bachan Pathra Photo</p>
                                                    <img
                                                        src={data.bachanPathraPhoto}
                                                        alt="Bachan Pathra"
                                                        className="max-w-full h-auto rounded-lg border-2 border-gray-300 w-full"
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
                                                <div className="p-3 sm:p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                                                    <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">Member Information</p>
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

                                {/* Cash to Bank Conversion Dashboard */}
                                {selectedApproval.type === "cash_to_bank" && selectedApproval.data && (
                                    <div className="space-y-4">
                                        {(() => {
                                            const data = selectedApproval.data;
                                            const conversionType = data.conversionType || "cash_to_bank";
                                            return (
                                                <>
                                                    <div className={`grid gap-3 sm:gap-4 ${conversionType === "bank_to_bank" ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
                                                        <div className="p-3 sm:p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
                                                            <p className="text-xs sm:text-sm text-gray-600">Amount</p>
                                                            <p className="text-xl sm:text-2xl font-bold text-gray-800">{formatAmount(data.totalCashAmount)}</p>
                                                        </div>
                                                        {conversionType === "bank_to_bank" && (
                                                            <div className="p-3 sm:p-4 bg-red-50 rounded-lg border-l-4 border-red-500">
                                                                <p className="text-xs sm:text-sm text-gray-600">From Bank Account</p>
                                                                <p className="text-base sm:text-lg font-bold text-gray-800">{data.fromBankName || "N/A"}</p>
                                                                <p className="text-xs sm:text-sm text-gray-600 mt-1">{data.fromAccountNumber || "N/A"}</p>
                                                            </div>
                                                        )}
                                                        <div className="p-3 sm:p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                                                            <p className="text-xs sm:text-sm text-gray-600">
                                                                {conversionType === "bank_to_bank" ? "To Bank Account" : "Bank Account"}
                                                            </p>
                                                            <p className="text-base sm:text-lg font-bold text-gray-800">{data.bankName || "N/A"}</p>
                                                            <p className="text-xs sm:text-sm text-gray-600 mt-1">{data.accountNumber || "N/A"}</p>
                                                        </div>
                                                    </div>
                                                    <div className="p-3 sm:p-4 bg-gray-50 rounded-lg space-y-2">
                                                        <p className="text-xs sm:text-sm font-semibold text-gray-700">Conversion Details</p>
                                                        <p className="text-gray-600">
                                                            <span className="font-medium">Type:</span> {conversionType === "bank_to_bank" ? "Bank to Bank Transfer" : "Cash to Bank Conversion"}
                                                        </p>
                                                        <p className="text-gray-600">
                                                            <span className="font-medium">Group:</span> {data.groupName} ({data.groupCode || "N/A"})
                                                        </p>
                                                        {data.onlineRef && (
                                                            <p className="text-gray-600">
                                                                <span className="font-medium">Online Reference:</span> {data.onlineRef}
                                                            </p>
                                                        )}
                                                        {data.recoveryDate && (
                                                            <p className="text-gray-600">
                                                                <span className="font-medium">Recovery Date:</span> {new Date(data.recoveryDate).toLocaleDateString("en-GB")}
                                                            </p>
                                                        )}
                                                        {data.conversionDetails && data.conversionDetails.length > 0 && (
                                                            <div className="mt-2">
                                                                <p className="text-sm font-semibold text-gray-700 mb-1">Member Details:</p>
                                                                <div className="max-h-40 overflow-y-auto">
                                                                    {data.conversionDetails.map((detail, idx) => (
                                                                        <p key={idx} className="text-xs text-gray-600">
                                                                            {detail.memberName} ({detail.memberCode}): {formatAmount(detail.cashAmount)}
                                                                        </p>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {data.paymentImage && (
                                                        <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                                                            <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">Payment Receipt</p>
                                                            <img
                                                                src={data.paymentImage.startsWith('http') ? data.paymentImage : `${import.meta.env.VITE_BASE_URL?.replace('/api', '') || 'http://localhost:8080'}${data.paymentImage}`}
                                                                alt="Payment Receipt"
                                                                className="max-w-full h-auto rounded-lg border-2 border-gray-300 w-full"
                                                            />
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* Expense Dashboard */}
                                {selectedApproval.type === "expense" && selectedApproval.data && (
                                    <div className="space-y-4">
                                        {(() => {
                                            const data = selectedApproval.data;
                                            return (
                                                <>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                                        <div className="p-3 sm:p-4 bg-red-50 rounded-lg border-l-4 border-red-500">
                                                            <p className="text-xs sm:text-sm text-gray-600">Amount</p>
                                                            <p className="text-xl sm:text-2xl font-bold text-gray-800">{formatAmount(data.amount)}</p>
                                                        </div>
                                                        <div className="p-3 sm:p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                                                            <p className="text-xs sm:text-sm text-gray-600">Payment Mode</p>
                                                            <p className="text-base sm:text-lg font-bold text-gray-800">{data.paymentMode || "N/A"}</p>
                                                        </div>
                                                    </div>
                                                    <div className="p-3 sm:p-4 bg-gray-50 rounded-lg space-y-2">
                                                        <p className="text-xs sm:text-sm font-semibold text-gray-700">Expense Details</p>
                                                        <p className="text-gray-600">
                                                            <span className="font-medium">Type:</span> {data.expenseType || "N/A"}
                                                        </p>
                                                        <p className="text-gray-600">
                                                            <span className="font-medium">Entry Type:</span> {data.entryType || "expense"}
                                                        </p>
                                                        <p className="text-gray-600">
                                                            <span className="font-medium">Date:</span> {data.date ? new Date(data.date).toLocaleDateString("en-GB") : "N/A"}
                                                        </p>
                                                        {data.purpose && (
                                                            <p className="text-gray-600">
                                                                <span className="font-medium">Purpose:</span> {data.purpose}
                                                            </p>
                                                        )}
                                                        {data.bankId && (
                                                            <p className="text-gray-600">
                                                                <span className="font-medium">Bank ID:</span> {data.bankId?._id || data.bankId}
                                                            </p>
                                                        )}
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* Payment Dashboard */}
                                {selectedApproval.type === "payment" && selectedApproval.data && (
                                    <div className="space-y-4">
                                        {(() => {
                                            const data = selectedApproval.data;
                                            return (
                                                <>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                                        <div className="p-3 sm:p-4 bg-teal-50 rounded-lg border-l-4 border-teal-500">
                                                            <p className="text-xs sm:text-sm text-gray-600">Amount</p>
                                                            <p className="text-xl sm:text-2xl font-bold text-gray-800">{formatAmount(data.amount)}</p>
                                                        </div>
                                                        <div className="p-3 sm:p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                                                            <p className="text-xs sm:text-sm text-gray-600">Payment Mode</p>
                                                            <p className="text-base sm:text-lg font-bold text-gray-800">{data.paymentMode || "N/A"}</p>
                                                        </div>
                                                    </div>
                                                    <div className="p-3 sm:p-4 bg-gray-50 rounded-lg space-y-2">
                                                        <p className="text-xs sm:text-sm font-semibold text-gray-700">Payment Details</p>
                                                        <p className="text-gray-600">
                                                            <span className="font-medium">Type:</span> {data.paymentType === 'fd_maturity' ? 'FD Maturity' : data.paymentType === 'saving_withdrawal' ? 'Savings Withdrawal' : data.paymentType || "N/A"}
                                                        </p>
                                                        {data.memberName && (
                                                            <p className="text-gray-600">
                                                                <span className="font-medium">Member:</span> {data.memberName} ({data.memberCode})
                                                            </p>
                                                        )}
                                                        <p className="text-gray-600">
                                                            <span className="font-medium">Date:</span> {data.paymentDate ? new Date(data.paymentDate).toLocaleDateString("en-GB") : "N/A"}
                                                        </p>
                                                        {data.bankName && (
                                                            <p className="text-gray-600">
                                                                <span className="font-medium">Bank:</span> {data.bankName} {data.accountNo ? `(${data.accountNo})` : ''}
                                                            </p>
                                                        )}
                                                        {data.remarks && (
                                                            <p className="text-gray-600">
                                                                <span className="font-medium">Remarks:</span> {data.remarks}
                                                            </p>
                                                        )}
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* Fallback for other types */}
                                {!["recovery", "loan", "member", "cash_to_bank", "expense", "payment"].includes(selectedApproval.type) && (
                                    <div className="border-t pt-4">
                                        <p className="text-xs sm:text-sm font-semibold text-gray-600 mb-2">Request Data</p>
                                        <pre className="bg-gray-50 p-3 sm:p-4 rounded-lg overflow-x-auto text-xs sm:text-sm max-w-full">
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
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm min-h-[80px]"
                                            rows={3}
                                            placeholder="Enter reason for rejection..."
                                        />
                                    </div>
                                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-4">
                                        <button
                                            onClick={() => {
                                                setSelectedApproval(null);
                                                setRejectionReason("");
                                                setIsEditing(false);
                                                setEditedData(null);
                                            }}
                                            className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => handleReject(selectedApproval)}
                                            className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm"
                                        >
                                            Reject
                                        </button>
                                        <button
                                            onClick={() => handleApprove(selectedApproval)}
                                            className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
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

