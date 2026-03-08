import React from "react";
import { X, DollarSign, Calendar, User } from "lucide-react";

export default function ViewLoanModal({ show, loan, onClose }) {
    if (!show || !loan) return null;

    const dateLabel = loan.date
        ? new Date(loan.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
        : loan.createdAt
            ? new Date(loan.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
            : "—";

    const memberLabel = loan.isGroupLoan ? "Group loan" : `${loan.memberName || "—"} (${loan.memberCode || "—"})`;
    const tenureYears = loan.time_period != null ? (loan.time_period / 12).toFixed(1) : "—";

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between border-b border-gray-200 p-4">
                    <h2 className="text-lg font-semibold text-gray-800">Loan details</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-lg text-gray-500 hover:bg-gray-100"
                        aria-label="Close"
                    >
                        <X size={22} />
                    </button>
                </div>
                <div className="p-4 space-y-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                        <User size={20} className="text-gray-500 shrink-0" />
                        <div>
                            <p className="text-xs text-gray-500">Member</p>
                            <p className="font-medium text-gray-800">{memberLabel}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                        <DollarSign size={20} className="text-gray-500 shrink-0" />
                        <div>
                            <p className="text-xs text-gray-500">Amount</p>
                            <p className="font-semibold text-gray-800">₹{Number(loan.amount ?? 0).toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                            <p className="text-xs text-gray-500">Date</p>
                            <p className="text-sm font-medium text-gray-800 flex items-center gap-1 mt-0.5">
                                <Calendar size={14} /> {dateLabel}
                            </p>
                        </div>
                        <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                            <p className="text-xs text-gray-500">Tenure</p>
                            <p className="text-sm font-medium text-gray-800 mt-0.5">{tenureYears} years</p>
                        </div>
                        <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                            <p className="text-xs text-gray-500">Interest rate</p>
                            <p className="text-sm font-medium text-gray-800 mt-0.5">{loan.loan_rate_snapshot ?? "—"}%</p>
                        </div>
                        <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                            <p className="text-xs text-gray-500">Status</p>
                            <p className="text-sm font-medium text-gray-800 mt-0.5">
                                <span
                                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                        loan.status === "approved" ? "bg-green-100 text-green-800" : loan.status === "pending" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"
                                    }`}
                                >
                                    {loan.status || "—"}
                                </span>
                            </p>
                        </div>
                    </div>
                    <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                        <p className="text-xs text-gray-500">Purpose</p>
                        <p className="text-sm font-medium text-gray-800 mt-0.5">{loan.purpose || "—"}</p>
                    </div>
                    <div className="flex gap-2 text-sm text-gray-500">
                        <span>Type: {loan.transactionType || "—"}</span>
                        <span>•</span>
                        <span>Payment: {loan.paymentMode || "—"}</span>
                    </div>
                </div>
                <div className="border-t border-gray-200 p-4 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
