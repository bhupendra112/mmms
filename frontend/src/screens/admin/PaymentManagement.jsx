import React, { useState, useEffect, useMemo } from "react";
import { DollarSign, Calendar, Banknote, Search, Filter, CheckCircle, XCircle, Clock, Eye, Wallet, CreditCard } from "lucide-react";
import { Input, Select, FormSection } from "../../components/forms/FormComponents";
import {
  getMaturedFDs,
  getMemberSavings,
  createPayment,
  getPayments,
  approvePayment,
  rejectPayment,
  completePayment
} from "../../services/paymentService";
import { getGroups } from "../../services/groupService";
import { getGroupBanks } from "../../services/groupService";
import { getMembersByGroup } from "../../services/memberService";
import { getCashAmount } from "../../services/cashAmount";

export default function PaymentManagement() {
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
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedClusterKey, setSelectedClusterKey] = useState("");
  const [historyClusterKey, setHistoryClusterKey] = useState("");
  const [banks, setBanks] = useState([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [groupCashBalance, setGroupCashBalance] = useState(0);

  // Payment History Tab State
  const [payments, setPayments] = useState([]);
  const [historyFilters, setHistoryFilters] = useState({
    groupId: "",
    paymentType: "",
    status: "",
    fromDate: "",
    toDate: "",
  });

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      loadBanks(selectedGroupId);
      loadCashBalance(selectedGroupId);
      if (activeTab === "fd_maturity") {
        loadMaturedFDs();
      } else if (activeTab === "saving_withdrawal") {
        loadMembersWithSavings();
      } else if (activeTab === "history") {
        loadPaymentHistory();
      }
    }
  }, [selectedGroupId, activeTab]);

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

  const loadGroups = async () => {
    try {
      const res = await getGroups();
      const list = Array.isArray(res?.data) ? res.data : [];
      setGroups(list.map(g => ({
        id: g._id,
        name: g.group_name,
        code: g.group_code,
        clusterName: g.cluster_name || "",
        clusterCode: g.cluster_code || "",
      })));
    } catch (err) {
      console.error("Error loading groups:", err);
      setError("Failed to load groups");
    }
  };

  const clusterOptions = useMemo(() => {
    const uniqueClusters = Array.from(
      new Set(groups.map(g => `${g.clusterName}|${g.clusterCode}`))
    );
    return uniqueClusters.map(key => {
      const [name, code] = key.split("|");
      return { value: key, label: `${name || "No Name"} (${code || "No Code"})` };
    });
  }, [groups]);

  const groupOptions = useMemo(() => {
    if (!selectedClusterKey) return [];
    const [cName, cCode] = selectedClusterKey.split("|");
    return groups
      .filter(g => g.clusterName === cName && g.clusterCode === cCode)
      .map(g => ({ value: g.id, label: `${g.name} (${g.code})` }));
  }, [groups, selectedClusterKey]);

  const historyGroupOptions = useMemo(() => {
    if (!historyClusterKey) return [];
    const [cName, cCode] = historyClusterKey.split("|");
    return groups
      .filter(g => g.clusterName === cName && g.clusterCode === cCode)
      .map(g => ({ value: g.id, label: `${g.name} (${g.code})` }));
  }, [groups, historyClusterKey]);

  const loadBanks = async (groupId) => {
    if (!groupId) return;
    setBanksLoading(true);
    try {
      const res = await getGroupBanks(groupId);
      const list = Array.isArray(res?.data) ? res.data : [];
      setBanks(list.map(b => {
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
      }));
    } catch (err) {
      console.error("Error loading banks:", err);
      setBanks([]);
    } finally {
      setBanksLoading(false);
    }
  };

  const loadMaturedFDs = async () => {
    if (!selectedGroupId) return;
    setLoading(true);
    setError("");
    try {
      const res = await getMaturedFDs({ groupId: selectedGroupId });
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
    if (!selectedGroupId) return;
    setLoading(true);
    setError("");
    try {
      const res = await getMembersByGroup(selectedGroupId);
      const members = Array.isArray(res?.data) ? res.data : [];

      // Get savings for each member (backend returns gate saving data + interest at 1% p.a.)
      const membersWithSavingsData = await Promise.all(
        members.map(async (member) => {
          try {
            const savingsRes = await getMemberSavings(member._id);
            if (savingsRes?.success && savingsRes.data?.availableSavings > 0) {
              const d = savingsRes.data;
              return {
                id: member._id,
                code: member.Member_Id,
                name: member.Member_Nm,
                availableSavings: d.availableSavings,
                interestOnSavings: d.interestOnSavings ?? 0,
                savingRate: d.savingRate ?? 1,
                totalSavings: d.totalSavings,
              };
            }
            return null;
          } catch (err) {
            console.error(`Error loading savings for member ${member._id}:`, err);
            return null;
          }
        })
      );

      setMembersWithSavings(membersWithSavingsData.filter(m => m !== null));
    } catch (err) {
      console.error("Error loading members with savings:", err);
      setError("Failed to load members with savings");
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentHistory = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (historyFilters.groupId) params.groupId = historyFilters.groupId;
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
      const selectedBank = banks.find(b => b.id === fdBankId);
      if (selectedBank) {
        // Get bank with available balance from the banks list
        const bankData = banks.find(b => b.id === fdBankId);
        const availableBalance = bankData?.available_balance !== undefined
          ? bankData.available_balance
          : (bankData?.current_balance !== undefined
            ? bankData.current_balance
            : 0);

        if (availableBalance < paymentAmount) {
          alert(`Insufficient bank balance. Available: ₹${availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, Required: ₹${paymentAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          return;
        }
      }
    }

    setLoading(true);
    try {
      const paymentData = {
        memberId: selectedFD.memberId,
        groupId: selectedGroupId,
        paymentType: "fd_maturity",
        amount: parseFloat(fdPaymentAmount),
        paymentMode: fdPaymentMode,
        bankId: fdPaymentMode === "Bank" ? fdBankId : null,
        fdId: selectedFD.id,
        remarks: fdRemarks,
      };

      const res = await createPayment(paymentData);
      if (res?.success) {
        alert("Payment created successfully!");
        // Reset form
        setSelectedFD(null);
        setFdPaymentAmount("");
        setFdPaymentMode("Bank");
        setFdBankId("");
        setFdRemarks("");
        // Reload cash balance
        loadCashBalance(selectedGroupId);
        // Reload banks to refresh balance display
        loadBanks(selectedGroupId);
        // Reload data
        loadMaturedFDs();
        if (activeTab !== "history") {
          setActiveTab("history");
          loadPaymentHistory();
        }
      } else {
        alert(res?.message || "Failed to create payment");
      }
    } catch (err) {
      console.error("Error creating FD payment:", err);
      alert(err?.response?.data?.message || err?.message || "Error creating payment");
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
      const selectedBank = banks.find(b => b.id === savingsBankId);
      if (selectedBank) {
        const bankData = banks.find(b => b.id === savingsBankId);
        const availableBalance = bankData?.available_balance !== undefined
          ? bankData.available_balance
          : (bankData?.current_balance !== undefined
            ? bankData.current_balance
            : 0);

        if (availableBalance < paymentAmount) {
          alert(`Insufficient bank balance. Available: ₹${availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, Required: ₹${paymentAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          return;
        }
      }
    }

    setLoading(true);
    try {
      const paymentData = {
        memberId: selectedMember.id,
        groupId: selectedGroupId,
        paymentType: "saving_withdrawal",
        amount: parseFloat(savingsAmount),
        paymentMode: savingsPaymentMode,
        bankId: savingsPaymentMode === "Bank" ? savingsBankId : null,
        remarks: savingsRemarks,
      };

      const res = await createPayment(paymentData);
      if (res?.success) {
        alert("Payment created successfully!");
        // Reset form
        setSelectedMember(null);
        setSavingsAmount("");
        setSavingsPaymentMode("Bank");
        setSavingsBankId("");
        setSavingsRemarks("");
        // Reload cash balance
        loadCashBalance(selectedGroupId);
        // Reload banks to refresh balance display
        loadBanks(selectedGroupId);
        // Reload data
        loadMembersWithSavings();
        if (activeTab !== "history") {
          setActiveTab("history");
          loadPaymentHistory();
        }
      } else {
        alert(res?.message || "Failed to create payment");
      }
    } catch (err) {
      console.error("Error creating savings payment:", err);
      alert(err?.response?.data?.message || err?.message || "Error creating payment");
    } finally {
      setLoading(false);
    }
  };

  const handleCompletePayment = async (paymentId) => {
    if (!window.confirm("Are you sure you want to mark this payment as completed?")) {
      return;
    }

    setLoading(true);
    try {
      const res = await completePayment(paymentId);
      if (res?.success) {
        alert("Payment completed successfully!");
        loadPaymentHistory();
      } else {
        alert(res?.message || "Failed to complete payment");
      }
    } catch (err) {
      console.error("Error completing payment:", err);
      alert(err?.response?.data?.message || err?.message || "Error completing payment");
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
      pending: { icon: Clock, color: "bg-yellow-100 text-yellow-800", label: "Pending" },
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

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
          <DollarSign size={32} />
          Payment Management
        </h1>
        <p className="text-gray-600 mt-2">Process FD maturity payments and savings withdrawals</p>
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

      {/* Group Selection */}
      <div className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Select Cluster"
            name="cluster_selection"
            value={selectedClusterKey}
            options={clusterOptions}
            handleChange={(e) => {
              setSelectedClusterKey(e.target.value);
              setSelectedGroupId("");
              setSelectedFD(null);
              setSelectedMember(null);
            }}
            required={activeTab !== "history"}
          />
          <Select
            label="Select Group"
            name="groupId"
            value={selectedGroupId}
            options={[{ value: "", label: "Select Group" }, ...groupOptions]}
            handleChange={(e) => setSelectedGroupId(e.target.value)}
            required={activeTab !== "history"}
            disabled={!selectedClusterKey}
          />
        </div>
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
                  <p className="text-gray-500">No matured FDs found for the selected group.</p>
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
                <FormSection title="Create Payment" icon={DollarSign}>
                  {/* Balance Display */}
                  <div className="col-span-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4 mb-4">
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
                        {fdPaymentAmount && fdPaymentMode === "Cash" && parseFloat(fdPaymentAmount) > 0 && (
                          <p className={`text-xs mt-1 ${groupCashBalance >= parseFloat(fdPaymentAmount) ? 'text-green-600' : 'text-red-600'}`}>
                            {groupCashBalance >= parseFloat(fdPaymentAmount)
                              ? `✓ Sufficient balance`
                              : `✗ Insufficient balance`
                            }
                          </p>
                        )}
                      </div>
                      {/* Bank Balance Summary */}
                      {banks.length > 0 && (
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <CreditCard size={16} className="text-blue-600" />
                              <span className="text-sm font-medium text-gray-700">Bank Accounts</span>
                            </div>
                            <span className="text-xs text-gray-500">{banks.length} account{banks.length !== 1 ? 's' : ''}</span>
                          </div>
                          {fdBankId && fdPaymentMode === "Bank" && (() => {
                            const selectedBank = banks.find(b => b.id === fdBankId);
                            if (!selectedBank) return null;
                            const availableBalance = selectedBank.available_balance || 0;
                            return (
                              <div className="text-sm">
                                <span className="text-gray-600">{selectedBank.name || 'Bank'}: </span>
                                <span className={`font-bold ${availableBalance >= parseFloat(fdPaymentAmount || 0) ? 'text-blue-600' : 'text-red-600'}`}>
                                  ₹{availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                {fdPaymentAmount && parseFloat(fdPaymentAmount) > 0 && (
                                  <p className={`text-xs mt-1 ${availableBalance >= parseFloat(fdPaymentAmount) ? 'text-green-600' : 'text-red-600'}`}>
                                    {availableBalance >= parseFloat(fdPaymentAmount)
                                      ? `✓ Sufficient balance`
                                      : `✗ Insufficient balance`
                                    }
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                          {(!fdBankId || fdPaymentMode !== "Bank") && (
                            <span className="text-xs text-gray-500">Select a bank to see balance</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <p className="text-sm text-gray-600 mb-4">
                      Member: <strong>{selectedFD.memberName}</strong> |
                      Amount: <strong>{formatCurrency(selectedFD.maturityAmount)}</strong>
                    </p>
                  </div>
                  <Select
                    label="Payment Mode *"
                    name="paymentMode"
                    value={fdPaymentMode}
                    options={[
                      { value: "Cash", label: "Cash" },
                      { value: "Bank", label: "Bank" }
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
                      label="Select Bank *"
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
                      {loading ? "Creating..." : "Create Payment"}
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
                  <p className="text-gray-500">No members with available savings found for the selected group.</p>
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
                <FormSection title="Create Withdrawal Payment" icon={DollarSign}>
                  {/* Balance Display */}
                  <div className="col-span-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4 mb-4">
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
                        {savingsAmount && savingsPaymentMode === "Cash" && parseFloat(savingsAmount) > 0 && (
                          <p className={`text-xs mt-1 ${groupCashBalance >= parseFloat(savingsAmount) ? 'text-green-600' : 'text-red-600'}`}>
                            {groupCashBalance >= parseFloat(savingsAmount)
                              ? `✓ Sufficient balance`
                              : `✗ Insufficient balance`
                            }
                          </p>
                        )}
                      </div>
                      {/* Bank Balance Summary */}
                      {banks.length > 0 && (
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <CreditCard size={16} className="text-blue-600" />
                              <span className="text-sm font-medium text-gray-700">Bank Accounts</span>
                            </div>
                            <span className="text-xs text-gray-500">{banks.length} account{banks.length !== 1 ? 's' : ''}</span>
                          </div>
                          {savingsBankId && savingsPaymentMode === "Bank" && (() => {
                            const selectedBank = banks.find(b => b.id === savingsBankId);
                            if (!selectedBank) return null;
                            const availableBalance = selectedBank.available_balance || 0;
                            return (
                              <div className="text-sm">
                                <span className="text-gray-600">{selectedBank.name || 'Bank'}: </span>
                                <span className={`font-bold ${availableBalance >= parseFloat(savingsAmount || 0) ? 'text-blue-600' : 'text-red-600'}`}>
                                  ₹{availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                {savingsAmount && parseFloat(savingsAmount) > 0 && (
                                  <p className={`text-xs mt-1 ${availableBalance >= parseFloat(savingsAmount) ? 'text-green-600' : 'text-red-600'}`}>
                                    {availableBalance >= parseFloat(savingsAmount)
                                      ? `✓ Sufficient balance`
                                      : `✗ Insufficient balance`
                                    }
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                          {(!savingsBankId || savingsPaymentMode !== "Bank") && (
                            <span className="text-xs text-gray-500">Select a bank to see balance</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <p className="text-sm text-gray-600 mb-4">
                      Member: <strong>{selectedMember.name}</strong> |
                      Savings: <strong>{formatCurrency(selectedMember.availableSavings)}</strong>
                      {(selectedMember.interestOnSavings != null && selectedMember.interestOnSavings > 0) && (
                        <> | Interest ({(selectedMember.savingRate ?? 1)}% p.a.): <strong>{formatCurrency(selectedMember.interestOnSavings)}</strong></>
                      )}
                    </p>
                  </div>
                  <Select
                    label="Payment Mode *"
                    name="paymentMode"
                    value={savingsPaymentMode}
                    options={[
                      { value: "Cash", label: "Cash" },
                      { value: "Bank", label: "Bank" }
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
                      label="Select Bank *"
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
                      {loading ? "Creating..." : "Create Payment"}
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
              label="Cluster"
              name="historyCluster"
              value={historyClusterKey}
              options={[{ value: "", label: "All Clusters" }, ...clusterOptions]}
              handleChange={(e) => {
                setHistoryClusterKey(e.target.value);
                setHistoryFilters({ ...historyFilters, groupId: "" });
              }}
            />
            <Select
              label="Group"
              name="groupId"
              value={historyFilters.groupId}
              options={[{ value: "", label: "All Groups" }, ...historyGroupOptions]}
              handleChange={(e) => setHistoryFilters({ ...historyFilters, groupId: e.target.value })}
              disabled={!historyClusterKey}
            />
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
                      <div className="flex flex-wrap items-center gap-2">
                        {getStatusBadge(payment.status)}
                        {payment.status === "approved" && (
                          <button
                            onClick={() => handleCompletePayment(payment._id)}
                            className="text-blue-600 hover:text-blue-800 font-semibold text-xs sm:text-sm"
                          >
                            Complete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: Table */}
              <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-[720px] w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member</th>
                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bank</th>
                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
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
                          <td className="px-4 lg:px-6 py-3 whitespace-nowrap text-sm">
                            {payment.status === "approved" && (
                              <button
                                onClick={() => handleCompletePayment(payment._id)}
                                className="text-blue-600 hover:text-blue-800 font-semibold"
                              >
                                Complete
                              </button>
                            )}
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
