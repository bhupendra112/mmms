import React, { useEffect, useMemo, useState } from "react";
import {
    Receipt,
    Plus,
    Search,
    Building2,
    Edit,
    Trash2,
    X,
    Wallet,
    CreditCard,
    LayoutGrid,
    AlertTriangle,
} from "lucide-react";
import { getGroups, getGroupBanks } from "../../services/groupService";
import {
    getExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
} from "../../services/expenseService";
import { getCashAmount } from "../../services/cashAmount";

export default function ExpenseManagement() {
    const [groups, setGroups] = useState([]);
    const [groupsLoading, setGroupsLoading] = useState(false);

    const [selectedCluster, setSelectedCluster] = useState(null);
    const [selectedGroup, setSelectedGroup] = useState(null);

    const [expenses, setExpenses] = useState([]);
    const [expensesLoading, setExpensesLoading] = useState(false);

    const [searchTerm, setSearchTerm] = useState("");
    const [expenseTypeFilter, setExpenseTypeFilter] = useState("all");
    const [entryTypeFilter, setEntryTypeFilter] = useState("all"); // NEW responsive filter

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
        entryType: "expense",
    });

    // ---------- helpers ----------
    const safeToNumber = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    };

    const getId = (obj) => obj?._id || obj?.id;

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
        }).format(safeToNumber(amount));
    };

    const formatDate = (date) => {
        if (!date) return "-";
        try {
            return new Date(date).toLocaleDateString("en-GB");
        } catch {
            return "-";
        }
    };

    const getBankBalance = (bank) => {
        if (!bank) return 0;
        if (bank.available_balance !== undefined) return safeToNumber(bank.available_balance);
        if (bank.current_balance !== undefined) return safeToNumber(bank.current_balance);
        return safeToNumber(bank.opening_balance);
    };

    // ---------- load groups ----------
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
                        cluster_name: g.cluster_name,
                        cluster_code: g.cluster_code,
                    }))
                );
            })
            .catch((e) => {
                console.error("Failed to load groups:", e);
                setGroups([]);
            })
            .finally(() => setGroupsLoading(false));
    }, []);

    // ---------- load group related ----------
    useEffect(() => {
        if (selectedGroup?.id) {
            loadExpenses(selectedGroup.id);
            loadGroupBanks(selectedGroup.id);
            loadCashBalance(selectedGroup.id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedGroup?.id]);

    const loadCashBalance = async (groupId) => {
        try {
            const res = await getCashAmount(groupId);
            const balance = res?.data?.groupCashBalance ?? res?.data?.cashAmount ?? 0;
            setGroupCashBalance(safeToNumber(balance));
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

    // ---------- derived: clusters ----------
    const clusters = useMemo(() => {
        const map = new Map();
        for (const g of groups) {
            const key = `${g.cluster_name || ""}|${g.cluster_code || ""}`;
            if (!map.has(key)) map.set(key, { name: g.cluster_name || "", code: g.cluster_code || "" });
        }
        // show unassigned at end
        return Array.from(map.entries())
            .map(([key, v]) => ({ key, ...v }))
            .sort((a, b) => {
                const an = (a.name || a.code || "zzzz").toLowerCase();
                const bn = (b.name || b.code || "zzzz").toLowerCase();
                return an.localeCompare(bn);
            });
    }, [groups]);

    const groupsInSelectedCluster = useMemo(() => {
        if (!selectedCluster) return [];
        return groups.filter(
            (g) =>
                (g.cluster_name || "") === (selectedCluster.name || "") &&
                (g.cluster_code || "") === (selectedCluster.code || "")
        );
    }, [groups, selectedCluster]);

    // ---------- modal ----------
    const handleOpenModal = (expense = null) => {
        if (expense) {
            setEditingExpense(expense);

            const expenseGroupId = expense.groupId?._id || expense.groupId;
            const expenseGroup = groups.find((g) => g.id === expenseGroupId);

            const nextGroupId = expenseGroupId || selectedGroup?.id || "";
            setForm({
                groupId: nextGroupId,
                expenseType: expense.expenseType || "",
                amount: expense.amount ?? "",
                date: expense.date ? new Date(expense.date).toISOString().split("T")[0] : "",
                paymentMode: expense.paymentMode || "Cash",
                bankId: expense.bankId?._id || expense.bankId || "",
                purpose: expense.purpose || "",
                entryType: expense.entryType || "expense",
            });

            // Ensure cluster is selected (so group dropdown works)
            if (expenseGroup) {
                setSelectedCluster({ name: expenseGroup.cluster_name || "", code: expenseGroup.cluster_code || "" });
            }

            // Load balances for that expense's group (important if editing different group)
            if (expenseGroupId) {
                loadGroupBanks(expenseGroupId);
                loadCashBalance(expenseGroupId);
            }
        } else {
            setEditingExpense(null);
            const gid = selectedGroup?.id || "";
            setForm({
                groupId: gid,
                expenseType: "",
                amount: "",
                date: new Date().toISOString().split("T")[0],
                paymentMode: "Cash",
                bankId: "",
                purpose: "",
                entryType: "expense",
            });

            if (gid) {
                loadGroupBanks(gid);
                loadCashBalance(gid);
            }
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
            entryType: "expense",
        });
    };

    // ---------- validations ----------
    const expenseAmount = useMemo(() => safeToNumber(form.amount), [form.amount]);

    const selectedBank = useMemo(() => {
        if (!form.bankId) return null;
        return groupBanks.find((b) => (b._id || b.id) === form.bankId) || null;
    }, [form.bankId, groupBanks]);

    const selectedBankBalance = useMemo(() => getBankBalance(selectedBank), [selectedBank]);

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
        if (!form.groupId) return false;
        if (!form.expenseType?.trim()) return false;
        if (!form.amount) return false;
        if (expenseAmount < 0) return false;
        if (!form.date) return false;
        if (form.paymentMode === "Bank" && !form.bankId) return false;
        if (!cashSufficient) return false;
        if (!bankSufficient) return false;
        return true;
    }, [
        form.groupId,
        form.expenseType,
        form.amount,
        form.date,
        form.paymentMode,
        form.bankId,
        expenseAmount,
        cashSufficient,
        bankSufficient,
    ]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            if (!form.groupId) return alert("Please select a group");
            if (!form.expenseType) return alert("Please select expense type");
            if (!form.amount || parseFloat(form.amount) < 0) return alert("Please enter a valid amount");
            if (!form.date) return alert("Please select a date");
            if (form.paymentMode === "Bank" && !form.bankId) return alert("Please select a bank for bank payment");

            // Balance checks
            if (form.paymentMode === "Cash" && !cashSufficient) {
                return alert(
                    `Insufficient cash balance. Available: ₹${groupCashBalance.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    })}, Required: ₹${expenseAmount.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    })}`
                );
            }

            if (form.paymentMode === "Bank" && form.bankId && !bankSufficient) {
                return alert(
                    `Insufficient bank balance. Available: ₹${selectedBankBalance.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    })}, Required: ₹${expenseAmount.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    })}`
                );
            }

            const payload = { ...form, amount: expenseAmount };

            if (editingExpense) {
                await updateExpense(getId(editingExpense), payload);
                alert("Expense updated successfully!");
            } else {
                await createExpense(payload);
                alert("Expense created successfully!");
            }

            handleCloseModal();
            if (selectedGroup?.id) loadExpenses(selectedGroup.id);
            // refresh balances for selected group (or current form group)
            await Promise.all([loadCashBalance(form.groupId), loadGroupBanks(form.groupId)]);
        } catch (error) {
            alert(error?.message || "Failed to save expense");
        }
    };

    const handleDelete = async (expenseId) => {
        if (!window.confirm("Are you sure you want to delete this expense?")) return;
        try {
            await deleteExpense(expenseId);
            alert("Expense deleted successfully!");
            if (selectedGroup?.id) loadExpenses(selectedGroup.id);
        } catch (error) {
            alert(error?.message || "Failed to delete expense");
        }
    };

    // ---------- filters ----------
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
                return purpose.includes(q) || expenseType.includes(q) || entryType.includes(q);
            });
        }

        // UX: sort by date desc
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

    // ===============================
    // ✅ PAGE 1: Cluster / Group Selection (Fully Responsive)
    // ===============================
    if (!selectedGroup) {
        return (
            <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6">
                <div className="mb-4 sm:mb-6">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2 sm:gap-3">
                        <Receipt className="shrink-0 w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" />
                        <span className="truncate">Expense Management</span>
                    </h1>
                    <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">
                        Select a group to manage expenses
                    </p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border p-4 sm:p-5 md:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
                        <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 flex items-center gap-2">
                            <Building2 className="text-blue-600 shrink-0 w-5 h-5 sm:w-6 sm:h-6" />
                            {selectedCluster ? `Groups in ${selectedCluster.name || "Cluster"}` : "Select Cluster"}
                        </h2>

                        {selectedCluster && (
                            <button
                                onClick={() => setSelectedCluster(null)}
                                className="text-sm text-blue-600 hover:text-blue-800 font-medium w-full sm:w-auto"
                            >
                                ← Back to Clusters
                            </button>
                        )}
                    </div>

                    {/* Responsive grid cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                        {groupsLoading ? (
                            <div className="col-span-full text-center py-8 text-gray-500 text-sm sm:text-base">
                                Loading...
                            </div>
                        ) : (
                            <>
                                {/* CLUSTERS */}
                                {!selectedCluster &&
                                    (clusters.length ? (
                                        clusters.map((c) => {
                                            const clusterGroups = groups.filter(
                                                (g) =>
                                                    (g.cluster_name || "") === (c.name || "") &&
                                                    (g.cluster_code || "") === (c.code || "")
                                            );

                                            const displayName = (c.name || c.code) ? (c.name || "No Name") : "Unassigned";
                                            const displayCode = c.code || (c.name ? "" : "No Code");

                                            return (
                                                <button
                                                    key={c.key}
                                                    onClick={() => setSelectedCluster({ name: c.name, code: c.code })}
                                                    className="text-left p-4 sm:p-5 md:p-6 border-2 border-gray-200 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-colors"
                                                >
                                                    <div className="flex items-start gap-3 mb-2">
                                                        <div className="p-2 rounded-xl bg-blue-50 border border-blue-100">
                                                            <LayoutGrid className="text-blue-600 w-6 h-6" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-semibold text-gray-800 text-base sm:text-lg truncate">
                                                                {displayName}
                                                            </p>
                                                            <p className="text-xs sm:text-sm text-gray-600">
                                                                Code: {displayCode}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs sm:text-sm text-gray-600">
                                                        Groups: <span className="font-semibold">{clusterGroups.length}</span>
                                                    </p>
                                                </button>
                                            );
                                        })
                                    ) : (
                                        <div className="col-span-full text-center py-8 text-gray-500 text-sm sm:text-base">
                                            No clusters found.
                                        </div>
                                    ))}

                                {/* GROUPS */}
                                {selectedCluster &&
                                    (groupsInSelectedCluster.length ? (
                                        groupsInSelectedCluster.map((g) => (
                                            <button
                                                key={g.id}
                                                onClick={() => setSelectedGroup(g)}
                                                className="text-left p-4 sm:p-5 md:p-6 border-2 border-gray-200 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-colors"
                                            >
                                                <div className="flex items-start gap-3 mb-2">
                                                    <div className="p-2 rounded-xl bg-blue-50 border border-blue-100">
                                                        <Building2 className="text-blue-600 w-6 h-6" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-gray-800 text-base sm:text-lg truncate">
                                                            {g.name}
                                                        </p>
                                                        <p className="text-xs sm:text-sm text-gray-600">
                                                            Code: {g.code}
                                                        </p>
                                                    </div>
                                                </div>
                                                <p className="text-xs sm:text-sm text-gray-600">
                                                    Village: {g.village || "-"}
                                                </p>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="col-span-full text-center py-8 text-gray-500 text-sm sm:text-base">
                                            No groups found in this cluster.
                                        </div>
                                    ))}
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ===============================
    // ✅ PAGE 2: Expense List (Fully Responsive)
    // ===============================
    return (
        <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6">
            <div className="mb-4 sm:mb-6 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                <div className="min-w-0">
                    <button
                        onClick={() => setSelectedGroup(null)}
                        className="text-blue-600 hover:text-blue-800 mb-1 sm:mb-2 flex items-center gap-2 text-sm"
                    >
                        ← Back to Groups
                    </button>

                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2 sm:gap-3">
                        <Receipt className="shrink-0 w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" />
                        <span className="truncate">Expense Management - {selectedGroup.name}</span>
                    </h1>
                    <p className="text-gray-600 mt-1 text-sm sm:text-base">
                        {selectedGroup.code} • {selectedGroup.village || "-"}
                    </p>
                </div>

                <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-2 sm:gap-3 lg:items-center">
                    {/* quick balances - responsive */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full lg:w-auto">
                        <div className="rounded-2xl bg-white border shadow-sm px-3 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                                <Wallet className="w-4 h-4 text-green-600" />
                                <span className="font-medium">Cash</span>
                            </div>
                            <span className="text-sm sm:text-base font-bold text-green-600">
                                ₹{groupCashBalance.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="rounded-2xl bg-white border shadow-sm px-3 py-2 flex items-center justify-between">
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
                        className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 text-sm w-full lg:w-auto shrink-0 shadow-sm"
                    >
                        <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                        Add Expense
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl shadow-sm border p-3 sm:p-4 md:p-5 mb-4 sm:mb-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                        <input
                            type="text"
                            placeholder="Search by purpose/type/entry..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2.5 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:col-span-2">
                        <select
                            value={expenseTypeFilter}
                            onChange={(e) => setExpenseTypeFilter(e.target.value)}
                            className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 text-sm"
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
                            className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                            <option value="all">All Entry Types</option>
                            <option value="income">Income</option>
                            <option value="expense">Expense</option>
                            <option value="assets">Assets</option>
                            <option value="liability">Liability</option>
                        </select>
                    </div>
                </div>

                <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="text-xs sm:text-sm text-gray-600">
                        Showing <span className="font-semibold">{filteredExpenses.length}</span>{" "}
                        record{filteredExpenses.length !== 1 ? "s" : ""}
                    </div>
                    <div className="text-sm sm:text-base font-semibold text-gray-800">
                        Total: <span className="text-blue-700">{formatCurrency(totalAmount)}</span>
                    </div>
                </div>

                <p className="text-xs text-gray-500 mt-2 hidden sm:block">
                    Note: "Other" expenses created via Loan Management may be locked.
                </p>
            </div>

            {/* Expenses Table / Cards */}
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                {expensesLoading ? (
                    <div className="p-8 text-center text-gray-600 text-sm sm:text-base">
                        Loading expenses...
                    </div>
                ) : filteredExpenses.length === 0 ? (
                    <div className="p-8 text-center text-gray-600 text-sm sm:text-base">
                        No expenses found
                    </div>
                ) : (
                    <>
                        {/* Mobile/Tablet Cards */}
                        <div className="block lg:hidden divide-y divide-gray-200">
                            {filteredExpenses.map((expense, index) => (
                                <div key={getId(expense) || index} className="p-3 sm:p-4 hover:bg-gray-50">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-xl text-xs font-medium">
                                                    {expense.expenseType || "-"}
                                                </span>

                                                <span
                                                    className={`px-2 py-1 rounded-xl text-xs font-medium ${expense.entryType === "income"
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
                                                        ? expense.entryType.charAt(0).toUpperCase() + expense.entryType.slice(1)
                                                        : "Expense"}
                                                </span>

                                                <span className="text-xs text-gray-500">{expense.paymentMode || "-"}</span>
                                            </div>

                                            <p className="mt-2 text-xs sm:text-sm text-gray-600">{formatDate(expense.date)}</p>
                                            <p className="mt-1 text-xs sm:text-sm text-gray-800 break-words">
                                                {expense.purpose || "-"}
                                            </p>

                                            {expense.paymentMode === "Bank" && expense.bankId && (
                                                <p className="mt-1 text-xs text-gray-500 break-words">
                                                    {typeof expense.bankId === "object"
                                                        ? `${expense.bankId.bank_name || ""} - ${expense.bankId.account_no || ""}`
                                                        : "-"}
                                                </p>
                                            )}
                                        </div>

                                        <div className="shrink-0 text-right">
                                            <div className="text-sm sm:text-base font-bold text-gray-900">
                                                {formatCurrency(expense.amount)}
                                            </div>

                                            {expense._fromLoanMaster ? (
                                                <div className="mt-2 text-xs text-gray-500 italic">Managed via Loan</div>
                                            ) : (
                                                <div className="mt-2 flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => handleOpenModal(expense)}
                                                        className="min-w-[44px] min-h-[44px] p-2 flex items-center justify-center text-blue-600 hover:bg-blue-100 rounded-xl touch-manipulation"
                                                        title="Edit"
                                                    >
                                                        <Edit className="w-4 h-4 sm:w-5 sm:h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(getId(expense))}
                                                        className="min-w-[44px] min-h-[44px] p-2 flex items-center justify-center text-red-600 hover:bg-red-100 rounded-xl touch-manipulation"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <div className="p-3 sm:p-4 bg-gray-100 font-semibold text-sm sm:text-base flex justify-between items-center">
                                <span>Total:</span>
                                <span>{formatCurrency(totalAmount)}</span>
                            </div>
                        </div>

                        {/* Desktop Table */}
                        <div className="hidden lg:block overflow-x-auto">
                            <table className="min-w-[900px] xl:min-w-[1000px] w-full border-collapse text-xs xl:text-sm">
                                <thead className="bg-blue-600 text-white">
                                    <tr>
                                        <th className="p-2 xl:p-3 border text-left">Date</th>
                                        <th className="p-2 xl:p-3 border text-left">Type</th>
                                        <th className="p-2 xl:p-3 border text-left">Entry Type</th>
                                        <th className="p-2 xl:p-3 border text-left">Purpose</th>
                                        <th className="p-2 xl:p-3 border text-right">Amount</th>
                                        <th className="p-2 xl:p-3 border text-left">Payment Mode</th>
                                        <th className="p-2 xl:p-3 border text-left">Bank</th>
                                        <th className="p-2 xl:p-3 border text-center">Actions</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {filteredExpenses.map((expense, index) => (
                                        <tr key={getId(expense) || index} className="odd:bg-gray-50 hover:bg-blue-50">
                                            <td className="p-2 xl:p-3 border">{formatDate(expense.date)}</td>
                                            <td className="p-2 xl:p-3 border">
                                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-xl text-xs font-medium">
                                                    {expense.expenseType || "-"}
                                                </span>
                                            </td>
                                            <td className="p-2 xl:p-3 border">
                                                <span
                                                    className={`px-2 py-1 rounded-xl text-xs font-medium ${expense.entryType === "income"
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
                                                        ? expense.entryType.charAt(0).toUpperCase() + expense.entryType.slice(1)
                                                        : "Expense"}
                                                </span>
                                            </td>
                                            <td className="p-2 xl:p-3 border max-w-[180px] xl:max-w-[220px] truncate" title={expense.purpose || ""}>{expense.purpose || "-"}</td>
                                            <td className="p-2 xl:p-3 border text-right font-semibold">{formatCurrency(expense.amount)}</td>
                                            <td className="p-2 xl:p-3 border">{expense.paymentMode || "-"}</td>
                                            <td className="p-2 xl:p-3 border max-w-[100px] xl:max-w-[140px] truncate" title={expense.paymentMode === "Bank" && expense.bankId && typeof expense.bankId === "object" ? `${expense.bankId.bank_name || ""} - ${expense.bankId.account_no || ""}` : ""}>
                                                {expense.paymentMode === "Bank" && expense.bankId
                                                    ? typeof expense.bankId === "object"
                                                        ? `${expense.bankId.bank_name || ""} - ${expense.bankId.account_no || ""}`
                                                        : "-"
                                                    : "-"}
                                            </td>
                                            <td className="p-2 xl:p-3 border">
                                                <div className="flex items-center justify-center gap-1">
                                                    {expense._fromLoanMaster ? (
                                                        <span className="text-xs text-gray-500 italic">Managed via Loan</span>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => handleOpenModal(expense)}
                                                                className="p-2 text-blue-600 hover:bg-blue-100 rounded-xl"
                                                                title="Edit"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(getId(expense))}
                                                                className="p-2 text-red-600 hover:bg-red-100 rounded-xl"
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
                                        <td colSpan="4" className="p-2 xl:p-3 border text-right">
                                            Total:
                                        </td>
                                        <td className="p-2 xl:p-3 border text-right">{formatCurrency(totalAmount)}</td>
                                        <td colSpan="3" className="p-2 xl:p-3 border" />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {/* Modal - responsive: bottom sheet on mobile, centered on desktop */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 px-2 pt-2 sm:p-4 overflow-y-auto">
                    <div className="min-h-full flex items-end sm:items-center justify-center pb-0 pt-0 sm:py-4">
                        <div className="bg-white w-full max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-xl border overflow-hidden max-h-[92dvh] sm:max-h-[90vh]">
                            <div className="sticky top-0 bg-white border-b px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
                                <h3 className="text-base sm:text-lg font-bold text-gray-800 truncate">
                                    {editingExpense ? "Edit Expense" : "Add Expense"}
                                </h3>
                                <button
                                    onClick={handleCloseModal}
                                    className="text-gray-400 hover:text-gray-600 p-2 rounded-xl"
                                    aria-label="Close"
                                >
                                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                                </button>
                            </div>

                            <form
                                onSubmit={handleSubmit}
                                className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[calc(92dvh-60px)] sm:max-h-[calc(90vh-60px)]"
                            >
                                {/* balances */}
                                {form.groupId && (
                                    <div className="rounded-2xl border bg-gradient-to-r from-blue-50 to-indigo-50 p-3 sm:p-4">
                                        <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-700">
                                            <Wallet className="w-4 h-4 text-blue-600" />
                                            Available Balances
                                        </div>

                                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                            <div className="bg-white rounded-2xl p-3 border">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <Wallet className="w-4 h-4 text-green-600" />
                                                        <span className="text-sm font-medium text-gray-700">Cash Balance</span>
                                                    </div>
                                                    <span className="text-base sm:text-lg font-bold text-green-600">
                                                        ₹{groupCashBalance.toLocaleString("en-IN", {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2,
                                                        })}
                                                    </span>
                                                </div>

                                                {form.paymentMode === "Cash" && expenseAmount > 0 && (
                                                    <p className={`mt-1 text-xs ${cashSufficient ? "text-green-600" : "text-red-600"}`}>
                                                        {cashSufficient ? "✓ Sufficient balance" : "✗ Insufficient balance"}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="bg-white rounded-2xl p-3 border">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <CreditCard className="w-4 h-4 text-blue-600" />
                                                        <span className="text-sm font-medium text-gray-700">Bank Accounts</span>
                                                    </div>
                                                    <span className="text-xs text-gray-500">
                                                        {groupBanks.length} account{groupBanks.length !== 1 ? "s" : ""}
                                                    </span>
                                                </div>

                                                {form.paymentMode === "Bank" && selectedBank ? (
                                                    <div className="mt-2 text-sm">
                                                        <div className="text-gray-600">{selectedBank.bank_name || "Bank"}:</div>
                                                        <div className={`font-bold ${bankSufficient ? "text-blue-600" : "text-red-600"}`}>
                                                            ₹{selectedBankBalance.toLocaleString("en-IN", {
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 2,
                                                            })}
                                                        </div>

                                                        {expenseAmount > 0 && (
                                                            <p className={`mt-1 text-xs ${bankSufficient ? "text-green-600" : "text-red-600"}`}>
                                                                {bankSufficient ? "✓ Sufficient balance" : "✗ Insufficient balance"}
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="mt-2 text-xs text-gray-500">Select a bank to see balance</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* group */}
                                <div>
                                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">Group *</label>
                                    <select
                                        value={form.groupId}
                                        onChange={(e) => {
                                            const gid = e.target.value;
                                            setForm((prev) => ({ ...prev, groupId: gid, bankId: "" }));
                                            if (gid) {
                                                loadGroupBanks(gid);
                                                loadCashBalance(gid);
                                            }
                                        }}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 text-sm"
                                        required
                                        disabled={!selectedCluster}
                                    >
                                        <option value="">
                                            {selectedCluster ? "Select Group" : "Select a cluster first"}
                                        </option>
                                        {selectedCluster &&
                                            groupsInSelectedCluster.map((g) => (
                                                <option key={g.id} value={g.id}>
                                                    {g.name} ({g.code})
                                                </option>
                                            ))}
                                    </select>
                                </div>

                                {/* expense type + amount */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                    <div>
                                        <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                                            Expense Type *
                                        </label>
                                        <input
                                            type="text"
                                            value={form.expenseType}
                                            onChange={(e) => setForm({ ...form, expenseType: e.target.value })}
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 text-sm"
                                            placeholder="e.g. Stationery, Travel"
                                            required
                                        />
                                        <p className="text-xs text-gray-500 mt-1 hidden sm:block">
                                            Enter any expense type name manually
                                        </p>
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
                                            onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 text-sm"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* date + mode */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                    <div>
                                        <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">Date *</label>
                                        <input
                                            type="date"
                                            value={form.date}
                                            onChange={(e) => setForm({ ...form, date: e.target.value })}
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 text-sm"
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
                                                const mode = e.target.value;
                                                setForm((prev) => ({
                                                    ...prev,
                                                    paymentMode: mode,
                                                    bankId: mode === "Cash" ? "" : prev.bankId,
                                                }));
                                            }}
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 text-sm"
                                            required
                                        >
                                            <option value="Cash">Cash</option>
                                            <option value="Bank">Bank</option>
                                        </select>
                                    </div>
                                </div>

                                {/* bank */}
                                {form.paymentMode === "Bank" && (
                                    <div>
                                        <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">Bank *</label>
                                        <select
                                            value={form.bankId}
                                            onChange={(e) => setForm({ ...form, bankId: e.target.value })}
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 text-sm"
                                            required
                                        >
                                            <option value="">Select Bank</option>
                                            {groupBanks.map((bank) => {
                                                const bal = getBankBalance(bank);
                                                return (
                                                    <option key={getId(bank)} value={getId(bank)}>
                                                        {bank.bank_name} - {bank.account_no} [Available: ₹
                                                        {bal.toLocaleString("en-IN", {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2,
                                                        })}
                                                        ]
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                )}

                                {/* entry type */}
                                <div>
                                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">Entry Type *</label>
                                    <select
                                        value={form.entryType}
                                        onChange={(e) => setForm({ ...form, entryType: e.target.value })}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 text-sm"
                                        required
                                    >
                                        <option value="income">Income</option>
                                        <option value="expense">Expense</option>
                                        <option value="assets">Assets</option>
                                        <option value="liability">Liability</option>
                                    </select>
                                </div>

                                {/* purpose */}
                                <div>
                                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">Purpose / Description</label>
                                    <textarea
                                        value={form.purpose}
                                        onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                                        rows={3}
                                        placeholder="Enter purpose or description"
                                    />
                                </div>

                                {/* warning */}
                                {((form.paymentMode === "Cash" && !cashSufficient) || (form.paymentMode === "Bank" && !bankSufficient)) &&
                                    expenseAmount > 0 && (
                                        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 flex items-start gap-2">
                                            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                                            <div className="text-sm text-red-700">
                                                Insufficient balance for the selected payment mode.
                                            </div>
                                        </div>
                                    )}

                                {/* buttons sticky */}
                                <div className="sticky bottom-0 bg-white pt-2 pb-1">
                                    <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                                        <button
                                            type="button"
                                            onClick={handleCloseModal}
                                            className="w-full sm:flex-1 px-4 py-2.5 bg-gray-200 text-gray-800 rounded-2xl hover:bg-gray-300 text-sm"
                                        >
                                            Cancel
                                        </button>

                                        <button
                                            type="submit"
                                            disabled={!canSubmit}
                                            className={`w-full sm:flex-1 px-4 py-2.5 rounded-2xl text-sm text-white ${canSubmit ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-300 cursor-not-allowed"
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
