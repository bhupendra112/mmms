import React, { useState, useEffect } from "react";
import { DollarSign, Calendar, Banknote, Search, Filter, CheckCircle, XCircle, Clock, Eye, Wallet, CreditCard } from "lucide-react";
import { Input, Select, FormSection } from "../../components/forms/FormComponents";
import { useGroup } from "../../contexts/GroupContext";
import { useOffline } from "../../contexts/OfflineContext";
import { CloudOff, Cloud } from "lucide-react";
import syncManager from "../../database/syncEngine";
import {
    getMaturedFDs,
    getMemberSavings,
    createPayment,
    getPayments,
    refreshPaymentsFromBackend,
} from "../../services/paymentServiceOffline";
import { getGroupBanks as getGroupBanksOffline } from "../../services/groupServiceOffline";
import { getGroupBanks as getGroupBanksOnline } from "../../services/groupService";
import { getMembersByGroup } from "../../services/memberServiceOffline";
import { getCashAmount } from "../../services/cashAmount";

export default function PaymentManagement() {
    const { currentGroup, isGroupLoading } = useGroup();
    const { isOnline, lastRefreshedAt } = useOffline();
    const [activeTab, setActiveTab] = useState("fd_maturity"); // "fd_maturity", "saving_withdrawal", "history"
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // FD Maturity Tab State
    const [maturedFDs, setMaturedFDs] = useState([]);
    const [selectedFD, setSelectedFD] = useState(null);
    const [fdPaymentAmount, setFdPaymentAmount] = useState("");
    const [fdPaymentMode, setFdPaymentMode] = useState("Bank"); // "Cash" or "Bank"
    const [fdBankId, setFdBankId] = useState("");
    const [fdRemarks, setFdRemarks] = useState("");

    // Savings Withdrawal Tab State
    const [membersWithSavings, setMembersWithSavings] = useState([]);
    const [selectedMember, setSelectedMember] = useState(null);
    const [savingsAmount, setSavingsAmount] = useState("");
    const [savingsPaymentMode, setSavingsPaymentMode] = useState("Bank"); // "Cash" or "Bank"
    const [savingsBankId, setSavingsBankId] = useState("");
    const [savingsRemarks, setSavingsRemarks] = useState("");

    // Common State
    const [banks, setBanks] = useState([]);
    const [banksLoading, setBanksLoading] = useState(false);
    const [groupCashBalance, setGroupCashBalance] = useState(0);

    // Payment History Tab State
    const [payments, setPayments] = useState([]);
    const [historyFilters, setHistoryFilters] = useState({
        paymentType: "",
        status: "",
        fromDate: "",
        toDate: "",
    });

    useEffect(() => {
        if (currentGroup?.id && !isGroupLoading) {
            loadBanks(currentGroup.id);
            loadCashBalance(currentGroup.id);
            if (activeTab === "fd_maturity") {
                loadMaturedFDs();
            } else if (activeTab === "saving_withdrawal") {
                loadMembersWithSavings();
            } else if (activeTab === "history") {
                // Refresh payment data from backend when opening history tab (e.g. after admin approval)
                if (navigator.onLine) {
                    refreshPaymentsFromBackend(currentGroup.id).finally(() => loadPaymentHistory());
                } else {
                    loadPaymentHistory();
                }
            }
        }
    }, [currentGroup, isGroupLoading, activeTab, lastRefreshedAt]);

    // When opening payment module while online, sync any pending payments to backend (e.g. created while offline)
    useEffect(() => {
        if (currentGroup?.id && navigator.onLine) {
            syncManager.syncNow().catch((err) => console.error('[PaymentManagement] syncNow on mount:', err));
        }
    }, [currentGroup?.id]);

    // Refetch banks, cash, and payment list when user returns to this tab (e.g. after approving in admin)
    // so group panel shows updated payment status/details instead of stale data
    useEffect(() => {
        const onVisibilityChange = () => {
            if (document.visibilityState === "visible" && currentGroup?.id && navigator.onLine) {
                loadBanks(currentGroup.id);
                loadCashBalance(currentGroup.id);
                refreshPaymentsFromBackend(currentGroup.id).then((result) => {
                    if (result?.success && activeTab === "history") {
                        loadPaymentHistory();
                    }
                }).catch((err) => console.error("[PaymentManagement] refreshPaymentsFromBackend:", err));
            }
        };
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => document.removeEventListener("visibilitychange", onVisibilityChange);
    }, [currentGroup?.id, activeTab]);

    const loadCashBalance = async (groupId) => {
        if (!groupId) return;
        try {
            const res = await getCashAmount(groupId);
            const balance = res?.data?.groupCashBalance || res?.data?.cashAmount || 0;
            setGroupCashBalance(balance);
        } catch (err) {
            console.error("Error loading cash balance:", err);
            setGroupCashBalance(0);
        }
    };

    const loadBanks = async (groupId) => {
        if (!groupId) return;
        setBanksLoading(true);
        try {
            // Prefer live backend data when online so balances reflect latest approvals
            const useOnline = typeof navigator !== "undefined" && navigator.onLine;

            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    location: 'PaymentManagement.jsx:loadBanks - START',
                    message: 'Loading banks',
                    data: { groupId, useOnline, isOnline: navigator.onLine },
                    timestamp: Date.now(),
                    sessionId: 'debug-session',
                    runId: 'run1',
                    hypothesisId: 'H8',
                }),
            }).catch(() => { });
            // #endregion

            const res = useOnline
                ? await getGroupBanksOnline(groupId)
                : await getGroupBanksOffline(groupId);

            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    location: 'PaymentManagement.jsx:loadBanks - API RESPONSE',
                    message: 'Banks API response received',
                    data: {
                        groupId,
                        source: useOnline ? 'backend_api' : 'offline_master_banks',
                        hasResponse: !!res,
                        success: res?.success,
                        hasData: !!res?.data,
                        dataIsArray: Array.isArray(res?.data),
                        rawDataLength: res?.data?.length,
                        rawDataKeys: res?.data ? Object.keys(res?.data) : [],
                        nestedDataIsArray: Array.isArray(res?.data?.data),
                        nestedDataLength: res?.data?.data?.length,
                    },
                    timestamp: Date.now(),
                    sessionId: 'debug-session',
                    runId: 'run1',
                    hypothesisId: 'H8',
                }),
            }).catch(() => { });
            // #endregion

            // Handle response structure:
            // - Online: getGroupBanksOnline returns axios res.data = { success: true, message: "...", data: banks }
            // - Offline: getGroupBanksOffline returns { success: true, data: banks }
            const list = useOnline
                ? (res?.success && Array.isArray(res?.data) ? res.data : (Array.isArray(res?.data?.data) ? res.data.data : []))
                : (res?.success && Array.isArray(res?.data) ? res.data : []);
            const mapped = list.map(b => {
                const availableBalance = b.available_balance !== undefined
                    ? b.available_balance
                    : (b.current_balance !== undefined
                        ? b.current_balance
                        : (b.opening_balance || 0));
                return {
                    id: b._id,
                    name: b.bank_name,
                    accountNo: b.account_no,
                    display: `${b.bank_name} - ${b.account_no} [Available: ₹${availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}]`,
                    available_balance: availableBalance,
                    current_balance: b.current_balance,
                    opening_balance: b.opening_balance,
                };
            });

            setBanks(mapped);

            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    location: 'PaymentManagement.jsx:loadBanks - FINAL',
                    message: 'Group banks loaded for payment module',
                    data: {
                        groupId,
                        source: useOnline ? 'backend_api' : 'offline_master_banks',
                        bankCount: mapped.length,
                        sampleBank: mapped[0] ? {
                            id: mapped[0].id,
                            name: mapped[0].name,
                            available_balance: mapped[0].available_balance,
                            current_balance: mapped[0].current_balance,
                        } : null,
                    },
                    timestamp: Date.now(),
                    sessionId: 'debug-session',
                    runId: 'run1',
                    hypothesisId: 'H8',
                }),
            }).catch(() => { });
            // #endregion
        } catch (err) {
            console.error("Error loading banks:", err);
            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    location: 'PaymentManagement.jsx:loadBanks - ERROR',
                    message: 'Error loading banks',
                    data: {
                        groupId,
                        errorMessage: err?.message,
                        errorStack: err?.stack,
                        errorResponse: err?.response?.data,
                    },
                    timestamp: Date.now(),
                    sessionId: 'debug-session',
                    runId: 'run1',
                    hypothesisId: 'H8',
                }),
            }).catch(() => { });
            // #endregion
            setBanks([]);
        } finally {
            setBanksLoading(false);
        }
    };

    const loadMaturedFDs = async () => {
        if (!currentGroup?.id) return;
        setLoading(true);
        setError("");
        try {
            const res = await getMaturedFDs({ groupId: currentGroup.id });
            if (res?.success) {
                const fds = Array.isArray(res.data) ? res.data : [];
                setMaturedFDs(fds.map(fd => ({
                    id: fd._id,
                    memberId: fd.memberId?._id || fd.memberId,
                    memberCode: fd.memberCode,
                    memberName: fd.memberId?.Member_Nm || fd.memberName,
                    amount: fd.amount,
                    maturityDate: fd.maturityDate,
                    maturityAmount: fd.maturityAmount || fd.amount,
                    interestAmount: fd.interestAmount || 0,
                })));
            }
        } catch (err) {
            console.error("Error loading matured FDs:", err);
            setError("Failed to load matured FDs");
        } finally {
            setLoading(false);
        }
    };

    const loadMembersWithSavings = async () => {
        if (!currentGroup?.id) return;
        setLoading(true);
        setError("");
        try {
            const res = await getMembersByGroup(currentGroup.id);
            const members = Array.isArray(res?.data) ? res.data : [];

            if (members.length === 0) {
                console.warn("No members found for group:", currentGroup.id);
                setMembersWithSavings([]);
                setLoading(false);
                return;
            }

            // Get savings for each member
            const membersWithSavingsData = await Promise.all(
                members.map(async (member) => {
                    try {
                        const memberId = member._id || member.id;
                        if (!memberId) {
                            console.warn("Member missing ID:", member);
                            return null;
                        }

                        const savingsRes = await getMemberSavings(memberId);

                        if (savingsRes?.success) {
                            // Use availableSavings or availableBalance (for backward compatibility)
                            const availableSavings = savingsRes.data?.availableSavings ??
                                savingsRes.data?.availableBalance ?? 0;

                            // Include members with savings > 0 (same fields as admin: interest on savings for payment module)
                            if (availableSavings > 0) {
                                return {
                                    id: memberId,
                                    code: member.Member_Id || member.memberCode || member.code,
                                    name: member.Member_Nm || member.memberName || member.name,
                                    availableSavings,
                                    interestOnSavings: savingsRes.data?.interestOnSavings ?? 0,
                                    savingRate: savingsRes.data?.savingRate ?? 1,
                                    totalSavings: savingsRes.data?.totalSavings ?? savingsRes.data?.totalSaving ?? availableSavings,
                                };
                            }
                        } else {
                            console.warn(`Failed to get savings for member ${memberId}:`, savingsRes);
                        }
                        return null;
                    } catch (err) {
                        console.error(`Error loading savings for member ${member._id || member.id}:`, err);
                        return null;
                    }
                })
            );

            const validMembers = membersWithSavingsData.filter(m => m !== null);
            console.log(`Found ${validMembers.length} members with savings out of ${members.length} total members`);
            setMembersWithSavings(validMembers);
        } catch (err) {
            console.error("Error loading members with savings:", err);
            setError("Failed to load members with savings: " + (err?.message || "Unknown error"));
        } finally {
            setLoading(false);
        }
    };

    const loadPaymentHistory = async () => {
        if (!currentGroup?.id) return;
        setLoading(true);
        setError("");
        try {
            const params = {
                groupId: currentGroup.id,
            };
            if (historyFilters.paymentType) params.paymentType = historyFilters.paymentType;
            if (historyFilters.status) params.status = historyFilters.status;
            if (historyFilters.fromDate) params.fromDate = historyFilters.fromDate;
            if (historyFilters.toDate) params.toDate = historyFilters.toDate;

            const res = await getPayments(params);
            if (res?.success) {
                setPayments(Array.isArray(res.data) ? res.data : []);
            }
        } catch (err) {
            console.error("Error loading payment history:", err);
            setError("Failed to load payment history");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateFDPayment = async () => {
        if (!selectedFD) {
            alert("Please select an FD");
            return;
        }
        if (fdPaymentMode === "Bank" && !fdBankId) {
            alert("Please select a bank");
            return;
        }
        if (!fdPaymentAmount || parseFloat(fdPaymentAmount) <= 0) {
            alert("Please enter a valid payment amount");
            return;
        }

        // Validate balance
        const paymentAmount = parseFloat(fdPaymentAmount);
        if (fdPaymentMode === "Cash") {
            if (groupCashBalance < paymentAmount) {
                alert(`Insufficient cash balance. Available: ₹${groupCashBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, Required: ₹${paymentAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                return;
            }
        } else if (fdPaymentMode === "Bank" && fdBankId) {
            const selectedBank = banks.find(b => (b.id || b._id) === fdBankId);
            if (selectedBank) {
                const availableBalance = selectedBank.available_balance !== undefined
                    ? selectedBank.available_balance
                    : (selectedBank.current_balance !== undefined
                        ? selectedBank.current_balance
                        : 0);

                if (availableBalance < paymentAmount) {
                    alert(`Insufficient bank balance. Available: ₹${availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, Required: ₹${paymentAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                    return;
                }
            }
        }

        setLoading(true);
        try {
            // Get selected bank details if Bank mode
            const selectedBank = fdPaymentMode === "Bank" && fdBankId
                ? banks.find(b => (b.id || b._id) === fdBankId)
                : null;

            const paymentData = {
                memberId: selectedFD.memberId,
                memberCode: selectedFD.memberCode,
                memberName: selectedFD.memberName,
                groupId: currentGroup.id,
                groupName: currentGroup.name,
                groupCode: currentGroup.code,
                paymentType: "fd_maturity",
                amount: parseFloat(fdPaymentAmount),
                paymentMode: fdPaymentMode,
                bankId: fdPaymentMode === "Bank" ? fdBankId : null,
                bankName: selectedBank?.name || null,
                accountNo: selectedBank?.accountNo || null,
                fdId: selectedFD.id,
                remarks: fdRemarks,
                paymentDate: new Date().toISOString(),
            };

            console.log('[PAYMENT] Creating payment with data:', paymentData);
            const res = await createPayment(paymentData);
            console.log('[PAYMENT] Payment creation response:', res);

            if (res?.success) {
                const message = isOnline
                    ? "Payment request created successfully! Syncing to backend now..."
                    : "Payment request saved offline! It will be synced to backend and sent for admin approval when you're online.";
                alert(message);

                // Trigger sync if online
                if (isOnline) {
                    try {
                        console.log('[PAYMENT] Triggering sync now...');
                        const syncResult = await syncManager.syncNow();
                        console.log('[PAYMENT] Sync result:', syncResult);

                        // Check sync queue status
                        const stats = await syncManager.getStats();
                        console.log('[PAYMENT] Sync queue stats:', stats);
                    } catch (syncError) {
                        console.error('[PAYMENT] Error syncing payment:', syncError);
                        alert(`Payment saved but sync failed: ${syncError.message}. It will retry automatically.`);
                    }
                } else {
                    // Check sync queue even when offline
                    const stats = await syncManager.getStats();
                    console.log('[PAYMENT] Payment queued for sync (offline). Queue stats:', stats);
                }

                // Reset form
                setSelectedFD(null);
                setFdPaymentAmount("");
                setFdPaymentMode("Bank");
                setFdBankId("");
                setFdRemarks("");
                // Reload cash balance
                loadCashBalance(currentGroup.id);
                // Reload banks to refresh balance display
                loadBanks(currentGroup.id);
                // Reload data
                loadMaturedFDs();
                if (activeTab !== "history") {
                    setActiveTab("history");
                    loadPaymentHistory();
                }
            } else {
                alert(res?.message || "Failed to create payment request");
            }
        } catch (err) {
            console.error("Error creating FD payment:", err);
            const errorMessage = err?.response?.data?.message || err?.message || "Error creating payment request";
            alert(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSavingsPayment = async () => {
        if (!selectedMember) {
            alert("Please select a member");
            return;
        }
        if (savingsPaymentMode === "Bank" && !savingsBankId) {
            alert("Please select a bank");
            return;
        }
        if (!savingsAmount || parseFloat(savingsAmount) <= 0) {
            alert("Please enter a valid withdrawal amount");
            return;
        }
        if (parseFloat(savingsAmount) > selectedMember.availableSavings) {
            alert(`Insufficient savings. Available: ₹${selectedMember.availableSavings}`);
            return;
        }

        // Validate balance
        const paymentAmount = parseFloat(savingsAmount);
        if (savingsPaymentMode === "Cash") {
            if (groupCashBalance < paymentAmount) {
                alert(`Insufficient cash balance. Available: ₹${groupCashBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, Required: ₹${paymentAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                return;
            }
        } else if (savingsPaymentMode === "Bank" && savingsBankId) {
            const selectedBank = banks.find(b => (b.id || b._id) === savingsBankId);
            if (selectedBank) {
                const availableBalance = selectedBank.available_balance !== undefined
                    ? selectedBank.available_balance
                    : (selectedBank.current_balance !== undefined
                        ? selectedBank.current_balance
                        : 0);

                if (availableBalance < paymentAmount) {
                    alert(`Insufficient bank balance. Available: ₹${availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, Required: ₹${paymentAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                    return;
                }
            }
        }

        setLoading(true);
        try {
            // Get selected bank details if Bank mode
            const selectedBank = savingsPaymentMode === "Bank" && savingsBankId
                ? banks.find(b => (b.id || b._id) === savingsBankId)
                : null;

            const paymentData = {
                memberId: selectedMember.id,
                memberCode: selectedMember.code,
                memberName: selectedMember.name,
                groupId: currentGroup.id,
                groupName: currentGroup.name,
                groupCode: currentGroup.code,
                paymentType: "saving_withdrawal",
                amount: parseFloat(savingsAmount),
                paymentMode: savingsPaymentMode,
                bankId: savingsPaymentMode === "Bank" ? savingsBankId : null,
                bankName: selectedBank?.name || null,
                accountNo: selectedBank?.accountNo || null,
                remarks: savingsRemarks,
                paymentDate: new Date().toISOString(),
            };

            console.log('[PAYMENT] Creating savings withdrawal with data:', paymentData);
            const res = await createPayment(paymentData);
            console.log('[PAYMENT] Savings withdrawal creation response:', res);

            if (res?.success) {
                const message = isOnline
                    ? "Withdrawal request created successfully! Syncing to backend now..."
                    : "Withdrawal request saved offline! It will be synced to backend and sent for admin approval when you're online.";
                alert(message);

                // Trigger sync if online
                if (isOnline) {
                    try {
                        console.log('[PAYMENT] Triggering sync now for savings withdrawal...');
                        const syncResult = await syncManager.syncNow();
                        console.log('[PAYMENT] Sync result:', syncResult);

                        // Check sync queue status
                        const stats = await syncManager.getStats();
                        console.log('[PAYMENT] Sync queue stats:', stats);
                    } catch (syncError) {
                        console.error('[PAYMENT] Error syncing savings withdrawal:', syncError);
                        alert(`Payment saved but sync failed: ${syncError.message}. It will retry automatically.`);
                    }
                } else {
                    // Check sync queue even when offline
                    const stats = await syncManager.getStats();
                    console.log('[PAYMENT] Savings withdrawal queued for sync (offline). Queue stats:', stats);
                }

                // Reset form
                setSelectedMember(null);
                setSavingsAmount("");
                setSavingsPaymentMode("Bank");
                setSavingsBankId("");
                setSavingsRemarks("");
                // Reload cash balance
                loadCashBalance(currentGroup.id);
                // Reload banks to refresh balance display
                loadBanks(currentGroup.id);
                // Reload data
                loadMembersWithSavings();
                if (activeTab !== "history") {
                    setActiveTab("history");
                    loadPaymentHistory();
                }
            } else {
                alert(res?.message || "Failed to create withdrawal request");
            }
        } catch (err) {
            console.error("Error creating savings payment:", err);
            const errorMessage = err?.response?.data?.message || err?.message || "Error creating withdrawal request";
            alert(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (date) => {
        if (!date) return "";
        const d = new Date(date);
        return d.toLocaleDateString("en-GB");
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
        }).format(amount || 0);
    };

    const getStatusBadge = (status) => {
        const badges = {
            pending: { icon: Clock, color: "bg-yellow-100 text-yellow-800", label: "Pending Approval" },
            approved: { icon: CheckCircle, color: "bg-blue-100 text-blue-800", label: "Approved" },
            rejected: { icon: XCircle, color: "bg-red-100 text-red-800", label: "Rejected" },
            completed: { icon: CheckCircle, color: "bg-green-100 text-green-800", label: "Completed" },
        };
        const badge = badges[status] || badges.pending;
        const Icon = badge.icon;
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${badge.color}`}>
                <Icon size={12} />
                {badge.label}
            </span>
        );
    };

    if (isGroupLoading) {
        return (
            <div className="max-w-7xl mx-auto">
                <div className="text-center py-8">Loading...</div>
            </div>
        );
    }

    if (!currentGroup?.id) {
        return (
            <div className="max-w-7xl mx-auto">
                <div className="text-center py-8 text-red-600">No group selected. Please select a group first.</div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto">
            <div className="mb-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                            <DollarSign size={32} />
                            Payment Management
                        </h1>
                        <p className="text-gray-600 mt-2">
                            Request FD maturity payments and savings withdrawals (requires admin approval)
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                            Group: <strong>{currentGroup.name}</strong> ({currentGroup.code})
                        </p>
                    </div>
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${isOnline
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                        }`}>
                        {isOnline ? (
                            <>
                                <Cloud size={16} />
                                <span>Online - Changes will sync</span>
                            </>
                        ) : (
                            <>
                                <CloudOff size={16} />
                                <span>Offline - Will sync when online</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="flex space-x-8">
                    <button
                        onClick={() => setActiveTab("fd_maturity")}
                        className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === "fd_maturity"
                            ? "border-blue-500 text-blue-600"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            }`}
                    >
                        FD Maturity Payments
                    </button>
                    <button
                        onClick={() => setActiveTab("saving_withdrawal")}
                        className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === "saving_withdrawal"
                            ? "border-blue-500 text-blue-600"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            }`}
                    >
                        Savings Withdrawals
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab("history");
                            loadPaymentHistory();
                        }}
                        className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === "history"
                            ? "border-blue-500 text-blue-600"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            }`}
                    >
                        Payment History
                    </button>
                </nav>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    {error}
                </div>
            )}

            {/* FD Maturity Tab */}
            {activeTab === "fd_maturity" && (
                <div className="space-y-6">
                    {loading ? (
                        <div className="text-center py-8">Loading matured FDs...</div>
                    ) : (
                        <>
                            <div className="bg-white rounded-lg shadow p-6">
                                <h2 className="text-xl font-semibold mb-4">Matured FDs</h2>
                                {maturedFDs.length === 0 ? (
                                    <p className="text-gray-500">No matured FDs found for this group.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {maturedFDs.map((fd) => (
                                            <div
                                                key={fd.id}
                                                className={`p-4 border rounded-lg cursor-pointer transition-colors ${selectedFD?.id === fd.id
                                                    ? "border-blue-500 bg-blue-50"
                                                    : "border-gray-200 hover:border-gray-300"
                                                    }`}
                                                onClick={() => {
                                                    setSelectedFD(fd);
                                                    setFdPaymentAmount(fd.maturityAmount.toString());
                                                }}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="font-semibold">{fd.memberName} ({fd.memberCode})</p>
                                                        <p className="text-sm text-gray-600">
                                                            Maturity Date: {formatDate(fd.maturityDate)}
                                                        </p>
                                                        <p className="text-sm text-gray-600">
                                                            Principal: {formatCurrency(fd.amount)} |
                                                            Interest: {formatCurrency(fd.interestAmount)} |
                                                            Total: {formatCurrency(fd.maturityAmount)}
                                                        </p>
                                                    </div>
                                                    {selectedFD?.id === fd.id && (
                                                        <CheckCircle className="text-blue-500" size={20} />
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {selectedFD && (
                                <FormSection title="Create Payment Request" icon={DollarSign}>
                                    <div className="col-span-2">
                                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                                            <p className="text-sm text-yellow-800">
                                                <strong>Note:</strong> This payment request will be sent for admin approval.
                                                The payment will be processed after approval.
                                            </p>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-4">
                                            Member: <strong>{selectedFD.memberName}</strong> |
                                            Amount: <strong>{formatCurrency(selectedFD.maturityAmount)}</strong>
                                        </p>
                                        {fdPaymentMode === "Cash" && (
                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                                <p className="text-sm text-blue-800">
                                                    <Wallet className="inline mr-1" size={16} />
                                                    <strong>Cash Balance:</strong> ₹{groupCashBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    <Select
                                        label="Payment Mode"
                                        name="paymentMode"
                                        value={fdPaymentMode}
                                        options={[
                                            { value: "Cash", label: "Cash" },
                                            { value: "Bank", label: "Bank" },
                                        ]}
                                        handleChange={(e) => {
                                            setFdPaymentMode(e.target.value);
                                            if (e.target.value === "Cash") {
                                                setFdBankId("");
                                            }
                                        }}
                                        required
                                    />
                                    {fdPaymentMode === "Bank" && (
                                        <Select
                                            label="Select Bank"
                                            name="bankId"
                                            value={fdBankId}
                                            options={banks.map(b => ({ value: b.id, label: b.display }))}
                                            handleChange={(e) => setFdBankId(e.target.value)}
                                            required
                                        />
                                    )}
                                    <Input
                                        label="Payment Amount"
                                        name="amount"
                                        type="number"
                                        value={fdPaymentAmount}
                                        handleChange={(e) => setFdPaymentAmount(e.target.value)}
                                        required
                                        placeholder="Enter payment amount"
                                    />
                                    <div className="col-span-2">
                                        <Input
                                            label="Remarks (Optional)"
                                            name="remarks"
                                            value={fdRemarks}
                                            handleChange={(e) => setFdRemarks(e.target.value)}
                                            placeholder="Enter any remarks"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <button
                                            onClick={handleCreateFDPayment}
                                            disabled={loading || (fdPaymentMode === "Bank" && !fdBankId) || !fdPaymentAmount}
                                            className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {loading ? "Creating..." : "Create Payment Request"}
                                        </button>
                                    </div>
                                </FormSection>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Savings Withdrawal Tab */}
            {activeTab === "saving_withdrawal" && (
                <div className="space-y-6">
                    {loading ? (
                        <div className="text-center py-8">Loading members with savings...</div>
                    ) : (
                        <>
                            <div className="bg-white rounded-lg shadow p-6">
                                <h2 className="text-xl font-semibold mb-4">Members with Available Savings</h2>
                                {membersWithSavings.length === 0 ? (
                                    <p className="text-gray-500">No members with available savings found for this group.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {membersWithSavings.map((member) => (
                                            <div
                                                key={member.id}
                                                className={`p-4 border rounded-lg cursor-pointer transition-colors ${selectedMember?.id === member.id
                                                    ? "border-blue-500 bg-blue-50"
                                                    : "border-gray-200 hover:border-gray-300"
                                                    }`}
                                                onClick={() => {
                                                    setSelectedMember(member);
                                                    setSavingsAmount("");
                                                }}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="font-semibold">{member.name} ({member.code})</p>
                                                        <p className="text-sm text-gray-600">
                                                            Savings: <strong>{formatCurrency(member.availableSavings)}</strong>
                                                            {(member.interestOnSavings != null && member.interestOnSavings > 0) && (
                                                                <> | Interest ({member.savingRate ?? 1}% p.a.): <strong>{formatCurrency(member.interestOnSavings)}</strong></>
                                                            )}
                                                        </p>
                                                        {(member.interestOnSavings != null && member.interestOnSavings > 0) && (
                                                            <p className="text-xs text-gray-500">
                                                                Total with interest: {formatCurrency(member.availableSavings + (member.interestOnSavings || 0))}
                                                            </p>
                                                        )}
                                                    </div>
                                                    {selectedMember?.id === member.id && (
                                                        <CheckCircle className="text-blue-500" size={20} />
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {selectedMember && (
                                <FormSection title="Create Withdrawal Request" icon={DollarSign}>
                                    <div className="col-span-2">
                                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                                            <p className="text-sm text-yellow-800">
                                                <strong>Note:</strong> This withdrawal request will be sent for admin approval.
                                                The payment will be processed after approval.
                                            </p>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-4">
                                            Member: <strong>{selectedMember.name}</strong> |
                                            Savings: <strong>{formatCurrency(selectedMember.availableSavings)}</strong>
                                            {(selectedMember.interestOnSavings != null && selectedMember.interestOnSavings > 0) && (
                                                <> | Interest ({(selectedMember.savingRate ?? 1)}% p.a.): <strong>{formatCurrency(selectedMember.interestOnSavings)}</strong></>
                                            )}
                                        </p>
                                        {(selectedMember.interestOnSavings != null && selectedMember.interestOnSavings > 0) && (
                                            <p className="text-xs text-gray-500 mb-4">
                                                Total with interest: {formatCurrency(selectedMember.availableSavings + (selectedMember.interestOnSavings || 0))}
                                            </p>
                                        )}
                                        {savingsPaymentMode === "Cash" && (
                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                                <p className="text-sm text-blue-800">
                                                    <Wallet className="inline mr-1" size={16} />
                                                    <strong>Cash Balance:</strong> ₹{groupCashBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    <Select
                                        label="Payment Mode"
                                        name="paymentMode"
                                        value={savingsPaymentMode}
                                        options={[
                                            { value: "Cash", label: "Cash" },
                                            { value: "Bank", label: "Bank" },
                                        ]}
                                        handleChange={(e) => {
                                            setSavingsPaymentMode(e.target.value);
                                            if (e.target.value === "Cash") {
                                                setSavingsBankId("");
                                            }
                                        }}
                                        required
                                    />
                                    {savingsPaymentMode === "Bank" && (
                                        <Select
                                            label="Select Bank"
                                            name="bankId"
                                            value={savingsBankId}
                                            options={banks.map(b => ({ value: b.id, label: b.display }))}
                                            handleChange={(e) => setSavingsBankId(e.target.value)}
                                            required
                                        />
                                    )}
                                    <Input
                                        label="Withdrawal Amount"
                                        name="amount"
                                        type="number"
                                        value={savingsAmount}
                                        handleChange={(e) => setSavingsAmount(e.target.value)}
                                        required
                                        placeholder="Enter withdrawal amount"
                                    />
                                    <div className="col-span-2">
                                        <Input
                                            label="Remarks (Optional)"
                                            name="remarks"
                                            value={savingsRemarks}
                                            handleChange={(e) => setSavingsRemarks(e.target.value)}
                                            placeholder="Enter any remarks"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <button
                                            onClick={handleCreateSavingsPayment}
                                            disabled={loading || (savingsPaymentMode === "Bank" && !savingsBankId) || !savingsAmount}
                                            className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {loading ? "Creating..." : "Create Withdrawal Request"}
                                        </button>
                                    </div>
                                </FormSection>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Payment History Tab */}
            {activeTab === "history" && (
                <div className="space-y-6">
                    <FormSection title="Filters" icon={Filter}>
                        <Select
                            label="Payment Type"
                            name="paymentType"
                            value={historyFilters.paymentType}
                            options={[
                                { value: "", label: "All Types" },
                                { value: "fd_maturity", label: "FD Maturity" },
                                { value: "saving_withdrawal", label: "Savings Withdrawal" },
                            ]}
                            handleChange={(e) => setHistoryFilters({ ...historyFilters, paymentType: e.target.value })}
                        />
                        <Select
                            label="Status"
                            name="status"
                            value={historyFilters.status}
                            options={[
                                { value: "", label: "All Statuses" },
                                { value: "pending", label: "Pending" },
                                { value: "approved", label: "Approved" },
                                { value: "rejected", label: "Rejected" },
                                { value: "completed", label: "Completed" },
                            ]}
                            handleChange={(e) => setHistoryFilters({ ...historyFilters, status: e.target.value })}
                        />
                        <Input
                            label="From Date"
                            name="fromDate"
                            type="date"
                            value={historyFilters.fromDate}
                            handleChange={(e) => setHistoryFilters({ ...historyFilters, fromDate: e.target.value })}
                        />
                        <Input
                            label="To Date"
                            name="toDate"
                            type="date"
                            value={historyFilters.toDate}
                            handleChange={(e) => setHistoryFilters({ ...historyFilters, toDate: e.target.value })}
                        />
                        <div className="col-span-2">
                            <button
                                onClick={loadPaymentHistory}
                                className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                            >
                                Apply Filters
                            </button>
                        </div>
                    </FormSection>

                    {loading ? (
                        <div className="text-center py-6 sm:py-8 text-sm sm:text-base text-gray-600">Loading payment history...</div>
                    ) : payments.length === 0 ? (
                        <div className="bg-white rounded-lg shadow p-6 sm:p-8 text-center text-gray-500 text-sm sm:text-base">
                            No payments found
                        </div>
                    ) : (
                        <>
                            {/* Mobile / Tablet: Card layout */}
                            <div className="block md:hidden space-y-3">
                                {payments.map((payment) => (
                                    <div
                                        key={payment._id}
                                        className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 sm:p-4 space-y-2"
                                    >
                                        <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs sm:text-sm">
                                            <span className="text-gray-500">Date</span>
                                            <span className="text-gray-900 font-medium">{formatDate(payment.paymentDate)}</span>
                                        </div>
                                        <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs sm:text-sm">
                                            <span className="text-gray-500">Member</span>
                                            <span className="text-gray-900 break-words text-right">
                                                {payment.memberName} ({payment.memberCode})
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs sm:text-sm">
                                            <span className="text-gray-500">Type</span>
                                            <span className="text-gray-900">
                                                {payment.paymentType === "fd_maturity" ? "FD Maturity" : "Savings Withdrawal"}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs sm:text-sm">
                                            <span className="text-gray-500">Amount</span>
                                            <span className="text-gray-900 font-semibold">{formatCurrency(payment.amount)}</span>
                                        </div>
                                        <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs sm:text-sm">
                                            <span className="text-gray-500">Bank</span>
                                            <span className="text-gray-900 break-words text-right">
                                                {payment.bankName} ({payment.accountNo})
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-100">
                                            <span className="text-gray-500 text-xs sm:text-sm">Status</span>
                                            {getStatusBadge(payment.status)}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop: Table */}
                            <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="min-w-[680px] w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member</th>
                                                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bank</th>
                                                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {payments.map((payment) => (
                                                <tr key={payment._id} className="hover:bg-gray-50">
                                                    <td className="px-4 lg:px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                                                        {formatDate(payment.paymentDate)}
                                                    </td>
                                                    <td className="px-4 lg:px-6 py-3 text-sm text-gray-900">
                                                        {payment.memberName} ({payment.memberCode})
                                                    </td>
                                                    <td className="px-4 lg:px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                                                        {payment.paymentType === "fd_maturity" ? "FD Maturity" : "Savings Withdrawal"}
                                                    </td>
                                                    <td className="px-4 lg:px-6 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                                                        {formatCurrency(payment.amount)}
                                                    </td>
                                                    <td className="px-4 lg:px-6 py-3 text-sm text-gray-900">
                                                        {payment.bankName} ({payment.accountNo})
                                                    </td>
                                                    <td className="px-4 lg:px-6 py-3 whitespace-nowrap text-sm">
                                                        {getStatusBadge(payment.status)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

