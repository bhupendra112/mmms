import React, { useEffect, useMemo, useState } from "react";
import { Receipt, Plus, Search, Building2, Edit, Trash2, X, DollarSign, Wallet, CreditCard } from "lucide-react";
import { getGroups, getGroupBanks } from "../../services/groupService";
import { getExpenses, createExpense, updateExpense, deleteExpense } from "../../services/expenseService";
import { getCashAmount } from "../../services/cashAmount";

export default function ExpenseManagement() {
    const [groups, setGroups] = useState([]);
    const [groupsLoading, setGroupsLoading] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [expenses, setExpenses] = useState([]);
    const [expensesLoading, setExpensesLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [expenseTypeFilter, setExpenseTypeFilter] = useState("all");
    const [showModal, setShowModal] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [groupBanks, setGroupBanks] = useState([]);
    const [groupCashBalance, setGroupCashBalance] = useState(0);
    const [form, setForm] = useState({
        groupId: "",
        expenseType: "",
        amount: "",
        date: "",
        paymentMode: "Cash",
        bankId: "",
        purpose: "",
    });

    useEffect(() => {
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
                    }))
                );
            })
            .catch((e) => {
                console.error("Failed to load groups:", e);
                setGroups([]);
            })
            .finally(() => setGroupsLoading(false));
    }, []);

    useEffect(() => {
        if (selectedGroup?.id) {
            loadExpenses(selectedGroup.id);
            loadGroupBanks(selectedGroup.id);
            loadCashBalance(selectedGroup.id);
        }
    }, [selectedGroup]);

    const loadCashBalance = async (groupId) => {
        try {
            const res = await getCashAmount(groupId);
            const balance = res?.data?.groupCashBalance || res?.data?.cashAmount || 0;
            setGroupCashBalance(balance);
        } catch (e) {
            console.error("Failed to load cash balance:", e);
            setGroupCashBalance(0);
        }
    };

    const loadGroupBanks = async (groupId) => {
        try {
            const res = await getGroupBanks(groupId);
            const banks = Array.isArray(res?.data) ? res.data : [];
            setGroupBanks(banks);
        } catch (e) {
            console.error("Failed to load banks:", e);
            setGroupBanks([]);
        }
    };

    const loadExpenses = async (groupId) => {
        try {
            setExpensesLoading(true);
            const response = await getExpenses({ groupId });
            const expensesList = Array.isArray(response?.data) ? response.data : [];
            setExpenses(expensesList);
        } catch (e) {
            console.error("Failed to load expenses:", e);
            setExpenses([]);
        } finally {
            setExpensesLoading(false);
        }
    };

    const handleOpenModal = (expense = null) => {
        if (expense) {
            setEditingExpense(expense);
            setForm({
                groupId: expense.groupId?._id || expense.groupId || selectedGroup?.id || "",
                expenseType: expense.expenseType || "",
                amount: expense.amount || "",
                date: expense.date ? new Date(expense.date).toISOString().split("T")[0] : "",
                paymentMode: expense.paymentMode || "Cash",
                bankId: expense.bankId?._id || expense.bankId || "",
                purpose: expense.purpose || "",
            });
        } else {
            setEditingExpense(null);
            setForm({
                groupId: selectedGroup?.id || "",
                expenseType: "",
                amount: "",
                date: new Date().toISOString().split("T")[0],
                paymentMode: "Cash",
                bankId: "",
                purpose: "",
            });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingExpense(null);
        setForm({
            groupId: "",
            expenseType: "",
            amount: "",
            date: "",
            paymentMode: "Cash",
            bankId: "",
            purpose: "",
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (!form.groupId) {
                alert("Please select a group");
                return;
            }
            if (!form.expenseType) {
                alert("Please select expense type");
                return;
            }
            if (!form.amount || parseFloat(form.amount) < 0) {
                alert("Please enter a valid amount");
                return;
            }
            if (!form.date) {
                alert("Please select a date");
                return;
            }
            if (form.paymentMode === "Bank" && !form.bankId) {
                alert("Please select a bank for bank payment");
                return;
            }

            // Validate balance based on payment mode
            const expenseAmount = parseFloat(form.amount);
            if (form.paymentMode === "Cash") {
                if (groupCashBalance < expenseAmount) {
                    alert(`Insufficient cash balance. Available: ₹${groupCashBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, Required: ₹${expenseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                    return;
                }
            } else if (form.paymentMode === "Bank" && form.bankId) {
                const selectedBank = groupBanks.find(b => (b._id || b.id) === form.bankId);
                if (selectedBank) {
                    const availableBalance = selectedBank.available_balance !== undefined
                        ? selectedBank.available_balance
                        : (selectedBank.current_balance !== undefined
                            ? selectedBank.current_balance
                            : (selectedBank.opening_balance || 0));
                    
                    if (availableBalance < expenseAmount) {
                        alert(`Insufficient bank balance. Available: ₹${availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, Required: ₹${expenseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                        return;
                    }
                }
            }

            if (editingExpense) {
                await updateExpense(editingExpense._id || editingExpense.id, form);
                alert("Expense updated successfully!");
            } else {
                await createExpense(form);
                alert("Expense created successfully!");
            }
            handleCloseModal();
            if (selectedGroup?.id) {
                loadExpenses(selectedGroup.id);
            }
        } catch (error) {
            alert(error.message || "Failed to save expense");
        }
    };

    const handleDelete = async (expenseId) => {
        if (!window.confirm("Are you sure you want to delete this expense?")) {
            return;
        }
        try {
            await deleteExpense(expenseId);
            alert("Expense deleted successfully!");
            if (selectedGroup?.id) {
                loadExpenses(selectedGroup.id);
            }
        } catch (error) {
            alert(error.message || "Failed to delete expense");
        }
    };

    // Get unique expense types from expenses for filter dropdown
    const uniqueExpenseTypes = useMemo(() => {
        const types = new Set();
        expenses.forEach((exp) => {
            if (exp.expenseType) {
                types.add(exp.expenseType);
            }
        });
        return Array.from(types).sort();
    }, [expenses]);

    const filteredExpenses = useMemo(() => {
        let filtered = expenses;
        
        if (expenseTypeFilter !== "all") {
            filtered = filtered.filter((exp) => exp.expenseType === expenseTypeFilter);
        }
        
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            filtered = filtered.filter((exp) => {
                const purpose = String(exp.purpose || "").toLowerCase();
                const expenseType = String(exp.expenseType || "").toLowerCase();
                return purpose.includes(q) || expenseType.includes(q);
            });
        }
        
        return filtered;
    }, [expenses, expenseTypeFilter, searchTerm]);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
        }).format(amount || 0);
    };

    const formatDate = (date) => {
        if (!date) return "-";
        try {
            return new Date(date).toLocaleDateString("en-GB");
        } catch {
            return "-";
        }
    };

    if (!selectedGroup) {
        return (
            <div className="max-w-7xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <Receipt size={32} />
                        Expense Management
                    </h1>
                    <p className="text-gray-600 mt-2">Select a group to manage expenses</p>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <Building2 size={24} className="text-blue-600" />
                        Select Group
                    </h2>
                    {groupsLoading ? (
                        <p className="text-gray-600">Loading groups…</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {groups.map((g) => (
                                <div
                                    key={g.id}
                                    onClick={() => setSelectedGroup(g)}
                                    className="p-6 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3 mb-3">
                                        <Building2 className="text-blue-600" size={32} />
                                        <div>
                                            <p className="font-semibold text-gray-800 text-lg">{g.name}</p>
                                            <p className="text-sm text-gray-600">Code: {g.code}</p>
                                        </div>
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        <p>Village: {g.village || "-"}</p>
                                    </div>
                                </div>
                            ))}
                            {groups.length === 0 && (
                                <div className="col-span-full text-center py-8 text-gray-500">
                                    <p>No groups found.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <button
                        onClick={() => setSelectedGroup(null)}
                        className="text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-2"
                    >
                        ← Back to Groups
                    </button>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <Receipt size={32} />
                        Expense Management - {selectedGroup.name}
                    </h1>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    <Plus size={20} />
                    Add Expense
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-md p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search by purpose..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <select
                            value={expenseTypeFilter}
                            onChange={(e) => setExpenseTypeFilter(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All Expense Types</option>
                            {uniqueExpenseTypes.map((type) => (
                                <option key={type} value={type}>
                                    {type}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                            Filter by expense type. "Other" expenses are group-level expenses created via Loan Management
                        </p>
                    </div>
                </div>
            </div>

            {/* Expenses Table */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                {expensesLoading ? (
                    <div className="p-8 text-center text-gray-600">Loading expenses...</div>
                ) : filteredExpenses.length === 0 ? (
                    <div className="p-8 text-center text-gray-600">No expenses found</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead className="bg-blue-600 text-white">
                                <tr>
                                    <th className="p-3 border text-left">Date</th>
                                    <th className="p-3 border text-left">Type</th>
                                    <th className="p-3 border text-left">Purpose</th>
                                    <th className="p-3 border text-right">Amount</th>
                                    <th className="p-3 border text-left">Payment Mode</th>
                                    <th className="p-3 border text-left">Bank</th>
                                    <th className="p-3 border text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredExpenses.map((expense, index) => (
                                    <tr key={expense._id || expense.id || index} className="odd:bg-gray-50 hover:bg-blue-50">
                                        <td className="p-3 border">{formatDate(expense.date)}</td>
                                        <td className="p-3 border">
                                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                                                {expense.expenseType}
                                            </span>
                                        </td>
                                        <td className="p-3 border">{expense.purpose || "-"}</td>
                                        <td className="p-3 border text-right font-semibold">{formatCurrency(expense.amount)}</td>
                                        <td className="p-3 border">{expense.paymentMode}</td>
                                        <td className="p-3 border">
                                            {expense.paymentMode === "Bank" && expense.bankId
                                                ? (typeof expense.bankId === "object"
                                                      ? `${expense.bankId.bank_name || ""} - ${expense.bankId.account_no || ""}`
                                                      : "-")
                                                : "-"}
                                        </td>
                                        <td className="p-3 border">
                                            <div className="flex items-center justify-center gap-2">
                                                {expense._fromLoanMaster ? (
                                                    <span className="text-xs text-gray-500 italic">
                                                        Managed via Loan Management
                                                    </span>
                                                ) : (
                                                    <>
                                                <button
                                                    onClick={() => handleOpenModal(expense)}
                                                    className="p-2 text-blue-600 hover:bg-blue-100 rounded"
                                                    title="Edit"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(expense._id || expense.id)}
                                                    className="p-2 text-red-600 hover:bg-red-100 rounded"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-100 font-semibold">
                                <tr>
                                    <td colSpan="3" className="p-3 border text-right">Total:</td>
                                    <td className="p-3 border text-right">
                                        {formatCurrency(filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0))}
                                    </td>
                                    <td colSpan="3" className="p-3 border"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-800">
                                {editingExpense ? "Edit Expense" : "Add Expense"}
                            </h3>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Balance Display */}
                            {form.groupId && (
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
                                            {form.amount && form.paymentMode === "Cash" && parseFloat(form.amount) > 0 && (
                                                <p className={`text-xs mt-1 ${groupCashBalance >= parseFloat(form.amount) ? 'text-green-600' : 'text-red-600'}`}>
                                                    {groupCashBalance >= parseFloat(form.amount) 
                                                        ? `✓ Sufficient balance`
                                                        : `✗ Insufficient balance`
                                                    }
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
                                                {form.bankId && form.paymentMode === "Bank" && (() => {
                                                    const selectedBank = groupBanks.find(b => (b._id || b.id) === form.bankId);
                                                    if (!selectedBank) return null;
                                                    const availableBalance = selectedBank.available_balance !== undefined
                                                        ? selectedBank.available_balance
                                                        : (selectedBank.current_balance !== undefined
                                                            ? selectedBank.current_balance
                                                            : (selectedBank.opening_balance || 0));
                                                    return (
                                                        <div className="text-sm">
                                                            <span className="text-gray-600">{selectedBank.bank_name || 'Bank'}: </span>
                                                            <span className={`font-bold ${availableBalance >= parseFloat(form.amount || 0) ? 'text-blue-600' : 'text-red-600'}`}>
                                                                ₹{availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                            {form.amount && parseFloat(form.amount) > 0 && (
                                                                <p className={`text-xs mt-1 ${availableBalance >= parseFloat(form.amount) ? 'text-green-600' : 'text-red-600'}`}>
                                                                    {availableBalance >= parseFloat(form.amount) 
                                                                        ? `✓ Sufficient balance`
                                                                        : `✗ Insufficient balance`
                                                                    }
                                                                </p>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                                {(!form.bankId || form.paymentMode !== "Bank") && (
                                                    <span className="text-xs text-gray-500">Select a bank to see balance</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">
                                    Group *
                                </label>
                                <select
                                    value={form.groupId}
                                    onChange={(e) => setForm({ ...form, groupId: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    required
                                >
                                    <option value="">Select Group</option>
                                    {groups.map((g) => (
                                        <option key={g.id} value={g.id}>
                                            {g.name} ({g.code})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                                        Expense Type *
                                    </label>
                                    <input
                                        type="text"
                                        value={form.expenseType}
                                        onChange={(e) => setForm({ ...form, expenseType: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="Enter expense type (e.g., Stationery, Travel, etc.)"
                                        required
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Enter any expense type name manually
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                                        Amount *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={form.amount}
                                        onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                                        Date *
                                    </label>
                                    <input
                                        type="date"
                                        value={form.date}
                                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                                        Payment Mode *
                                    </label>
                                    <select
                                        value={form.paymentMode}
                                        onChange={(e) => {
                                            const newForm = { ...form, paymentMode: e.target.value };
                                            if (e.target.value === "Cash") {
                                                newForm.bankId = "";
                                            }
                                            setForm(newForm);
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        required
                                    >
                                        <option value="Cash">Cash</option>
                                        <option value="Bank">Bank</option>
                                    </select>
                                </div>
                            </div>
                            {form.paymentMode === "Bank" && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                                        Bank *
                                    </label>
                                    <select
                                        value={form.bankId}
                                        onChange={(e) => setForm({ ...form, bankId: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        required={form.paymentMode === "Bank"}
                                    >
                                        <option value="">Select Bank</option>
                                        {groupBanks.map((bank) => {
                                            // Use available_balance if available, else fallback to current_balance or opening_balance
                                            const balance = bank.available_balance !== undefined 
                                                ? bank.available_balance 
                                                : (bank.current_balance !== undefined 
                                                    ? bank.current_balance 
                                                    : (bank.opening_balance || 0));
                                            const balanceFormatted = `₹${balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                            return (
                                            <option key={bank._id || bank.id} value={bank._id || bank.id}>
                                                    {bank.bank_name} - {bank.account_no} [Available: {balanceFormatted}]
                                            </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">
                                    Purpose / Description
                                </label>
                                <textarea
                                    value={form.purpose}
                                    onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    rows={3}
                                    placeholder="Enter purpose or description"
                                />
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    {editingExpense ? "Update Expense" : "Create Expense"}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

