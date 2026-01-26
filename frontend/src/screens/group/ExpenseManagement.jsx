import React, { useEffect, useMemo, useState } from "react";
import {
    Receipt,
    Plus,
    Search,
    Edit,
    Trash2,
    X,
    Wallet,
    CreditCard,
    AlertTriangle,
} from "lucide-react";
import { useGroup } from "../../contexts/GroupContext";
import { useOffline } from "../../contexts/OfflineContext";

// Offline-first service - all operations save to IndexedDB first
import {
    getExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
} from "../../services/expenseServiceOffline";

import { getGroupBanks } from "../../services/groupServiceOffline";
import { getCashAmount } from "../../services/cashAmount";

export default function ExpenseManagement() {
    const { currentGroup, isGroupLoading } = useGroup();
    const { lastRefreshedAt } = useOffline();

    const [expenses, setExpenses] = useState([]);
    const [expensesLoading, setExpensesLoading] = useState(false);

    const [searchTerm, setSearchTerm] = useState("");
    const [expenseTypeFilter, setExpenseTypeFilter] = useState("all");
    const [entryTypeFilter, setEntryTypeFilter] = useState("all"); // NEW

    const [showModal, setShowModal] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);

    const [groupBanks, setGroupBanks] = useState([]);
    const [groupCashBalance, setGroupCashBalance] = useState(0);

    const [form, setForm] = useState({
        expenseType: "",
        amount: "",
        date: "",
        paymentMode: "Cash",
        bankId: "",
        purpose: "",
        entryType: "expense",
    });

    // ------- helpers -------
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
        }).format(Number(amount || 0));
    };

    const formatDate = (date) => {
        if (!date) return "-";
        try {
            return new Date(date).toLocaleDateString("en-GB");
        } catch {
            return "-";
        }
    };

    const safeToNumber = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    };

    const getBankBalance = (bank) => {
        if (!bank) return 0;
        if (bank.available_balance !== undefined) return safeToNumber(bank.available_balance);
        if (bank.current_balance !== undefined) return safeToNumber(bank.current_balance);
        return safeToNumber(bank.opening_balance);
    };

    const getExpenseId = (e) => e?._id || e?.id;

    // ------- data loaders -------
    useEffect(() => {
        if (currentGroup?.id) {
            loadExpenses();
            loadGroupBanks();
            loadCashBalance();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentGroup?.id, lastRefreshedAt]);

    const loadCashBalance = async () => {
        if (!currentGroup?.id) return;
        try {
            const res = await getCashAmount(currentGroup.id);
            const balance =
                res?.data?.groupCashBalance ?? res?.data?.cashAmount ?? 0;
            setGroupCashBalance(safeToNumber(balance));
        } catch (e) {
            console.error("Failed to load cash balance:", e);
            setGroupCashBalance(0);
        }
    };

    const loadGroupBanks = async () => {
        if (!currentGroup?.id) return;
        try {
            const res = await getGroupBanks(currentGroup.id);
            const banks = Array.isArray(res?.data) ? res.data : [];
            setGroupBanks(banks);
        } catch (e) {
            console.error("Failed to load banks:", e);
            setGroupBanks([]);
        }
    };

    const loadExpenses = async () => {
        if (!currentGroup?.id) return;
        try {
            setExpensesLoading(true);
            const response = await getExpenses({ groupId: currentGroup.id });
            const expensesList = Array.isArray(response?.data) ? response.data : [];
            setExpenses(expensesList);
        } catch (e) {
            console.error("Failed to load expenses:", e);
            setExpenses([]);
        } finally {
            setExpensesLoading(false);
        }
    };

    // ------- modal handlers -------
    const handleOpenModal = (expense = null) => {
        if (expense) {
            setEditingExpense(expense);
            setForm({
                expenseType: expense.expenseType || "",
                amount: expense.amount ?? "",
                date: expense.date
                    ? new Date(expense.date).toISOString().split("T")[0]
                    : "",
                paymentMode: expense.paymentMode || "Cash",
                bankId: expense.bankId?._id || expense.bankId || "",
                purpose: expense.purpose || "",
                entryType: expense.entryType || "expense",
            });
        } else {
            setEditingExpense(null);
            setForm({
                expenseType: "",
                amount: "",
                date: new Date().toISOString().split("T")[0],
                paymentMode: "Cash",
                bankId: "",
                purpose: "",
                entryType: "expense",
            });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingExpense(null);
        setForm({
            expenseType: "",
            amount: "",
            date: "",
            paymentMode: "Cash",
            bankId: "",
            purpose: "",
            entryType: "expense",
        });
    };

    // ------- validations (responsive UI also shows live status) -------
    const expenseAmount = useMemo(() => safeToNumber(form.amount), [form.amount]);

    const selectedBank = useMemo(() => {
        if (!form.bankId) return null;
        return groupBanks.find((b) => (b._id || b.id) === form.bankId) || null;
    }, [form.bankId, groupBanks]);

    const selectedBankBalance = useMemo(
        () => getBankBalance(selectedBank),
        [selectedBank]
    );

    const cashSufficient = useMemo(() => {
        if (form.paymentMode !== "Cash") return true;
        if (!expenseAmount) return true;
        return groupCashBalance >= expenseAmount;
    }, [form.paymentMode, expenseAmount, groupCashBalance]);

    const bankSufficient = useMemo(() => {
        if (form.paymentMode !== "Bank") return true;
        if (!form.bankId) return true;
        if (!expenseAmount) return true;
        return selectedBankBalance >= expenseAmount;
    }, [form.paymentMode, form.bankId, expenseAmount, selectedBankBalance]);

    const canSubmit = useMemo(() => {
        if (!currentGroup?.id) return false;
        if (!form.expenseType?.trim()) return false;
        if (!form.date) return false;
        if (expenseAmount < 0) return false;
        if (!form.amount) return false;
        if (form.paymentMode === "Bank" && !form.bankId) return false;
        if (!cashSufficient) return false;
        if (!bankSufficient) return false;
        return true;
    }, [
        currentGroup?.id,
        form.expenseType,
        form.date,
        form.amount,
        form.paymentMode,
        form.bankId,
        expenseAmount,
        cashSufficient,
        bankSufficient,
    ]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!currentGroup?.id) {
            alert("Group not loaded. Please refresh the page.");
            return;
        }
        if (!form.expenseType?.trim()) return alert("Please select expense type");
        if (!form.amount || expenseAmount < 0)
            return alert("Please enter a valid amount");
        if (!form.date) return alert("Please select a date");
        if (form.paymentMode === "Bank" && !form.bankId)
            return alert("Please select a bank for bank payment");

        if (form.paymentMode === "Cash" && !cashSufficient) {
            return alert(
                `Insufficient cash balance. Available: ₹${groupCashBalance.toLocaleString(
                    "en-IN",
                    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                )}, Required: ₹${expenseAmount.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                })}`
            );
        }

        if (form.paymentMode === "Bank" && form.bankId && !bankSufficient) {
            return alert(
                `Insufficient bank balance. Available: ₹${selectedBankBalance.toLocaleString(
                    "en-IN",
                    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                )}, Required: ₹${expenseAmount.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                })}`
            );
        }

        try {
            const expenseData = {
                ...form,
                groupId: currentGroup.id,
                amount: expenseAmount, // normalize to number
            };

            if (editingExpense) {
                await updateExpense(getExpenseId(editingExpense), expenseData);
                alert("Expense updated successfully!");
            } else {
                await createExpense(expenseData);
                alert("Expense created successfully!");
            }

            handleCloseModal();
            await Promise.all([loadExpenses(), loadCashBalance()]);
        } catch (error) {
            alert(error?.message || "Failed to save expense");
        }
    };

    const handleDelete = async (expenseId) => {
        if (!window.confirm("Are you sure you want to delete this expense?")) return;
        try {
            await deleteExpense(expenseId);
            alert("Expense deleted successfully!");
            await Promise.all([loadExpenses(), loadCashBalance()]);
        } catch (error) {
            alert(error?.message || "Failed to delete expense");
        }
    };

    // ------- filters -------
    const uniqueExpenseTypes = useMemo(() => {
        const types = new Set();
        expenses.forEach((exp) => exp?.expenseType && types.add(exp.expenseType));
        return Array.from(types).sort();
    }, [expenses]);

    const filteredExpenses = useMemo(() => {
        let filtered = Array.isArray(expenses) ? [...expenses] : [];

        if (expenseTypeFilter !== "all") {
            filtered = filtered.filter((exp) => exp.expenseType === expenseTypeFilter);
        }

        if (entryTypeFilter !== "all") {
            filtered = filtered.filter((exp) => exp.entryType === entryTypeFilter);
        }

        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            filtered = filtered.filter((exp) => {
                const purpose = String(exp.purpose || "").toLowerCase();
                const expenseType = String(exp.expenseType || "").toLowerCase();
                const entryType = String(exp.entryType || "").toLowerCase();
                return (
                    purpose.includes(q) || expenseType.includes(q) || entryType.includes(q)
                );
            });
        }

        // New: Sort by date desc (best UX)
        filtered.sort((a, b) => {
            const da = a?.date ? new Date(a.date).getTime() : 0;
            const db = b?.date ? new Date(b.date).getTime() : 0;
            return db - da;
        });

        return filtered;
    }, [expenses, expenseTypeFilter, entryTypeFilter, searchTerm]);

    const totalAmount = useMemo(() => {
        return filteredExpenses.reduce((sum, exp) => sum + safeToNumber(exp?.amount), 0);
    }, [filteredExpenses]);

    // ------- states -------
    if (isGroupLoading) {
        return (
            <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6">
                <div className="rounded-xl bg-white shadow-sm border p-6 sm:p-8 text-center text-gray-600 text-sm sm:text-base">
                    Loading...
                </div>
            </div>
        );
    }

    if (!currentGroup) {
        return (
            <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6">
                <div className="rounded-xl bg-white shadow-sm border p-6 sm:p-8 text-center text-gray-600 text-sm sm:text-base">
                    Group not found. Please log in again.
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6">
            {/* Header */}
            <div className="mb-4 sm:mb-6 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2 sm:gap-3">
                        <Receipt className="shrink-0 w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" />
                        <span className="truncate">Expense Management</span>
                    </h1>
                    <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">
                        {currentGroup.name} ({currentGroup.code})
                    </p>
                </div>

                <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-2 sm:gap-3 lg:items-center">
                    {/* Quick balances (responsive) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full lg:w-auto">
                        <div className="rounded-xl bg-white border shadow-sm px-3 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                                <Wallet className="w-4 h-4 text-green-600" />
                                <span className="font-medium">Cash</span>
                            </div>
                            <span className="text-sm sm:text-base font-bold text-green-600">
                                ₹{groupCashBalance.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="rounded-xl bg-white border shadow-sm px-3 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                                <CreditCard className="w-4 h-4 text-blue-600" />
                                <span className="font-medium">Banks</span>
                            </div>
                            <span className="text-sm sm:text-base font-bold text-blue-600">
                                {groupBanks.length}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm w-full lg:w-auto shrink-0 shadow-sm"
                    >
                        <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                        Add Expense
                    </button>
                </div>
            </div>

            {/* Filters (Fully responsive) */}
            <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4 md:p-5 mb-4 sm:mb-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
                    <div className="relative lg:col-span-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                        <input
                            type="text"
                            placeholder="Search by purpose/type/entry..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:col-span-2">
                        <select
                            value={expenseTypeFilter}
                            onChange={(e) => setExpenseTypeFilter(e.target.value)}
                            className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                            <option value="all">All Expense Types</option>
                            {uniqueExpenseTypes.map((type) => (
                                <option key={type} value={type}>
                                    {type}
                                </option>
                            ))}
                        </select>

                        <select
                            value={entryTypeFilter}
                            onChange={(e) => setEntryTypeFilter(e.target.value)}
                            className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                            <option value="all">All Entry Types</option>
                            <option value="income">Income</option>
                            <option value="expense">Expense</option>
                            <option value="assets">Assets</option>
                            <option value="liability">Liability</option>
                        </select>
                    </div>
                </div>

                {/* Summary row responsive */}
                <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="text-xs sm:text-sm text-gray-600">
                        Showing <span className="font-semibold">{filteredExpenses.length}</span>{" "}
                        record{filteredExpenses.length !== 1 ? "s" : ""}
                    </div>
                    <div className="text-sm sm:text-base font-semibold text-gray-800">
                        Total: <span className="text-blue-700">{formatCurrency(totalAmount)}</span>
                    </div>
                </div>
            </div>

            {/* Expenses List */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                {expensesLoading ? (
                    <div className="p-6 sm:p-8 text-center text-gray-600 text-sm sm:text-base">
                        Loading expenses...
                    </div>
                ) : filteredExpenses.length === 0 ? (
                    <div className="p-6 sm:p-8 text-center text-gray-600 text-sm sm:text-base">
                        No expenses found
                    </div>
                ) : (
                    <>
                        {/* Mobile + Tablet: Cards */}
                        <div className="block lg:hidden divide-y divide-gray-200">
                            {filteredExpenses.map((expense, index) => (
                                <div
                                    key={getExpenseId(expense) || index}
                                    className="p-3 sm:p-4 hover:bg-gray-50"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-medium">
                                                    {expense.expenseType || "-"}
                                                </span>

                                                <span
                                                    className={`px-2 py-1 rounded-lg text-xs font-medium ${expense.entryType === "income"
                                                            ? "bg-green-100 text-green-800"
                                                            : expense.entryType === "expense"
                                                                ? "bg-red-100 text-red-800"
                                                                : expense.entryType === "assets"
                                                                    ? "bg-purple-100 text-purple-800"
                                                                    : expense.entryType === "liability"
                                                                        ? "bg-orange-100 text-orange-800"
                                                                        : "bg-gray-100 text-gray-800"
                                                        }`}
                                                >
                                                    {expense.entryType
                                                        ? expense.entryType.charAt(0).toUpperCase() +
                                                        expense.entryType.slice(1)
                                                        : "Expense"}
                                                </span>

                                                <span className="text-xs text-gray-500">
                                                    {expense.paymentMode || "-"}
                                                </span>
                                            </div>

                                            <p className="mt-2 text-xs sm:text-sm text-gray-600">
                                                {formatDate(expense.date)}
                                            </p>

                                            <p className="mt-1 text-xs sm:text-sm text-gray-800 break-words">
                                                {expense.purpose || "-"}
                                            </p>

                                            {expense.paymentMode === "Bank" && expense.bankId && (
                                                <p className="mt-1 text-xs text-gray-500 break-words">
                                                    {typeof expense.bankId === "object"
                                                        ? `${expense.bankId.bank_name || ""} - ${expense.bankId.account_no || ""
                                                        }`
                                                        : "-"}
                                                </p>
                                            )}
                                        </div>

                                        <div className="shrink-0 text-right">
                                            <div className="text-sm sm:text-base font-bold text-gray-900">
                                                {formatCurrency(expense.amount)}
                                            </div>

                                            {expense._fromLoanMaster ? (
                                                <div className="mt-2 text-xs text-gray-500 italic">
                                                    Managed via Loan
                                                </div>
                                            ) : (
                                                <div className="mt-2 flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => handleOpenModal(expense)}
                                                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
                                                        title="Edit"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(getExpenseId(expense))}
                                                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop: Table (lg+) */}
                        <div className="hidden lg:block overflow-x-auto">
                            <table className="min-w-[1000px] w-full border-collapse">
                                <thead className="bg-blue-600 text-white">
                                    <tr>
                                        <th className="p-3 border text-left text-sm">Date</th>
                                        <th className="p-3 border text-left text-sm">Type</th>
                                        <th className="p-3 border text-left text-sm">Entry Type</th>
                                        <th className="p-3 border text-left text-sm">Purpose</th>
                                        <th className="p-3 border text-right text-sm">Amount</th>
                                        <th className="p-3 border text-left text-sm">Mode</th>
                                        <th className="p-3 border text-left text-sm">Bank</th>
                                        <th className="p-3 border text-center text-sm">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredExpenses.map((expense, index) => (
                                        <tr
                                            key={getExpenseId(expense) || index}
                                            className="odd:bg-gray-50 hover:bg-blue-50"
                                        >
                                            <td className="p-3 border text-sm">
                                                {formatDate(expense.date)}
                                            </td>

                                            <td className="p-3 border">
                                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-medium">
                                                    {expense.expenseType || "-"}
                                                </span>
                                            </td>

                                            <td className="p-3 border">
                                                <span
                                                    className={`px-2 py-1 rounded-lg text-xs font-medium ${expense.entryType === "income"
                                                            ? "bg-green-100 text-green-800"
                                                            : expense.entryType === "expense"
                                                                ? "bg-red-100 text-red-800"
                                                                : expense.entryType === "assets"
                                                                    ? "bg-purple-100 text-purple-800"
                                                                    : expense.entryType === "liability"
                                                                        ? "bg-orange-100 text-orange-800"
                                                                        : "bg-gray-100 text-gray-800"
                                                        }`}
                                                >
                                                    {expense.entryType
                                                        ? expense.entryType.charAt(0).toUpperCase() +
                                                        expense.entryType.slice(1)
                                                        : "Expense"}
                                                </span>
                                            </td>

                                            <td className="p-3 border text-sm">
                                                {expense.purpose || "-"}
                                            </td>

                                            <td className="p-3 border text-right font-semibold text-sm">
                                                {formatCurrency(expense.amount)}
                                            </td>

                                            <td className="p-3 border text-sm">
                                                {expense.paymentMode || "-"}
                                            </td>

                                            <td className="p-3 border text-sm">
                                                {expense.paymentMode === "Bank" && expense.bankId
                                                    ? typeof expense.bankId === "object"
                                                        ? `${expense.bankId.bank_name || ""} - ${expense.bankId.account_no || ""
                                                        }`
                                                        : "-"
                                                    : "-"}
                                            </td>

                                            <td className="p-3 border">
                                                <div className="flex items-center justify-center gap-1">
                                                    {expense._fromLoanMaster ? (
                                                        <span className="text-xs text-gray-500 italic">
                                                            Managed via Loan
                                                        </span>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => handleOpenModal(expense)}
                                                                className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
                                                                title="Edit"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(getExpenseId(expense))}
                                                                className="p-2 text-red-600 hover:bg-red-100 rounded-lg"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
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
                                        <td colSpan="4" className="p-3 border text-right text-sm">
                                            Total:
                                        </td>
                                        <td className="p-3 border text-right text-sm">
                                            {formatCurrency(totalAmount)}
                                        </td>
                                        <td colSpan="3" className="p-3 border" />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 p-3 sm:p-4">
                    {/* IMPORTANT: mobile bottom-sheet + desktop centered */}
                    <div className="min-h-full flex items-end sm:items-center justify-center">
                        <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border overflow-hidden max-h-[92vh] sm:max-h-[90vh]">
                            {/* Header */}
                            <div className="sticky top-0 bg-white border-b px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
                                <h3 className="text-base sm:text-lg font-bold text-gray-800 truncate">
                                    {editingExpense ? "Edit Expense" : "Add Expense"}
                                </h3>
                                <button
                                    onClick={handleCloseModal}
                                    className="text-gray-400 hover:text-gray-600 p-2 rounded-lg"
                                    aria-label="Close"
                                >
                                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                                </button>
                            </div>

                            <form
                                onSubmit={handleSubmit}
                                className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[calc(92vh-60px)] sm:max-h-[calc(90vh-60px)]"
                            >
                                {/* Balance cards */}
                                <div className="rounded-2xl border bg-gradient-to-r from-blue-50 to-indigo-50 p-3 sm:p-4">
                                    <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-700">
                                        <Wallet className="w-4 h-4 text-blue-600" />
                                        Available Balances
                                    </div>

                                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                        {/* Cash */}
                                        <div className="bg-white rounded-xl p-3 border">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <Wallet className="w-4 h-4 text-green-600" />
                                                    <span className="text-sm font-medium text-gray-700">
                                                        Cash Balance
                                                    </span>
                                                </div>
                                                <span className="text-base sm:text-lg font-bold text-green-600">
                                                    ₹{groupCashBalance.toLocaleString("en-IN", {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2,
                                                    })}
                                                </span>
                                            </div>

                                            {form.paymentMode === "Cash" && expenseAmount > 0 && (
                                                <p
                                                    className={`mt-1 text-xs ${cashSufficient ? "text-green-600" : "text-red-600"
                                                        }`}
                                                >
                                                    {cashSufficient
                                                        ? "✓ Sufficient balance"
                                                        : "✗ Insufficient balance"}
                                                </p>
                                            )}
                                        </div>

                                        {/* Bank */}
                                        <div className="bg-white rounded-xl p-3 border">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <CreditCard className="w-4 h-4 text-blue-600" />
                                                    <span className="text-sm font-medium text-gray-700">
                                                        Bank Accounts
                                                    </span>
                                                </div>
                                                <span className="text-xs text-gray-500">
                                                    {groupBanks.length} account
                                                    {groupBanks.length !== 1 ? "s" : ""}
                                                </span>
                                            </div>

                                            {form.paymentMode === "Bank" && selectedBank ? (
                                                <div className="mt-2 text-sm">
                                                    <div className="text-gray-600">
                                                        {selectedBank.bank_name || "Bank"}:
                                                    </div>
                                                    <div
                                                        className={`font-bold ${bankSufficient ? "text-blue-600" : "text-red-600"
                                                            }`}
                                                    >
                                                        ₹
                                                        {selectedBankBalance.toLocaleString("en-IN", {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2,
                                                        })}
                                                    </div>
                                                    {expenseAmount > 0 && (
                                                        <p
                                                            className={`mt-1 text-xs ${bankSufficient ? "text-green-600" : "text-red-600"
                                                                }`}
                                                        >
                                                            {bankSufficient
                                                                ? "✓ Sufficient balance"
                                                                : "✗ Insufficient balance"}
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="mt-2 text-xs text-gray-500">
                                                    Select a bank to see balance
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Form grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                    <div>
                                        <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                                            Expense Type *
                                        </label>
                                        <input
                                            type="text"
                                            value={form.expenseType}
                                            onChange={(e) =>
                                                setForm({ ...form, expenseType: e.target.value })
                                            }
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
                                            placeholder="e.g. Stationery, Travel"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                                            Amount *
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={form.amount}
                                            onChange={(e) =>
                                                setForm({ ...form, amount: e.target.value })
                                            }
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                    <div>
                                        <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                                            Date *
                                        </label>
                                        <input
                                            type="date"
                                            value={form.date}
                                            onChange={(e) => setForm({ ...form, date: e.target.value })}
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                                            Payment Mode *
                                        </label>
                                        <select
                                            value={form.paymentMode}
                                            onChange={(e) => {
                                                const nextMode = e.target.value;
                                                setForm((prev) => ({
                                                    ...prev,
                                                    paymentMode: nextMode,
                                                    bankId: nextMode === "Cash" ? "" : prev.bankId,
                                                }));
                                            }}
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
                                            required
                                        >
                                            <option value="Cash">Cash</option>
                                            <option value="Bank">Bank</option>
                                        </select>
                                    </div>
                                </div>

                                {form.paymentMode === "Bank" && (
                                    <div>
                                        <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                                            Bank *
                                        </label>
                                        <select
                                            value={form.bankId}
                                            onChange={(e) => setForm({ ...form, bankId: e.target.value })}
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
                                            required
                                        >
                                            <option value="">Select Bank</option>
                                            {groupBanks.map((bank) => {
                                                const id = bank._id || bank.id;
                                                const bal = getBankBalance(bank);
                                                const balanceFormatted = `₹${bal.toLocaleString("en-IN", {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })}`;
                                                return (
                                                    <option key={id} value={id}>
                                                        {bank.bank_name} - {bank.account_no} [Available:{" "}
                                                        {balanceFormatted}]
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                                        Entry Type *
                                    </label>
                                    <select
                                        value={form.entryType}
                                        onChange={(e) =>
                                            setForm({ ...form, entryType: e.target.value })
                                        }
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
                                        required
                                    >
                                        <option value="income">Income</option>
                                        <option value="expense">Expense</option>
                                        <option value="assets">Assets</option>
                                        <option value="liability">Liability</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                                        Purpose / Description
                                    </label>
                                    <textarea
                                        value={form.purpose}
                                        onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                                        rows={3}
                                        placeholder="Enter purpose or description"
                                    />
                                </div>

                                {/* Warning bar (responsive) */}
                                {(!cashSufficient || !bankSufficient) && expenseAmount > 0 && (
                                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 flex items-start gap-2">
                                        <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                                        <div className="text-sm text-red-700">
                                            Insufficient balance for the selected payment mode.
                                        </div>
                                    </div>
                                )}

                                {/* Buttons */}
                                <div className="sticky bottom-0 bg-white pt-2 pb-1">
                                    <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                                        <button
                                            type="button"
                                            onClick={handleCloseModal}
                                            className="w-full sm:flex-1 px-4 py-2.5 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300 text-sm"
                                        >
                                            Cancel
                                        </button>

                                        <button
                                            type="submit"
                                            disabled={!canSubmit}
                                            className={`w-full sm:flex-1 px-4 py-2.5 rounded-xl text-sm text-white ${canSubmit
                                                    ? "bg-blue-600 hover:bg-blue-700"
                                                    : "bg-blue-300 cursor-not-allowed"
                                                }`}
                                        >
                                            {editingExpense ? "Update Expense" : "Create Expense"}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
