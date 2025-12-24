import React, { useState, useEffect } from "react";
import { X, DollarSign, Calendar } from "lucide-react";
import { Input, Select } from "../forms/FormComponents";
import { createFD } from "../../services/fdService";
import { getGroups } from "../../services/groupService";

export default function CreateFD({ member, onClose, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [groups, setGroups] = useState([]);
    const [selectedGroupId, setSelectedGroupId] = useState("");
    const [amount, setAmount] = useState("");
    const [timePeriod, setTimePeriod] = useState("");
    const [paymentMode, setPaymentMode] = useState({ cash: false, online: false });
    const [onlineRef, setOnlineRef] = useState("");
    const [fdRate, setFdRate] = useState(null);
    const [calculatedInterest, setCalculatedInterest] = useState(0);
    const [calculatedMaturity, setCalculatedMaturity] = useState(0);

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

    // Load FD rate when group is selected
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
        }
    }, [selectedGroupId, groups, member]);

    // Calculate interest and maturity amount
    useEffect(() => {
        if (amount && timePeriod && fdRate !== null) {
            const principal = parseFloat(amount) || 0;
            const months = parseFloat(timePeriod) || 0;
            const rate = parseFloat(fdRate) || 0;

            if (principal > 0 && months > 0 && rate >= 0) {
                const years = months / 12;
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

        try {
            setLoading(true);

            const fdData = {
                memberId: member._id || member.id,
                groupId: selectedGroupId,
                amount: parseFloat(amount),
                time_period: parseInt(timePeriod),
                paymentMode,
                onlineRef: paymentMode.online ? onlineRef : null,
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
                        label="Time Period (Months) *"
                        name="timePeriod"
                        type="number"
                        value={timePeriod}
                        handleChange={(e) => setTimePeriod(e.target.value)}
                        placeholder="Enter time period in months"
                        min="1"
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
                                    <p className="text-lg font-bold text-gray-800">{timePeriod} months</p>
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

                    {/* Online Reference */}
                    {paymentMode.online && (
                        <Input
                            label="Online Payment Reference *"
                            name="onlineRef"
                            value={onlineRef}
                            handleChange={(e) => setOnlineRef(e.target.value)}
                            placeholder="Enter payment reference number"
                            required
                        />
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

