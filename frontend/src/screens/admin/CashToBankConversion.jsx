import React, { useState, useEffect, useMemo } from "react";
import {
    Building2,
    DollarSign,
    Upload,
    CheckCircle,
    XCircle,
    Clock,
    Search,
    Eye,
    FileText,
    Banknote,
    Wallet,
    CreditCard,
    LayoutGrid,
} from "lucide-react";
import { useAdmin } from "../../contexts/AdminContext";
import { useGroup } from "../../contexts/GroupContext";
import { getGroups, getGroupBanks } from "../../services/groupService";
import { getRecoveries } from "../../services/recoveryService";
import { getCashAmount } from "../../services/cashAmount";
import {
    createConversion,
    getConversions,
    getPendingConversions,
    approveConversion,
    rejectConversion,
} from "../../services/cashToBankService";
import { Select, Input } from "../../components/forms/FormComponents";

export default function CashToBankConversion() {
    const { admin } = useAdmin();
    const { currentGroup, isGroupPanel } = useGroup();
    const isAdminMode = !isGroupPanel;

    // State
    const [groups, setGroups] = useState([]);
    const [selectedCluster, setSelectedCluster] = useState(null); // { name, code }
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [recoveries, setRecoveries] = useState([]);
    const [recoveriesWithCash, setRecoveriesWithCash] = useState([]);
    const [totalCashAmount, setTotalCashAmount] = useState(0);
    const [groupBanks, setGroupBanks] = useState([]);
    const [groupCashBalance, setGroupCashBalance] = useState(0);
    const [loading, setLoading] = useState(false);
    const [conversions, setConversions] = useState([]);
    const [pendingConversions, setPendingConversions] = useState([]);
    const [activeTab, setActiveTab] = useState("create"); // "create" or "approve"

    // Form state
    const [formData, setFormData] = useState({
        amount: "",
        bankId: "",
        onlineRef: "",
        paymentImage: null,
    });
    const [rejectionReason, setRejectionReason] = useState("");
    const [selectedConversion, setSelectedConversion] = useState(null);

    // Load groups (admin only)
    useEffect(() => {
        if (isAdminMode) {
            getGroups()
                .then((res) => {
                    const list = Array.isArray(res?.data) ? res.data : [];
                    setGroups(list.map(g => ({
                        ...g,
                        id: g._id,
                        cluster_name: g.cluster_name || "",
                        cluster_code: g.cluster_code || "",
                    })));
                })
                .catch((err) => {
                    console.error("Failed to load groups:", err);
                });
        } else {
            // Group panel - use current group
            if (currentGroup) {
                setSelectedGroup({
                    _id: currentGroup.id,
                    group_name: currentGroup.name,
                    group_code: currentGroup.code,
                });
            }
        }
    }, [isAdminMode, currentGroup]);

    // Load recoveries when group is selected
    useEffect(() => {
        if (!selectedGroup?._id) return;

        setLoading(true);
        getRecoveries(selectedGroup._id)
            .then((res) => {
                const recoveryList = Array.isArray(res?.data) ? res.data : [];
                setRecoveries(recoveryList);

                // Filter recoveries with cash payments
                const withCash = recoveryList.filter((recovery) => {
                    if (!recovery.recoveries || !Array.isArray(recovery.recoveries)) return false;
                    return recovery.recoveries.some(
                        (memberRecovery) => memberRecovery.paymentMode?.cash === true
                    );
                });
                setRecoveriesWithCash(withCash);

                // Calculate total cash amount across all sessions
                let total = 0;
                withCash.forEach((recovery) => {
                    total += calculateCashAmount(recovery);
                });
                setTotalCashAmount(total);
            })
            .catch((err) => {
                console.error("Failed to load recoveries:", err);
            })
            .finally(() => setLoading(false));
    }, [selectedGroup]);

    // Load group banks and cash balance when group is selected
    useEffect(() => {
        if (!selectedGroup?._id) return;

        getGroupBanks(selectedGroup._id)
            .then((res) => {
                const banks = Array.isArray(res?.data) ? res.data : [];
                setGroupBanks(banks);
            })
            .catch((err) => {
                console.error("Failed to load banks:", err);
            });

        // Load cash balance
        getCashAmount(selectedGroup._id)
            .then((res) => {
                const balance = res?.data?.groupCashBalance || res?.data?.cashAmount || 0;
                setGroupCashBalance(balance);
            })
            .catch((err) => {
                console.error("Failed to load cash balance:", err);
                setGroupCashBalance(0);
            });
    }, [selectedGroup]);

    // Load conversions
    useEffect(() => {
        if (!selectedGroup?._id) return;

        getConversions(selectedGroup._id)
            .then((res) => {
                const list = Array.isArray(res?.data) ? res.data : [];
                setConversions(list);
                // Check if there's an active conversion for this group
                const activeConversion = list.find(
                    (c) => c.status === "pending" || c.status === "approved"
                );
                if (activeConversion) {
                    // Reload recoveries to show updated status
                    getRecoveries(selectedGroup._id)
                        .then((response) => {
                            const recoveryList = Array.isArray(response?.data) ? response.data : [];
                            const withCash = recoveryList.filter((recovery) => {
                                if (!recovery.recoveries || !Array.isArray(recovery.recoveries)) return false;
                                return recovery.recoveries.some(
                                    (memberRecovery) => memberRecovery.paymentMode?.cash === true
                                );
                            });
                            setRecoveriesWithCash(withCash);
                            let total = 0;
                            withCash.forEach((recovery) => {
                                total += calculateCashAmount(recovery);
                            });
                            setTotalCashAmount(total);
                        });
                }
            })
            .catch((err) => {
                console.error("Failed to load conversions:", err);
            });
    }, [selectedGroup]);

    // Load pending conversions (admin only)
    useEffect(() => {
        if (isAdminMode && activeTab === "approve") {
            getPendingConversions()
                .then((res) => {
                    const list = Array.isArray(res?.data) ? res.data : [];
                    setPendingConversions(list);
                })
                .catch((err) => {
                    console.error("Failed to load pending conversions:", err);
                });
        }
    }, [isAdminMode, activeTab]);

    const filteredGroups = useMemo(() => {
        if (!selectedCluster || !isAdminMode) return [];
        return groups.filter(
            (g) => g.cluster_name === selectedCluster.name && g.cluster_code === selectedCluster.code
        );
    }, [groups, selectedCluster, isAdminMode]);

    // Calculate total cash amount for a recovery
    const calculateCashAmount = (recovery) => {
        if (!recovery.recoveries || !Array.isArray(recovery.recoveries)) return 0;
        return recovery.recoveries.reduce((sum, memberRecovery) => {
            if (memberRecovery.paymentMode?.cash === true) {
                return sum + (parseFloat(memberRecovery.total || 0) || 0);
            }
            return sum;
        }, 0);
    };

    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toLocaleDateString("en-GB");
    };

    // Handle form submit
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedGroup || !formData.bankId) {
            alert("Please select a group and bank account");
            return;
        }

        // Validate amount
        const conversionAmount = parseFloat(formData.amount);
        if (!formData.amount || isNaN(conversionAmount) || conversionAmount <= 0) {
            alert("Please enter a valid conversion amount (must be greater than 0)");
            return;
        }

        // Validate cash balance
        if (groupCashBalance < conversionAmount) {
            alert(`Insufficient cash balance. Available: ₹${groupCashBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, Required: ₹${conversionAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
            return;
        }

        // Validate payment image
        if (!formData.paymentImage) {
            alert("Please upload a screenshot/payment image");
            return;
        }

        // Validate bank balance
        const selectedBank = groupBanks.find(b => (b._id || b.id) === formData.bankId);
        if (selectedBank) {
            const availableBalance = selectedBank.available_balance !== undefined
                ? selectedBank.available_balance
                : (selectedBank.current_balance !== undefined
                    ? selectedBank.current_balance
                    : (selectedBank.opening_balance || 0));

            // For cash to bank conversion, we're adding money to bank, so we don't need to check if bank has enough
            // But we can show a warning if bank balance is negative or very low
            if (availableBalance < 0) {
                if (!window.confirm(`Warning: Selected bank has negative balance (₹${availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}). Do you want to continue?`)) {
                    return;
                }
            }
        }

        if (!window.confirm(`Are you sure you want to convert ₹${conversionAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} from cash to bank payment?`)) {
            return;
        }

        setLoading(true);
        try {
            const conversionData = {
                groupId: selectedGroup._id,
                amount: conversionAmount,
                bankId: formData.bankId,
                onlineRef: formData.onlineRef || null,
                paymentImage: formData.paymentImage,
                isAdmin: isAdminMode,
            };

            const res = await createConversion(conversionData);
            if (res.success) {
                alert("Conversion request created successfully!");
                // Reset form
                setFormData({ amount: "", bankId: "", onlineRef: "", paymentImage: null });
                // Reload conversions and recoveries
                getConversions(selectedGroup._id)
                    .then((response) => {
                        const list = Array.isArray(response?.data) ? response.data : [];
                        setConversions(list);
                    });
                // Reload cash balance
                getCashAmount(selectedGroup._id)
                    .then((res) => {
                        const balance = res?.data?.groupCashBalance || res?.data?.cashAmount || 0;
                        setGroupCashBalance(balance);
                    })
                    .catch((err) => {
                        console.error("Failed to load cash balance:", err);
                    });
            } else {
                alert(res.message || "Failed to create conversion request");
            }
        } catch (error) {
            console.error("Error creating conversion:", error);
            alert(error.response?.data?.message || error.message || "Failed to create conversion request");
        } finally {
            setLoading(false);
        }
    };

    // Handle approve
    const handleApprove = async (conversionId) => {
        if (!window.confirm("Are you sure you want to approve this conversion?")) return;

        setLoading(true);
        try {
            const res = await approveConversion(conversionId);
            if (res.success) {
                alert("Conversion approved and processed successfully!");
                // Reload pending conversions
                getPendingConversions()
                    .then((response) => {
                        const list = Array.isArray(response?.data) ? response.data : [];
                        setPendingConversions(list);
                    });
            } else {
                alert(res.message || "Failed to approve conversion");
            }
        } catch (error) {
            console.error("Error approving conversion:", error);
            alert(error.response?.data?.message || error.message || "Failed to approve conversion");
        } finally {
            setLoading(false);
        }
    };

    // Handle reject
    const handleReject = async (conversionId) => {
        if (!rejectionReason.trim()) {
            alert("Please provide a rejection reason");
            return;
        }
        if (!window.confirm("Are you sure you want to reject this conversion?")) return;

        setLoading(true);
        try {
            const res = await rejectConversion(conversionId, rejectionReason);
            if (res.success) {
                alert("Conversion rejected successfully!");
                setRejectionReason("");
                setSelectedConversion(null);
                // Reload pending conversions
                getPendingConversions()
                    .then((response) => {
                        const list = Array.isArray(response?.data) ? response.data : [];
                        setPendingConversions(list);
                    });
            } else {
                alert(res.message || "Failed to reject conversion");
            }
        } catch (error) {
            console.error("Error rejecting conversion:", error);
            alert(error.response?.data?.message || error.message || "Failed to reject conversion");
        } finally {
            setLoading(false);
        }
    };

    // Get status badge
    const getStatusBadge = (status) => {
        const styles = {
            pending: "bg-yellow-100 text-yellow-800",
            approved: "bg-blue-100 text-blue-800",
            rejected: "bg-red-100 text-red-800",
            processed: "bg-green-100 text-green-800",
        };
        return (
            <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status] || "bg-gray-100 text-gray-800"}`}>
                {status?.toUpperCase() || "UNKNOWN"}
            </span>
        );
    };

    // Get image URL
    const getImageUrl = (imagePath) => {
        if (!imagePath) return null;
        const rawBaseURL = import.meta.env.VITE_BASE_URL || (import.meta.env.PROD ? "https://api.mmms.online" : "http://localhost:8080");
        let baseURL;
        try {
            const url = new URL(rawBaseURL);
            baseURL = `${url.protocol}//${url.host}`;
        } catch {
            const match = rawBaseURL.match(/^(https?:\/\/[^/]+)/i);
            baseURL = match ? match[1] : (import.meta.env.PROD ? "https://api.mmms.online" : "http://localhost:8080");
        }
        const cleanImagePath = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
        return `${baseURL}${cleanImagePath}`;
    };

    return (
        <div className="max-w-7xl mx-auto p-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <Banknote size={32} />
                    Cash to Bank Conversion
                </h1>
                <p className="text-gray-600 mt-2">Convert cash recovery payments to bank payments</p>
            </div>

            {/* Tabs */}
            {isAdminMode && (
                <div className="flex gap-4 mb-6 border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab("create")}
                        className={`px-4 py-2 font-semibold ${activeTab === "create"
                                ? "text-blue-600 border-b-2 border-blue-600"
                                : "text-gray-600 hover:text-gray-800"
                            }`}
                    >
                        Create Conversion
                    </button>
                    <button
                        onClick={() => setActiveTab("approve")}
                        className={`px-4 py-2 font-semibold relative ${activeTab === "approve"
                                ? "text-blue-600 border-b-2 border-blue-600"
                                : "text-gray-600 hover:text-gray-800"
                            }`}
                    >
                        Approve Requests
                        {pendingConversions.length > 0 && (
                            <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                                {pendingConversions.length}
                            </span>
                        )}
                    </button>
                </div>
            )}

            {/* Create Conversion Tab */}
            {activeTab === "create" && (
                <div className="space-y-6">
                    {/* Group Selection (Admin only) */}
                    {isAdminMode && (
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                                    <Building2 size={24} className="text-blue-600" />
                                    {selectedCluster ? `Groups in ${selectedCluster.name}` : "Select Cluster"}
                                </h2>
                                {selectedCluster && (
                                    <button
                                        onClick={() => {
                                            setSelectedCluster(null);
                                            setSelectedGroup(null);
                                            setSelectedRecovery(null);
                                        }}
                                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                    >
                                        ← Back to Clusters
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {!selectedCluster ? (
                                    Array.from(new Set(groups.map(g => `${g.cluster_name || ""}|${g.cluster_code || ""}`))).map((clusterKey) => {
                                        const [name, code] = clusterKey.split('|');
                                        const clusterGroups = groups.filter(g => (g.cluster_name || "") === name && (g.cluster_code || "") === code);
                                        return (
                                            <div
                                                key={clusterKey}
                                                onClick={() => setSelectedCluster({ name, code })}
                                                className="p-6 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
                                            >
                                                <div className="flex items-center gap-3 mb-3">
                                                    <LayoutGrid className="text-blue-600" size={32} />
                                                    <div>
                                                        <p className="font-semibold text-gray-800 text-lg">{name || "No Cluster Name"}</p>
                                                        <p className="text-sm text-gray-600">Code: {code || "No Code"}</p>
                                                    </div>
                                                </div>
                                                <div className="text-sm text-gray-600">
                                                    <p>Groups: {clusterGroups.length}</p>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    filteredGroups.map((g) => (
                                        <div
                                            key={g._id || g.id}
                                            onClick={() => {
                                                setSelectedGroup(g);
                                                setSelectedRecovery(null);
                                            }}
                                            className={`p-6 border-2 rounded-lg cursor-pointer transition-colors ${
                                                selectedGroup?._id === g._id || selectedGroup?.id === g.id
                                                    ? "border-blue-500 bg-blue-50"
                                                    : "border-gray-200 hover:border-blue-500 hover:bg-blue-50"
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 mb-3">
                                                <Building2 className="text-blue-600" size={32} />
                                                <div>
                                                    <p className="font-semibold text-gray-800 text-lg">{g.group_name || g.name}</p>
                                                    <p className="text-sm text-gray-600">Code: {g.group_code || g.code}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                                {!selectedCluster && groups.length === 0 && (
                                    <div className="col-span-full text-center py-8 text-gray-500">
                                        <p>No clusters found.</p>
                                    </div>
                                )}
                                {selectedCluster && filteredGroups.length === 0 && (
                                    <div className="col-span-full text-center py-8 text-gray-500">
                                        <p>No groups found in this cluster.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Balance Display */}
                    {selectedGroup && (
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4 mb-6">
                            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <Wallet size={18} className="text-blue-600" />
                                Available Balances
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Cash Balance */}
                                <div className="bg-white rounded-lg p-3 border border-gray-200">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Wallet size={16} className="text-green-600" />
                                            <span className="text-sm font-medium text-gray-700">Cash Balance</span>
                                        </div>
                                        <span className="text-lg font-bold text-green-600">
                                            ₹{groupCashBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                                {/* Bank Balance */}
                                {formData.bankId ? (() => {
                                    const selectedBank = groupBanks.find(b => (b._id || b.id) === formData.bankId);
                                    if (!selectedBank) return null;
                                    const availableBalance = selectedBank.available_balance !== undefined
                                        ? selectedBank.available_balance
                                        : (selectedBank.current_balance !== undefined
                                            ? selectedBank.current_balance
                                            : (selectedBank.opening_balance || 0));
                                    return (
                                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <CreditCard size={16} className="text-blue-600" />
                                                    <span className="text-sm font-medium text-gray-700">Bank Balance</span>
                                                </div>
                                                <span className="text-lg font-bold text-blue-600">
                                                    ₹{availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {selectedBank.bank_name} - {selectedBank.account_no}
                                            </p>
                                            {formData.amount && parseFloat(formData.amount) > 0 && (
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Will receive ₹{parseFloat(formData.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })() : groupBanks.length > 0 ? (
                                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <CreditCard size={16} className="text-blue-600" />
                                                <span className="text-sm font-medium text-gray-700">Bank Balance</span>
                                            </div>
                                            <span className="text-xs text-gray-500">Select a bank</span>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    )}

                    {/* Conversion Form */}
                    {selectedGroup && (() => {
                        const existingConversion = conversions.find(
                            (c) => c.status === "pending" || c.status === "approved"
                        );
                        return (
                            <div className="bg-white rounded-lg shadow-md p-6">
                                <h2 className="text-xl font-semibold text-gray-800 mb-4">Convert Cash to Bank</h2>
                                {existingConversion ? (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                        <p className="text-yellow-800 font-semibold mb-2">
                                            A conversion request already exists for this group
                                        </p>
                                        <p className="text-sm text-yellow-700 mb-2">
                                            Status: {getStatusBadge(existingConversion.status)}
                                        </p>
                                        <p className="text-sm text-yellow-700">
                                            Amount: ₹{existingConversion.totalCashAmount?.toLocaleString()}
                                        </p>
                                        <p className="text-sm text-yellow-600 mt-2">
                                            Please process or reject the existing request before creating a new one.
                                        </p>
                                    </div>
                                ) : (
                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        <Input
                                            label="Conversion Amount *"
                                            type="number"
                                            value={formData.amount}
                                            handleChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                            placeholder={`Enter amount (Max: ₹${groupCashBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
                                            required
                                            min="0.01"
                                            step="0.01"
                                        />
                                        {formData.amount && parseFloat(formData.amount) > 0 && (
                                            <div className={`text-sm ${groupCashBalance >= parseFloat(formData.amount) ? 'text-green-600' : 'text-red-600'}`}>
                                                {groupCashBalance >= parseFloat(formData.amount)
                                                    ? `✓ Sufficient balance (Available: ₹${groupCashBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
                                                    : `✗ Insufficient balance (Available: ₹${groupCashBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
                                                }
                                            </div>
                                        )}

                                        <Select
                                            label="Select Bank Account *"
                                            value={formData.bankId}
                                            handleChange={(e) => setFormData({ ...formData, bankId: e.target.value })}
                                            options={[
                                                { value: "", label: "Select a bank account" },
                                                ...groupBanks.map((bank) => {
                                                    // Use available_balance if available, else fallback to current_balance or opening_balance
                                                    const balance = bank.available_balance !== undefined
                                                        ? bank.available_balance
                                                        : (bank.current_balance !== undefined
                                                            ? bank.current_balance
                                                            : (bank.opening_balance || 0));
                                                    const balanceFormatted = `₹${balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                                    return {
                                                        value: bank._id,
                                                        label: `${bank.bank_name} - ${bank.account_no} [Available: ${balanceFormatted}]`,
                                                    };
                                                }),
                                            ]}
                                            required
                                        />

                                        <Input
                                            label="Online Reference (Optional)"
                                            type="text"
                                            value={formData.onlineRef}
                                            handleChange={(e) => setFormData({ ...formData, onlineRef: e.target.value })}
                                            placeholder="Transaction reference number"
                                        />

                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                Payment Image *
                                            </label>
                                            <input
                                                type="file"
                                                accept="image/*,.pdf"
                                                onChange={(e) => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        setFormData({ ...formData, paymentImage: file });
                                                    }
                                                }}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                required
                                            />
                                            {formData.paymentImage && (
                                                <p className="text-sm text-gray-600 mt-1">
                                                    Selected: {formData.paymentImage.name}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex gap-4">
                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:bg-gray-400"
                                            >
                                                {loading ? "Processing..." : isAdminMode ? "Create & Process" : "Submit Request"}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFormData({ amount: "", bankId: "", onlineRef: "", paymentImage: null });
                                                }}
                                                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
                                            >
                                                Clear Form
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* Approve Requests Tab (Admin only) */}
            {isAdminMode && activeTab === "approve" && (
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Pending Conversion Requests</h2>
                    {pendingConversions.length === 0 ? (
                        <p className="text-gray-600">No pending conversion requests.</p>
                    ) : (
                        <div className="space-y-4">
                            {pendingConversions.map((conversion) => (
                                <div
                                    key={conversion._id}
                                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                                >
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <p className="text-sm text-gray-600">Group</p>
                                            <p className="font-semibold">
                                                {conversion.groupName} ({conversion.groupCode})
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600">Recovery Sessions</p>
                                            <p className="font-semibold">
                                                {conversion.recoveryIds?.length || (conversion.recoveryId ? 1 : 0)} session{(conversion.recoveryIds?.length || (conversion.recoveryId ? 1 : 0)) !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                        {conversion.recoveryDate && (
                                            <div>
                                                <p className="text-sm text-gray-600">Earliest Date</p>
                                                <p className="font-semibold">{formatDate(conversion.recoveryDate)}</p>
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-sm text-gray-600">Amount</p>
                                            <p className="font-semibold text-green-700">
                                                ₹{conversion.totalCashAmount?.toLocaleString()}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600">Bank</p>
                                            <p className="font-semibold">
                                                {conversion.bankName} - {conversion.accountNumber}
                                            </p>
                                        </div>
                                        {conversion.onlineRef && (
                                            <div>
                                                <p className="text-sm text-gray-600">Reference</p>
                                                <p className="font-semibold">{conversion.onlineRef}</p>
                                            </div>
                                        )}
                                        {conversion.paymentImage && (
                                            <div>
                                                <p className="text-sm text-gray-600 mb-2">Payment Image</p>
                                                <a
                                                    href={getImageUrl(conversion.paymentImage)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 hover:underline"
                                                >
                                                    View Image
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => handleApprove(conversion._id)}
                                            disabled={loading}
                                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold disabled:bg-gray-400"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSelectedConversion(conversion);
                                                setRejectionReason("");
                                            }}
                                            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-semibold"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                    {selectedConversion?._id === conversion._id && (
                                        <div className="mt-4 p-4 bg-gray-50 rounded">
                                            <Input
                                                label="Rejection Reason *"
                                                type="text"
                                                value={rejectionReason}
                                                handleChange={(e) => setRejectionReason(e.target.value)}
                                                placeholder="Enter reason for rejection"
                                            />
                                            <div className="flex gap-4 mt-4">
                                                <button
                                                    onClick={() => handleReject(conversion._id)}
                                                    disabled={loading || !rejectionReason.trim()}
                                                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-semibold disabled:bg-gray-400"
                                                >
                                                    Confirm Reject
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setSelectedConversion(null);
                                                        setRejectionReason("");
                                                    }}
                                                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-semibold"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

