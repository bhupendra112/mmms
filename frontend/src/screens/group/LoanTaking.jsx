import React, { useState, useEffect } from "react";
import {
    User,
    Building2,
    DollarSign,
    CheckCircle,
    XCircle,
    Upload,
    Camera,
    ArrowRight,
    ArrowLeft,
    Search,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Input, Select } from "../../components/forms/FormComponents";
import { useGroup } from "../../contexts/GroupContext";
import { createApprovalRequest } from "../../services/approvalDB";
import { registerLoan } from "../../services/loanService";
import { getGroups, getGroupBanks } from "../../services/groupService";
import { getMembersByGroup } from "../../services/memberService";

export default function LoanTaking() {
    const { currentGroup, isOnline, isGroupPanel, isGroupLoading } = useGroup();
    const isAdminMode = !isGroupPanel;
    const [searchParams] = useSearchParams();
    const preselectGroupId = searchParams.get("groupId");
    const [selectedGroup, setSelectedGroup] = useState(null); // For admin: selected group from list
    const [groups, setGroups] = useState([]);
    const [groupsLoading, setGroupsLoading] = useState(false);
    const [allMembers, setAllMembers] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentStep, setCurrentStep] = useState(() => (isAdminMode ? 0 : 1)); // 0: Select Group (admin only), 1: Loan Taking Form

    // Form state
    const [hasAssetsForLoan, setHasAssetsForLoan] = useState(null); // null, true, false - First question
    const [selectedMember, setSelectedMember] = useState(null);
    const [transactionType, setTransactionType] = useState("");
    const [paymentMode, setPaymentMode] = useState("");
    const [selectedBankId, setSelectedBankId] = useState("");
    const [groupBanks, setGroupBanks] = useState([]);
    const [purpose, setPurpose] = useState("");
    const [amount, setAmount] = useState("");
    const [timePeriod, setTimePeriod] = useState("");
    const [installmentAmount, setInstallmentAmount] = useState("");
    const [bachanPathraPhoto, setBachanPathraPhoto] = useState(null);

    // Determine active group: use currentGroup from context if available, otherwise use selectedGroup (admin)
    const activeGroup = currentGroup || selectedGroup;

    // Auto-calculate installment amount when amount and time period are entered
    useEffect(() => {
        if (amount && timePeriod) {
            const loanAmount = parseFloat(amount);
            const months = parseFloat(timePeriod);
            if (loanAmount > 0 && months > 0) {
                const calculatedInstallment = (loanAmount / months).toFixed(2);
                setInstallmentAmount(calculatedInstallment);
            }
        } else if (!amount || !timePeriod) {
            // Clear installment if amount or time period is cleared
            setInstallmentAmount("");
        }
    }, [amount, timePeriod]);

    // Load groups dynamically (admin mode only)
    useEffect(() => {
        if (!isAdminMode) return;
        setGroupsLoading(true);
        getGroups()
            .then((res) => {
                const list = Array.isArray(res?.data) ? res.data : [];
                setGroups(
                    list.map((g) => ({
                        id: g._id,
                        name: g.group_name,
                        code: g.group_code,
                        village: g.village,
                        memberCount: g.memberCount ?? g.no_members ?? 0,
                    }))
                );
            })
            .catch((e) => {
                console.error("Error loading groups:", e);
                setGroups([]);
            })
            .finally(() => setGroupsLoading(false));
    }, [isAdminMode]);

    // Initialize members from active group
    useEffect(() => {
        const groupId = activeGroup?.id;
        if (!groupId) {
            setAllMembers([]);
            return;
        }
        getMembersByGroup(groupId)
            .then((res) => {
                const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
                setAllMembers(
                    list.map((m) => ({
                        id: m._id,
                        code: m.Member_Id || m.member_code || m.memberCode || m.code || "",
                        name: m.Member_Nm || m.member_name || m.memberName || m.name || "",
                    }))
                );
            })
            .catch((e) => {
                console.error("Error loading members:", e);
                setAllMembers([]);
            });
    }, [activeGroup?.id]);

    // Load group banks when active group changes
    useEffect(() => {
        const groupId = activeGroup?.id;
        if (!groupId) {
            setGroupBanks([]);
            setSelectedBankId("");
            return;
        }
        getGroupBanks(groupId)
            .then((res) => {
                const banks = Array.isArray(res?.data) ? res.data : [];
                setGroupBanks(banks);
            })
            .catch((e) => {
                console.error("Error loading banks:", e);
                setGroupBanks([]);
            });
    }, [activeGroup?.id]);

    // Note: Bank selection is available for both Cash and Bank modes (required for Bank, optional for Cash)

    // Auto-select group when coming from admin loan management (e.g. ?groupId=...)
    useEffect(() => {
        if (!isAdminMode) return;
        if (!preselectGroupId) return;
        if (selectedGroup) return;
        const found = groups.find((g) => g.id === preselectGroupId);
        if (found) {
            handleSelectGroup(found);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdminMode, preselectGroupId, groups, selectedGroup]);

    // Handle group selection (for admin)
    const handleSelectGroup = (group) => {
        setSelectedGroup(group);
        setCurrentStep(1); // Move to loan taking form
        // Reset form when group changes
        setHasAssetsForLoan(null);
        setSelectedMember(null);
        setTransactionType("");
        setPaymentMode("");
        setSelectedBankId("");
        setPurpose("");
        setAmount("");
        setTimePeriod("");
        setInstallmentAmount("");
        setBachanPathraPhoto(null);
    };

    // Reset form when member changes
    useEffect(() => {
        if (selectedMember) {
            setTransactionType("");
            setPaymentMode("");
                setSelectedBankId("");
                setPurpose("");
                setAmount("");
                setTimePeriod("");
                setInstallmentAmount("");
                setBachanPathraPhoto(null);
        }
    }, [selectedMember, allMembers]);

    // Filter members
    const filteredMembers = allMembers.filter(
        (member) =>
            String(member.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(member.code || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Transaction type options based on hasAssetsForLoan
    const getTransactionTypes = () => {
        if (hasAssetsForLoan === true) {
            return ["Saving", "FD", "Loan"];
        } else if (hasAssetsForLoan === false) {
            return ["Deposit", "Bank", "Expense", "Other"];
        }
        return [];
    };

    // Filter members based on asset status if needed
    const getAvailableMembers = () => {
        if (hasAssetsForLoan === true) {
            // Show all members (they can have assets)
            return filteredMembers;
        } else if (hasAssetsForLoan === false) {
            // Show all members (for deposit, bank, expense, other)
            return filteredMembers;
        }
        return [];
    };

    // Handle photo upload
    const handlePhotoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setBachanPathraPhoto(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    // Handle submit
    const handleSubmit = async () => {
        if (hasAssetsForLoan === null) {
            alert("Please answer if member has assets for this loan");
            return;
        }

        // If has assets, member selection is required
        if (hasAssetsForLoan && !selectedMember) {
            alert("Please select a member");
            return;
        }

        if (!transactionType) {
            alert("Please select transaction type");
            return;
        }

        if (!paymentMode) {
            alert("Please select payment mode");
            return;
        }

        // Validate bank selection when payment mode is "Bank" (required for Bank, optional for Cash)
        if (paymentMode === "Bank" && !selectedBankId) {
            alert("Please select a bank for bank transactions");
            return;
        }

        if (!purpose.trim()) {
            alert("Please enter purpose");
            return;
        }

        if (!amount || parseFloat(amount) <= 0) {
            alert("Please enter valid amount");
            return;
        }

        try {
            const loanData = {
                groupId: activeGroup.id,
                groupName: activeGroup.name,
                memberId: hasAssetsForLoan ? selectedMember.id : null,
                memberCode: hasAssetsForLoan ? selectedMember.code : null,
                memberName: hasAssetsForLoan ? selectedMember.name : null,
                hasAssets: hasAssetsForLoan,
                isGroupLoan: !hasAssetsForLoan, // Flag for group management loan
                transactionType,
                paymentMode,
                bankId: paymentMode === "Bank" ? selectedBankId : null,
                purpose,
                amount: parseFloat(amount),
                time_period: timePeriod ? parseInt(timePeriod) : null,
                installment_amount: installmentAmount ? parseFloat(installmentAmount) : null,
                bachanPathraPhoto: bachanPathraPhoto || null,
                date: new Date().toLocaleDateString("en-GB"),
                createdAt: Date.now(),
            };

            // For group panel, create approval request; for admin, save directly to MongoDB
            if (currentGroup) {
                // Group panel: create approval request
                await createApprovalRequest("loan", loanData, activeGroup.id, activeGroup.name);
                alert("Loan transaction submitted for approval!");
            } else {
                // Admin: directly save to MongoDB
                await registerLoan(loanData);
                alert("Loan transaction saved successfully!");
            }

            // Reset form
            setSelectedMember(null);
            setHasAssetsForLoan(null);
            setTransactionType("");
            setPaymentMode("");
                setSelectedBankId("");
                setPurpose("");
                setAmount("");
                setTimePeriod("");
                setInstallmentAmount("");
                setBachanPathraPhoto(null);
        } catch (error) {
            console.error("Error saving loan:", error);
            alert("Error saving loan transaction");
        }
    };

    // Group panel: wait for dynamic group to load
    if (isGroupPanel && isGroupLoading) {
        return (
            <div className="max-w-7xl mx-auto p-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
                    <p className="text-blue-600 font-semibold">Loading group information...</p>
                </div>
            </div>
        );
    }

    // Group panel: no active group configured/found
    if (isGroupPanel && !currentGroup) {
        return (
            <div className="max-w-7xl mx-auto p-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
                    <p className="text-yellow-800 font-semibold">No group found.</p>
                    <p className="text-yellow-700 mt-2">
                        Please create a group in the admin panel first (Create Group), then refresh this page.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <DollarSign size={32} />
                    Loan Taking Process
                </h1>
                <p className="text-gray-600 mt-2">
                    {activeGroup
                        ? `Process loan for ${activeGroup.name}`
                        : isAdminMode
                            ? "Select a group to start loan process"
                            : "Loading group information..."}
                </p>
            </div>

            {/* Step 0: Select Group (Admin only - when currentGroup is null) */}
            {isAdminMode && currentStep === 0 && (
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <Building2 size={24} className="text-blue-600" />
                        Select Group
                    </h2>
                    <p className="text-gray-600 mb-6">Please select a group to proceed with loan taking</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {groupsLoading ? (
                            <div className="col-span-full text-center py-8 text-gray-500">
                                <p>Loading groups…</p>
                            </div>
                        ) : (
                            <>
                                {groups.map((group) => (
                                    <div
                                        key={group.id}
                                        onClick={() => handleSelectGroup(group)}
                                        className="p-6 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3 mb-3">
                                            <Building2 className="text-blue-600" size={32} />
                                            <div>
                                                <p className="font-semibold text-gray-800 text-lg">{group.name}</p>
                                                <p className="text-sm text-gray-600">Code: {group.code || "-"}</p>
                                            </div>
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            <p>Village: {group.village || "-"}</p>
                                            <p className="mt-1">Members: {group.memberCount || 0}</p>
                                        </div>
                                    </div>
                                ))}
                                {groups.length === 0 && (
                                    <div className="col-span-full text-center py-8 text-gray-500">
                                        <p>No groups found.</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Step 1: Loan Taking Form */}
            {currentStep === 1 && activeGroup && (
                <div className="space-y-6">
                    {/* Back button for admin */}
                    {isAdminMode && (
                        <div className="bg-white rounded-lg shadow-md p-4">
                            <button
                                onClick={() => {
                                    if (window.confirm("Are you sure you want to go back? All unsaved data will be lost.")) {
                                        setSelectedGroup(null);
                                        setAllMembers([]);
                                        setCurrentStep(0);
                                        setHasAssetsForLoan(null);
                                        setSelectedMember(null);
                                        setTransactionType("");
                                        setPaymentMode("");
                setSelectedBankId("");
                setPurpose("");
                setAmount("");
                setTimePeriod("");
                setInstallmentAmount("");
                setBachanPathraPhoto(null);
                                    }
                                }}
                                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ArrowLeft size={18} />
                                Back to Groups
                            </button>
                        </div>
                    )}

                    {/* Step 1: Asset Check for Loan */}
                    {hasAssetsForLoan === null && (
                        <div className="bg-white rounded-lg shadow-md p-8">
                            <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                <DollarSign size={28} className="text-blue-600" />
                                Asset Check for Loan
                            </h2>
                            <p className="text-gray-600 mb-6">
                                Before proceeding, please confirm if the member has assets for this loan transaction.
                            </p>
                            <div className="mb-6">
                                <label className="block text-lg font-semibold text-gray-700 mb-4">
                                    Does the member have assets for this loan? *
                                </label>
                                <div className="flex gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setHasAssetsForLoan(true)}
                                        className="flex items-center gap-3 px-8 py-4 rounded-lg font-semibold text-lg transition-colors bg-green-600 text-white hover:bg-green-700 shadow-md"
                                    >
                                        <CheckCircle size={24} />
                                        Yes
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setHasAssetsForLoan(false)}
                                        className="flex items-center gap-3 px-8 py-4 rounded-lg font-semibold text-lg transition-colors bg-red-600 text-white hover:bg-red-700 shadow-md"
                                    >
                                        <XCircle size={24} />
                                        No
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: If No Assets - Group Management Loan */}
                    {currentStep === 1 && activeGroup && hasAssetsForLoan === false && (
                        <div className="bg-white rounded-lg shadow-md p-8">
                            <div className="mb-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <Building2 size={32} className="text-blue-600" />
                                    <h2 className="text-2xl font-semibold text-gray-800">
                                        Group Management Loan
                                    </h2>
                                </div>
                                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg mb-6">
                                    <p className="text-gray-700 text-lg font-medium mb-2">
                                        Explanation:
                                    </p>
                                    <p className="text-gray-600">
                                        If a member is not taking a personal loan, the group may need a loan for personal use and management purposes.
                                        This loan will be for group management and operational needs.
                                    </p>
                                </div>
                                <p className="text-gray-600 mb-4">
                                    <strong>Note:</strong> Member selection is not required for group management loans.
                                    Please fill in the transaction details below.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Form (with or without member selection) */}
                    {currentStep === 1 && activeGroup && hasAssetsForLoan !== null && (
                        <div className={hasAssetsForLoan ? "grid grid-cols-1 lg:grid-cols-3 gap-6" : ""}>
                            {/* Left Sidebar - Member Selection (Only if has assets) */}
                            {hasAssetsForLoan && (
                                <div className="lg:col-span-1">
                                    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
                                        <div className="relative mb-4">
                                            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                                            <input
                                                type="text"
                                                placeholder="Search members..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-lg shadow-md overflow-hidden">
                                        <div className="p-4 bg-gray-50 border-b">
                                            <h3 className="font-semibold text-gray-800">Select Member</h3>
                                        </div>
                                        <div className="max-h-[600px] overflow-y-auto">
                                            {getAvailableMembers().length > 0 ? (
                                                getAvailableMembers().map((member) => (
                                                    <button
                                                        key={member.id}
                                                        onClick={() => setSelectedMember(member)}
                                                        className={`w-full p-4 border-b text-left transition-colors ${selectedMember?.id === member.id
                                                            ? "bg-blue-50 border-l-4 border-l-blue-600"
                                                            : "hover:bg-gray-50"
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <p className="font-semibold text-gray-800">{member.name}</p>
                                                                <p className="text-sm text-gray-600">Code: {member.code}</p>
                                                            </div>
                                                            <User
                                                                className={
                                                                    selectedMember?.id === member.id
                                                                        ? "text-blue-600"
                                                                        : "text-gray-400"
                                                                }
                                                                size={20}
                                                            />
                                                        </div>
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="p-8 text-center text-gray-500">
                                                    <p>No members found</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Right Side - Loan Form */}
                            <div className={hasAssetsForLoan ? "lg:col-span-2" : ""}>
                                {/* Show form if: (has assets AND member selected) OR (no assets) */}
                                {((hasAssetsForLoan && selectedMember) || !hasAssetsForLoan) ? (
                                    <div className="bg-white rounded-lg shadow-md p-6">
                                        {hasAssetsForLoan && selectedMember ? (
                                            <div className="flex items-center justify-between mb-4">
                                                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                                                    <User size={24} className="text-blue-600" />
                                                    {selectedMember.name} ({selectedMember.code})
                                                </h2>
                                                <button
                                                    onClick={() => {
                                                        setSelectedMember(null);
                                                        setTransactionType("");
                                                        setPaymentMode("");
                setSelectedBankId("");
                setPurpose("");
                setAmount("");
                setTimePeriod("");
                setInstallmentAmount("");
                setBachanPathraPhoto(null);
                                                    }}
                                                    className="text-sm text-gray-600 hover:text-gray-800"
                                                >
                                                    Change Member
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="mb-4">
                                                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                                                    <Building2 size={24} className="text-blue-600" />
                                                    Group Management Loan
                                                </h2>
                                                <p className="text-gray-600 text-sm mt-1">
                                                    This loan is for group management and operational purposes
                                                </p>
                                            </div>
                                        )}

                                        {/* Show asset status (only if has assets) */}
                                        {hasAssetsForLoan && (
                                            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                                                <p className="text-sm text-gray-600">Asset Status:</p>
                                                <p className="font-semibold text-gray-800">Has Assets</p>
                                            </div>
                                        )}

                                        {/* Transaction Type */}
                                        <div className="mb-6">
                                            <Select
                                                label="Transaction Type *"
                                                name="transactionType"
                                                value={transactionType}
                                                handleChange={(e) => setTransactionType(e.target.value)}
                                                options={getTransactionTypes()}
                                                required
                                            />
                                        </div>

                                        {/* Payment Mode */}
                                        {transactionType && (
                                            <div className="mb-6">
                                                <Select
                                                    label="Payment Mode *"
                                                    name="paymentMode"
                                                    value={paymentMode}
                                                    handleChange={(e) => setPaymentMode(e.target.value)}
                                                    options={["Cash", "Bank"]}
                                                    required
                                                />
                                            </div>
                                        )}

                                        {/* Bank Selection - Show for both Cash and Bank payment modes */}
                                        {paymentMode && (
                                            <div className="mb-6">
                                                <Select
                                                    label={`Select Bank${paymentMode === "Bank" ? " *" : " (Optional)"}`}
                                                    name="selectedBankId"
                                                    value={selectedBankId}
                                                    handleChange={(e) => setSelectedBankId(e.target.value)}
                                                    options={groupBanks.length > 0 
                                                        ? groupBanks.map((bank) => ({
                                                            value: bank._id || bank.id,
                                                            label: `${bank.bank_name} - ${bank.account_no}${bank.short_name ? ` (${bank.short_name})` : ""}`
                                                        }))
                                                        : [{ value: "", label: "No banks available" }]
                                                    }
                                                    required={paymentMode === "Bank"}
                                                />
                                                {groupBanks.length === 0 && (
                                                    <p className="text-sm text-red-600 mt-1">
                                                        No banks found for this group. Please add a bank account first.
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {/* Purpose */}
                                        {paymentMode && (
                                            <div className="mb-6">
                                                <Input
                                                    label="Purpose *"
                                                    name="purpose"
                                                    value={purpose}
                                                    handleChange={(e) => setPurpose(e.target.value)}
                                                    placeholder="Enter purpose of transaction"
                                                    required
                                                />
                                            </div>
                                        )}

                                        {/* Amount */}
                                        {purpose && (
                                            <div className="mb-6">
                                                <Input
                                                    label="Amount *"
                                                    name="amount"
                                                    type="number"
                                                    value={amount}
                                                    handleChange={(e) => setAmount(e.target.value)}
                                                    placeholder="Enter amount"
                                                    required
                                                />
                                            </div>
                                        )}

                                        {/* Time Period */}
                                        {amount && (
                                            <div className="mb-6">
                                                <Input
                                                    label="Time Period (Months)"
                                                    name="timePeriod"
                                                    type="number"
                                                    value={timePeriod}
                                                    handleChange={(e) => setTimePeriod(e.target.value)}
                                                    placeholder="Enter loan duration in months"
                                                    min="1"
                                                />
                                            </div>
                                        )}

                                        {/* Installment Amount - Auto-calculated */}
                                        {timePeriod && amount && (
                                            <div className="mb-6">
                                                <div className="mb-2">
                                                    <label className="block text-sm font-semibold text-gray-700">
                                                        Installment Amount Per Month (Auto-calculated)
                                                    </label>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Calculated: ₹{parseFloat(amount || 0).toLocaleString('en-IN')} ÷ {timePeriod} months = ₹{installmentAmount || "0.00"}
                                                    </p>
                                                </div>
                                                <Input
                                                    label=""
                                                    name="installmentAmount"
                                                    type="number"
                                                    value={installmentAmount}
                                                    handleChange={(e) => setInstallmentAmount(e.target.value)}
                                                    placeholder="Auto-calculated monthly installment"
                                                    min="0"
                                                    step="0.01"
                                                />
                                                <p className="text-xs text-gray-500 mt-1">
                                                    You can manually adjust if needed
                                                </p>
                                            </div>
                                        )}

                                        {/* Bachan Pathra Photo */}
                                        {(amount || timePeriod || installmentAmount) && (
                                            <div className="mb-6">
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                    Bachan Pathra Photo (Optional)
                                                </label>
                                                <div className="flex flex-col items-center gap-4">
                                                    {bachanPathraPhoto ? (
                                                        <div className="relative">
                                                            <img
                                                                src={bachanPathraPhoto}
                                                                alt="Bachan Pathra"
                                                                className="max-w-full h-auto rounded-lg border-2 border-gray-300"
                                                            />
                                                            <button
                                                                onClick={() => setBachanPathraPhoto(null)}
                                                                className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full hover:bg-red-700"
                                                            >
                                                                <XCircle size={20} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <label className="flex flex-col items-center gap-3 p-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer">
                                                            <Camera size={48} className="text-gray-400" />
                                                            <span className="font-medium text-gray-700">Click to Upload Photo</span>
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                onChange={handlePhotoUpload}
                                                                className="hidden"
                                                            />
                                                        </label>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Submit Button */}
                                        {amount && (
                                            <div className="flex justify-end gap-4">
                                                <button
                                                    onClick={() => {
                                                        setSelectedMember(null);
                                                        setTransactionType("");
                                                        setPaymentMode("");
                setSelectedBankId("");
                setPurpose("");
                setAmount("");
                setTimePeriod("");
                setInstallmentAmount("");
                setBachanPathraPhoto(null);
                                                    }}
                                                    className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleSubmit}
                                                    className="px-8 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold shadow-md"
                                                >
                                                    Submit
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-lg shadow-md p-12 text-center">
                                        <User size={64} className="mx-auto mb-4 text-gray-400" />
                                        <p className="text-gray-600 text-lg">
                                            Please select a member to process loan transaction
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Back Button - Show if asset question is answered */}
                    {hasAssetsForLoan !== null && (
                        <div className="mt-6">
                            <button
                                onClick={() => {
                                    if (window.confirm("Are you sure you want to go back? All entered data will be lost.")) {
                                        setHasAssetsForLoan(null);
                                        setSelectedMember(null);
                                        setTransactionType("");
                                        setPaymentMode("");
                setSelectedBankId("");
                setPurpose("");
                setAmount("");
                setTimePeriod("");
                setInstallmentAmount("");
                setBachanPathraPhoto(null);
                                    }
                                }}
                                className="flex items-center gap-2 px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                            >
                                <ArrowLeft size={18} />
                                Back to Asset Check
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

