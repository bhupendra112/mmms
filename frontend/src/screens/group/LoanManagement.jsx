import React, { useState, useEffect } from "react";
import { DollarSign, Download, FileText, Search, Plus, Eye, Wifi, WifiOff } from "lucide-react";
import { Link } from "react-router-dom";
import { exportLoanToExcel, exportLoanToPDF } from "../../utils/exportUtils";
import { useGroup } from "../../contexts/GroupContext";
import { getAllApprovals, getUnsyncedApprovals } from "../../services/approvalDB";

export default function LoanManagement() {
    const { currentGroup, isOnline } = useGroup();
    const [loans, setLoans] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState("all");
    const [pendingCount, setPendingCount] = useState(0);

    // Mock data - replace with actual API call
    const mockLoans = [
        {
            id: 1,
            memberCode: "M001",
            memberName: "Rahul Patel",
            hasAssets: true,
            transactionType: "Loan",
            paymentMode: "Cash",
            purpose: "Business expansion",
            amount: 50000,
            date: "2025-01-15",
        },
        {
            id: 2,
            memberCode: "M002",
            memberName: "Sita Devi",
            hasAssets: false,
            transactionType: "Deposit",
            paymentMode: "Bank",
            purpose: "Monthly deposit",
            amount: 5000,
            date: "2025-01-16",
        },
        {
            id: 3,
            memberCode: "M003",
            memberName: "Amit Yadav",
            hasAssets: true,
            transactionType: "FD",
            paymentMode: "Bank",
            purpose: "Fixed deposit",
            amount: 100000,
            date: "2025-01-17",
        },
    ];

    useEffect(() => {
        // Load loans from database/API - always load loans
        loadLoans();
        if (currentGroup) {
            loadPendingCount();
        }
    }, [currentGroup]);

    // Auto-sync when online
    useEffect(() => {
        if (isOnline) {
            syncPendingApprovals();
        }
    }, [isOnline]);

    const loadLoans = async () => {
        try {
            // Load from local DB first, then sync with server if online
            // In real app, load from RxDB or API based on currentGroup
            // For now, use mock data
            setLoans(mockLoans);
        } catch (error) {
            console.error("Error loading loans:", error);
            setLoans([]);
        }
    };

    const loadPendingCount = async () => {
        if (!currentGroup) return;
        try {
            const approvals = await getAllApprovals(currentGroup.id);
            const pending = approvals.filter((a) => a.status === "pending" && a.type === "loan");
            setPendingCount(pending.length);
        } catch (error) {
            console.error("Error loading pending count:", error);
        }
    };

    const syncPendingApprovals = async () => {
        try {
            const unsynced = await getUnsyncedApprovals();
            // In real app, send to server API
            console.log("Syncing pending approvals:", unsynced);
            // After successful sync, mark as synced
        } catch (error) {
            console.error("Error syncing approvals:", error);
        }
    };

    const filteredLoans = loans.filter((loan) => {
        const matchSearch =
            loan.memberName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            loan.memberCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
            loan.purpose.toLowerCase().includes(searchTerm.toLowerCase());

        const matchFilter =
            filterType === "all" ||
            (filterType === "withAssets" && loan.hasAssets) ||
            (filterType === "withoutAssets" && !loan.hasAssets) ||
            loan.transactionType.toLowerCase() === filterType.toLowerCase();

        return matchSearch && matchFilter;
    });

    const handleExportExcel = () => {
        exportLoanToExcel(filteredLoans, currentGroup?.name || "Group_Loans");
    };

    const handleExportPDF = () => {
        exportLoanToPDF(filteredLoans, currentGroup?.name || "Group_Loans");
    };

    const totalAmount = filteredLoans.reduce((sum, loan) => sum + parseFloat(loan.amount || 0), 0);

    return (
        <div className="max-w-7xl mx-auto">
            <div className="mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                                <DollarSign size={32} />
                                Loan Management
                            </h1>
                            {isOnline ? (
                                <Wifi className="text-green-600" size={20} title="Online" />
                            ) : (
                                <WifiOff className="text-red-600" size={20} title="Offline" />
                            )}
                        </div>
                        <p className="text-gray-600 mt-2">
                            Manage loan transactions for {currentGroup?.name || "Group"}
                        </p>
                        {pendingCount > 0 && (
                            <p className="text-orange-600 text-sm mt-1">
                                {pendingCount} loan transaction(s) pending approval
                            </p>
                        )}
                    </div>
                    <Link
                        to="/group/loan-taking"
                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                    >
                        <Plus size={20} />
                        Add Loan Transaction
                    </Link>
                </div>
            </div>

            {/* Filters and Export */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search by member, code, or purpose..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                    </div>
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                        <option value="all">All Transactions</option>
                        <option value="withAssets">With Assets</option>
                        <option value="withoutAssets">Without Assets</option>
                        <option value="loan">Loan</option>
                        <option value="saving">Saving</option>
                        <option value="fd">FD</option>
                        <option value="deposit">Deposit</option>
                        <option value="expense">Expense</option>
                    </select>
                    <div className="flex gap-2">
                        <button
                            onClick={handleExportExcel}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
                        >
                            <Download size={18} />
                            Export Excel
                        </button>
                        <button
                            onClick={handleExportPDF}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm"
                        >
                            <FileText size={18} />
                            Export PDF
                        </button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                        <p className="text-sm text-gray-600">Total Transactions</p>
                        <p className="text-2xl font-bold text-gray-800">{filteredLoans.length}</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
                        <p className="text-sm text-gray-600">Total Amount</p>
                        <p className="text-2xl font-bold text-gray-800">₹{totalAmount.toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                        <p className="text-sm text-gray-600">With Assets</p>
                        <p className="text-2xl font-bold text-gray-800">
                            {filteredLoans.filter((l) => l.hasAssets).length}
                        </p>
                    </div>
                </div>
            </div>

            {/* Loans Table */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border p-3 text-left font-semibold text-gray-700">Date</th>
                                <th className="border p-3 text-left font-semibold text-gray-700">Member Code</th>
                                <th className="border p-3 text-left font-semibold text-gray-700">Member Name</th>
                                <th className="border p-3 text-center font-semibold text-gray-700">Has Assets</th>
                                <th className="border p-3 text-left font-semibold text-gray-700">Transaction Type</th>
                                <th className="border p-3 text-left font-semibold text-gray-700">Payment Mode</th>
                                <th className="border p-3 text-left font-semibold text-gray-700">Purpose</th>
                                <th className="border p-3 text-right font-semibold text-gray-700">Amount</th>
                                <th className="border p-3 text-center font-semibold text-gray-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLoans.length > 0 ? (
                                filteredLoans.map((loan) => (
                                    <tr key={loan.id} className="hover:bg-gray-50">
                                        <td className="border p-3 text-gray-800">{loan.date}</td>
                                        <td className="border p-3 text-gray-800">{loan.memberCode}</td>
                                        <td className="border p-3 text-gray-800">{loan.memberName}</td>
                                        <td className="border p-3 text-center">
                                            <span
                                                className={`px-2 py-1 rounded-full text-xs font-medium ${loan.hasAssets
                                                    ? "bg-green-100 text-green-800"
                                                    : "bg-red-100 text-red-800"
                                                    }`}
                                            >
                                                {loan.hasAssets ? "Yes" : "No"}
                                            </span>
                                        </td>
                                        <td className="border p-3 text-gray-800">{loan.transactionType}</td>
                                        <td className="border p-3 text-gray-800">{loan.paymentMode}</td>
                                        <td className="border p-3 text-gray-800">{loan.purpose}</td>
                                        <td className="border p-3 text-right font-semibold text-gray-800">
                                            ₹{loan.amount.toLocaleString()}
                                        </td>
                                        <td className="border p-3 text-center">
                                            <button className="text-blue-600 hover:text-blue-800">
                                                <Eye size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={9} className="border p-8 text-center text-gray-500">
                                        No loans found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {filteredLoans.length > 0 && (
                            <tfoot>
                                <tr className="bg-gray-50 font-semibold">
                                    <td colSpan={7} className="border p-3 text-right text-gray-800">
                                        Total:
                                    </td>
                                    <td className="border p-3 text-right text-gray-800">
                                        ₹{totalAmount.toLocaleString()}
                                    </td>
                                    <td className="border p-3"></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
}

