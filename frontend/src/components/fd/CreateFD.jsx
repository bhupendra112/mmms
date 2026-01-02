import React, { useState, useEffect } from "react";
import { X, DollarSign, Calendar, Wallet, CreditCard } from "lucide-react";
import { Input, Select } from "../forms/FormComponents";
import { createFD } from "../../services/fdService";
import { getGroups, getGroupBanks } from "../../services/groupService";
import { getCashAmount } from "../../services/cashAmount";

export default function CreateFD({ member, onClose, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [groups, setGroups] = useState([]);
    const [selectedGroupId, setSelectedGroupId] = useState("");
    const [amount, setAmount] = useState("");
    const [timePeriod, setTimePeriod] = useState("");
    const [paymentMode, setPaymentMode] = useState({ cash: false, online: false });
    const [onlineRef, setOnlineRef] = useState("");
    const [selectedBankId, setSelectedBankId] = useState("");
    const [groupBanks, setGroupBanks] = useState([]);
    const [fdRate, setFdRate] = useState(null);
    const [calculatedInterest, setCalculatedInterest] = useState(0);
    const [calculatedMaturity, setCalculatedMaturity] = useState(0);
    const [groupCashBalance, setGroupCashBalance] = useState(0);

    // Load groups if member doesn't have group info
    useEffect(() => {
        if (!member?.group) {
            getGroups()
                .then((res) => {
                    const list = Array.isArray(res?.data) ? res.data : [];
                    setGroups(list);
                    // Auto-select member's group if available
                    if (member?.Group_Name) {
                        const memberGroup = list.find(
                            (g) => g.group_name === member.Group_Name
                        );
                        if (memberGroup) {
                            setSelectedGroupId(memberGroup._id);
                        }
                    }
                })
                .catch((e) => {
                    console.error("Failed to load groups:", e);
                });
        } else {
            // Member has group info
            const groupId = member.group._id || member.group;
            setSelectedGroupId(groupId);
        }
    }, [member]);

    // Load FD rate and banks when group is selected
    useEffect(() => {
        if (selectedGroupId) {
            const selectedGroup = groups.find((g) => g._id === selectedGroupId);
            if (selectedGroup) {
                setFdRate(selectedGroup.fd_rate || 0);
            } else if (member?.group) {
                // Get from member's group
                const group = member.group;
                setFdRate(group.fd_rate || 0);
            }

            // Load banks for the selected group
            getGroupBanks(selectedGroupId)
                .then((res) => {
                    setGroupBanks(Array.isArray(res?.data) ? res.data : []);
                })
                .catch((e) => {
                    console.error("Failed to load banks:", e);
                    setGroupBanks([]);
                });

            // Load cash balance
            getCashAmount(selectedGroupId)
                .then((res) => {
                    const balance = res?.data?.groupCashBalance || res?.data?.cashAmount || 0;
                    setGroupCashBalance(balance);
                })
                .catch((e) => {
                    console.error("Failed to load cash balance:", e);
                    setGroupCashBalance(0);
                });
        } else {
            setGroupBanks([]);
            setGroupCashBalance(0);
        }
    }, [selectedGroupId, groups, member]);

    // Calculate interest and maturity amount
    useEffect(() => {
        if (amount && timePeriod && fdRate !== null) {
            const principal = parseFloat(amount) || 0;
            const years = parseFloat(timePeriod) || 0;
            const rate = parseFloat(fdRate) || 0;

            if (principal > 0 && years > 0 && rate >= 0) {
                const interest = (principal * rate * years) / 100;
                const maturity = principal + interest;

                setCalculatedInterest(interest.toFixed(2));
                setCalculatedMaturity(maturity.toFixed(2));
            } else {
                setCalculatedInterest(0);
                setCalculatedMaturity(0);
            }
        } else {
            setCalculatedInterest(0);
            setCalculatedMaturity(0);
        }
    }, [amount, timePeriod, fdRate]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!selectedGroupId) {
            alert("Please select a group");
            return;
        }

        if (!amount || parseFloat(amount) <= 0) {
            alert("Please enter a valid amount");
            return;
        }

        if (!timePeriod || parseFloat(timePeriod) <= 0) {
            alert("Please enter a valid time period");
            return;
        }

        if (!paymentMode.cash && !paymentMode.online) {
            alert("Please select payment mode");
            return;
        }

        if (paymentMode.online && !onlineRef.trim()) {
            alert("Please enter online payment reference number");
            return;
        }

        if (paymentMode.online && !selectedBankId) {
            alert("Please select a bank for online payment");
            return;
        }

        // Validate balance based on payment mode
        // Note: For cash FD, member gives cash to group, so group's cash balance will increase (no validation needed)
        // For bank FD, group pays from bank, so we need to check bank balance
        const fdAmount = parseFloat(amount);
        if (paymentMode.online && selectedBankId) {
            const selectedBank = groupBanks.find(b => (b._id || b.id) === selectedBankId);
            if (selectedBank) {
                const availableBalance = selectedBank.available_balance !== undefined
                    ? selectedBank.available_balance
                    : (selectedBank.current_balance !== undefined
                        ? selectedBank.current_balance
                        : (selectedBank.opening_balance || 0));
                
                if (availableBalance < fdAmount) {
                    alert(`Insufficient bank balance. Available: ₹${availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, Required: ₹${fdAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                    return;
                }
            }
        }

        try {
            setLoading(true);

            const fdData = {
                memberId: member._id || member.id,
                groupId: selectedGroupId,
                amount: parseFloat(amount),
                time_period: parseFloat(timePeriod), // Send in years, backend will convert to months
                paymentMode,
                onlineRef: paymentMode.online ? onlineRef : null,
                bankId: paymentMode.online ? selectedBankId : null,
                date: new Date().toLocaleDateString("en-GB"),
            };

            const response = await createFD(fdData);

            if (response?.success) {
                alert("FD created successfully!");
                if (onSuccess) onSuccess(response.data);
                onClose();
            } else {
                alert(response?.message || "Failed to create FD");
            }
        } catch (error) {
            console.error("Error creating FD:", error);
            alert(error?.response?.data?.message || error?.message || "Error creating FD");
        } finally {
            setLoading(false);
        }
    };

    const handlePaymentModeChange = (mode) => {
        setPaymentMode({
            ...paymentMode,
            [mode]: !paymentMode[mode],
        });
        if (mode === "cash" && paymentMode.online) {
            setOnlineRef("");
            setSelectedBankId("");
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <DollarSign size={28} />
                        Create New FD
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Member Info */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Member</p>
                        <p className="font-semibold text-gray-800">
                            {member?.Member_Nm || member?.name} ({member?.Member_Id || member?.code})
                        </p>
                    </div>

                    {/* Group Selection (if needed) */}
                    {!member?.group && groups.length > 0 && (
                        <div>
                            <Select
                                label="Group *"
                                name="groupId"
                                value={selectedGroupId}
                                handleChange={(e) => setSelectedGroupId(e.target.value)}
                                options={groups.map((g) => ({
                                    value: g._id,
                                    label: `${g.group_name} (${g.group_code})`,
                                }))}
                                required
                            />
                        </div>
                    )}

                    {/* Balance Display */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4">
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
                                                {amount && paymentMode.cash && parseFloat(amount) > 0 && (
                                                    <p className="text-xs mt-1 text-blue-600">
                                                        ℹ️ Cash will be added to group balance
                                                    </p>
                                                )}
                            </div>
                            {/* Bank Balance Summary */}
                            {groupBanks.length > 0 && (
                                <div className="bg-white rounded-lg p-3 border border-gray-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <CreditCard size={16} className="text-blue-600" />
                                            <span className="text-sm font-medium text-gray-700">Bank Accounts</span>
                                        </div>
                                        <span className="text-xs text-gray-500">{groupBanks.length} account{groupBanks.length !== 1 ? 's' : ''}</span>
                                    </div>
                                    {selectedBankId && paymentMode.online && (() => {
                                        const selectedBank = groupBanks.find(b => (b._id || b.id) === selectedBankId);
                                        if (!selectedBank) return null;
                                        const availableBalance = selectedBank.available_balance !== undefined
                                            ? selectedBank.available_balance
                                            : (selectedBank.current_balance !== undefined
                                                ? selectedBank.current_balance
                                                : (selectedBank.opening_balance || 0));
                                        return (
                                            <div className="text-sm">
                                                <span className="text-gray-600">{selectedBank.bank_name || 'Bank'}: </span>
                                                <span className={`font-bold ${availableBalance >= parseFloat(amount || 0) ? 'text-blue-600' : 'text-red-600'}`}>
                                                    ₹{availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                                {amount && parseFloat(amount) > 0 && (
                                                    <p className={`text-xs mt-1 ${availableBalance >= parseFloat(amount) ? 'text-green-600' : 'text-red-600'}`}>
                                                        {availableBalance >= parseFloat(amount) 
                                                            ? `✓ Sufficient balance`
                                                            : `✗ Insufficient balance`
                                                        }
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })()}
                                    {(!selectedBankId || !paymentMode.online) && (
                                        <span className="text-xs text-gray-500">Select a bank to see balance</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* FD Rate Display */}
                    {fdRate !== null && (
                        <div className="bg-blue-50 p-4 rounded-lg">
                            <p className="text-sm text-gray-600">FD Interest Rate</p>
                            <p className="text-2xl font-bold text-blue-600">{fdRate}%</p>
                        </div>
                    )}

                    {/* Amount */}
                    <Input
                        label="FD Amount (₹) *"
                        name="amount"
                        type="number"
                        value={amount}
                        handleChange={(e) => setAmount(e.target.value)}
                        placeholder="Enter FD amount"
                        min="0"
                        step="0.01"
                        required
                    />

                    {/* Time Period */}
                    <Input
                        label="Time Period (Years) *"
                        name="timePeriod"
                        type="number"
                        value={timePeriod}
                        handleChange={(e) => setTimePeriod(e.target.value)}
                        placeholder="Enter time period in years"
                        min="0.1"
                        step="0.1"
                        required
                    />

                    {/* Calculation Preview */}
                    {amount && timePeriod && fdRate !== null && (
                        <div className="bg-green-50 p-4 rounded-lg space-y-2">
                            <p className="text-sm font-semibold text-gray-700">Calculation Preview:</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-gray-600">Principal Amount</p>
                                    <p className="text-lg font-bold text-gray-800">₹{parseFloat(amount || 0).toLocaleString('en-IN')}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-600">Interest Rate</p>
                                    <p className="text-lg font-bold text-gray-800">{fdRate}%</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-600">Time Period</p>
                                    <p className="text-lg font-bold text-gray-800">{timePeriod} {parseFloat(timePeriod) === 1 ? 'year' : 'years'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-600">Interest Amount</p>
                                    <p className="text-lg font-bold text-green-600">₹{parseFloat(calculatedInterest || 0).toLocaleString('en-IN')}</p>
                                </div>
                                <div className="col-span-2 border-t pt-2">
                                    <p className="text-xs text-gray-600">Maturity Amount</p>
                                    <p className="text-xl font-bold text-green-700">₹{parseFloat(calculatedMaturity || 0).toLocaleString('en-IN')}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Payment Mode */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Payment Mode *
                        </label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={paymentMode.cash}
                                    onChange={() => handlePaymentModeChange("cash")}
                                    className="w-4 h-4"
                                />
                                <span>Cash</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={paymentMode.online}
                                    onChange={() => handlePaymentModeChange("online")}
                                    className="w-4 h-4"
                                />
                                <span>Online</span>
                            </label>
                        </div>
                    </div>

                    {/* Online Payment Details */}
                    {paymentMode.online && (
                        <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <Select
                                label="Select Bank *"
                                name="selectedBankId"
                                value={selectedBankId}
                                handleChange={(e) => setSelectedBankId(e.target.value)}
                                options={groupBanks.length > 0
                                    ? groupBanks.map((bank) => {
                                        // Use available_balance if available, else fallback to current_balance or opening_balance
                                        const balance = bank.available_balance !== undefined
                                            ? bank.available_balance
                                            : (bank.current_balance !== undefined
                                                ? bank.current_balance
                                                : (bank.opening_balance || 0));
                                        const balanceFormatted = `₹${balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                        return {
                                            value: bank._id || bank.id,
                                            label: `${bank.bank_name} - ${bank.account_no}${bank.short_name ? ` (${bank.short_name})` : ""} [Available: ${balanceFormatted}]`
                                        };
                                    })
                                    : [{ value: "", label: "No banks available" }]
                                }
                                required
                            />
                            {groupBanks.length === 0 && (
                                <p className="text-sm text-red-600 mt-1">
                                    No banks found for this group. Please add a bank account first.
                                </p>
                            )}
                        <Input
                            label="Online Payment Reference *"
                            name="onlineRef"
                            value={onlineRef}
                            handleChange={(e) => setOnlineRef(e.target.value)}
                            placeholder="Enter payment reference number"
                            required
                        />
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="flex justify-end gap-4 pt-4 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={loading}
                        >
                            {loading ? "Creating..." : "Create FD"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

