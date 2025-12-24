import React, { useState, useEffect } from "react";
import { DollarSign, Calendar, Banknote, Search, Filter, CheckCircle, XCircle, Clock, Eye } from "lucide-react";
import { Input, Select, FormSection } from "../../components/forms/FormComponents";
import { useGroup } from "../../contexts/GroupContext";
import { 
    getMaturedFDs, 
    getMemberSavings, 
    createPayment, 
    getPayments
} from "../../services/paymentService";
import { getGroupBanks } from "../../services/groupService";
import { getMembersByGroup } from "../../services/memberService";

export default function PaymentManagement() {
    const { currentGroup, isGroupLoading } = useGroup();
    const [activeTab, setActiveTab] = useState("fd_maturity"); // "fd_maturity", "saving_withdrawal", "history"
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // FD Maturity Tab State
    const [maturedFDs, setMaturedFDs] = useState([]);
    const [selectedFD, setSelectedFD] = useState(null);
    const [fdPaymentAmount, setFdPaymentAmount] = useState("");
    const [fdBankId, setFdBankId] = useState("");
    const [fdRemarks, setFdRemarks] = useState("");

    // Savings Withdrawal Tab State
    const [membersWithSavings, setMembersWithSavings] = useState([]);
    const [selectedMember, setSelectedMember] = useState(null);
    const [savingsAmount, setSavingsAmount] = useState("");
    const [savingsBankId, setSavingsBankId] = useState("");
    const [savingsRemarks, setSavingsRemarks] = useState("");

    // Common State
    const [banks, setBanks] = useState([]);
    const [banksLoading, setBanksLoading] = useState(false);

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
            if (activeTab === "fd_maturity") {
                loadMaturedFDs();
            } else if (activeTab === "saving_withdrawal") {
                loadMembersWithSavings();
            } else if (activeTab === "history") {
                loadPaymentHistory();
            }
        }
    }, [currentGroup, isGroupLoading, activeTab]);

    const loadBanks = async (groupId) => {
        if (!groupId) return;
        setBanksLoading(true);
        try {
            const res = await getGroupBanks(groupId);
            const list = Array.isArray(res?.data) ? res.data : [];
            setBanks(list.map(b => ({
                id: b._id,
                name: b.bank_name,
                accountNo: b.account_no,
                display: `${b.bank_name} - ${b.account_no}`,
            })));
        } catch (err) {
            console.error("Error loading banks:", err);
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
            
            // Get savings for each member
            const membersWithSavingsData = await Promise.all(
                members.map(async (member) => {
                    try {
                        const savingsRes = await getMemberSavings(member._id);
                        if (savingsRes?.success && savingsRes.data?.availableSavings > 0) {
                            return {
                                id: member._id,
                                code: member.Member_Id,
                                name: member.Member_Nm,
                                availableSavings: savingsRes.data.availableSavings,
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
        if (!fdBankId) {
            alert("Please select a bank");
            return;
        }
        if (!fdPaymentAmount || parseFloat(fdPaymentAmount) <= 0) {
            alert("Please enter a valid payment amount");
            return;
        }

        setLoading(true);
        try {
            const paymentData = {
                memberId: selectedFD.memberId,
                groupId: currentGroup.id,
                paymentType: "fd_maturity",
                amount: parseFloat(fdPaymentAmount),
                bankId: fdBankId,
                fdId: selectedFD.id,
                remarks: fdRemarks,
            };

            const res = await createPayment(paymentData);
            if (res?.success) {
                alert("Payment request created successfully! Waiting for admin approval.");
                // Reset form
                setSelectedFD(null);
                setFdPaymentAmount("");
                setFdBankId("");
                setFdRemarks("");
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
            alert(err?.response?.data?.message || err?.message || "Error creating payment request");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSavingsPayment = async () => {
        if (!selectedMember) {
            alert("Please select a member");
            return;
        }
        if (!savingsBankId) {
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

        setLoading(true);
        try {
            const paymentData = {
                memberId: selectedMember.id,
                groupId: currentGroup.id,
                paymentType: "saving_withdrawal",
                amount: parseFloat(savingsAmount),
                bankId: savingsBankId,
                remarks: savingsRemarks,
            };

            const res = await createPayment(paymentData);
            if (res?.success) {
                alert("Payment request created successfully! Waiting for admin approval.");
                // Reset form
                setSelectedMember(null);
                setSavingsAmount("");
                setSavingsBankId("");
                setSavingsRemarks("");
                // Reload data
                loadMembersWithSavings();
                if (activeTab !== "history") {
                    setActiveTab("history");
                    loadPaymentHistory();
                }
            } else {
                alert(res?.message || "Failed to create payment request");
            }
        } catch (err) {
            console.error("Error creating savings payment:", err);
            alert(err?.response?.data?.message || err?.message || "Error creating payment request");
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

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="flex space-x-8">
                    <button
                        onClick={() => setActiveTab("fd_maturity")}
                        className={`py-4 px-1 border-b-2 font-medium text-sm ${
                            activeTab === "fd_maturity"
                                ? "border-blue-500 text-blue-600"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        }`}
                    >
                        FD Maturity Payments
                    </button>
                    <button
                        onClick={() => setActiveTab("saving_withdrawal")}
                        className={`py-4 px-1 border-b-2 font-medium text-sm ${
                            activeTab === "saving_withdrawal"
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
                        className={`py-4 px-1 border-b-2 font-medium text-sm ${
                            activeTab === "history"
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
                                                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                                                    selectedFD?.id === fd.id
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
                                    </div>
                                    <Select
                                        label="Select Bank"
                                        name="bankId"
                                        value={fdBankId}
                                        options={banks.map(b => ({ value: b.id, label: b.display }))}
                                        handleChange={(e) => setFdBankId(e.target.value)}
                                        required
                                    />
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
                                            disabled={loading || !fdBankId || !fdPaymentAmount}
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
                                                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                                                    selectedMember?.id === member.id
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
                                                            Available Savings: <strong>{formatCurrency(member.availableSavings)}</strong>
                                                        </p>
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
                                            Available: <strong>{formatCurrency(selectedMember.availableSavings)}</strong>
                                        </p>
                                    </div>
                                    <Select
                                        label="Select Bank"
                                        name="bankId"
                                        value={savingsBankId}
                                        options={banks.map(b => ({ value: b.id, label: b.display }))}
                                        handleChange={(e) => setSavingsBankId(e.target.value)}
                                        required
                                    />
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
                                            disabled={loading || !savingsBankId || !savingsAmount}
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
                        <div className="text-center py-8">Loading payment history...</div>
                    ) : (
                        <div className="bg-white rounded-lg shadow overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bank</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {payments.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                                                    No payments found
                                                </td>
                                            </tr>
                                        ) : (
                                            payments.map((payment) => (
                                                <tr key={payment._id}>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {formatDate(payment.paymentDate)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {payment.memberName} ({payment.memberCode})
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {payment.paymentType === "fd_maturity" ? "FD Maturity" : "Savings Withdrawal"}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                                        {formatCurrency(payment.amount)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {payment.bankName} ({payment.accountNo})
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                        {getStatusBadge(payment.status)}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

