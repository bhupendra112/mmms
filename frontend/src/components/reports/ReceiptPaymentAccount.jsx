import React from "react";

export default function ReceiptPaymentAccount({ data, fromDate, toDate, groupName }) {
    if (!data) {
        return <div className="text-center py-8 text-gray-600">No data available</div>;
    }

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
        }).format(amount || 0);
    };

    const formatDate = (date) => {
        if (!date) return "All Time";
        try {
            const d = new Date(date);
            return d.toLocaleDateString("en-GB");
        } catch {
            return "";
        }
    };

    const receipts = data.receipts || {};
    const payments = data.payments || {};
    const openingBalances = data.openingBalances || {};
    const closingBalances = data.closingBalances || {};

    const totalReceipts = data.totals?.receipts || 0;
    const totalPayments = data.totals?.payments || 0;

    const expenses = payments.expenses || {};

    // Prepare receipt items - show all items even if 0 for proper alignment
    const receiptItems = [
        { label: "Cash", amount: receipts.cash || 0 },
        { label: "Bank", amount: receipts.bank || 0 },
        { label: "Saving", amount: receipts.saving || 0 },
        { label: "FD", amount: receipts.fd || 0 },
        { label: "Member Fees", amount: receipts.memberFees || 0 },
    ];
    if (receipts.bankTransactions && receipts.bankTransactions > 0) {
        receiptItems.push({ label: "Bank Transactions", amount: receipts.bankTransactions, isSpecial: true });
    }

    // Prepare payment items - show all items even if 0 for proper alignment
    const paymentItems = [
        { label: "Stationery", amount: expenses.Stationery || 0 },
        { label: "Travel", amount: expenses.Travel || 0 },
        { label: "Other Expenses", amount: expenses.Other || 0 },
        { label: "Loan", amount: payments.loan || 0, isBold: true },
        { label: "Saving Withdrawal", amount: payments.saving || 0, isBold: true },
        { label: "FD Maturity", amount: payments.fd || 0, isBold: true },
    ];

    // Find max length to align rows
    const maxItems = Math.max(receiptItems.length, paymentItems.length);

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Receipt & Payment Account</h2>
                <p className="text-gray-600">
                    {fromDate && toDate ? (
                        <>Period: {formatDate(fromDate)} to {formatDate(toDate)}</>
                    ) : (
                        <>Period: All Time</>
                    )}
                </p>
                {groupName && <p className="text-gray-600">Group: {groupName}</p>}
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                            <th className="border border-gray-300 p-4 text-left font-bold">Receipt</th>
                            <th className="border border-gray-300 p-4 text-right font-bold">Amount</th>
                            <th className="border border-gray-300 p-4 text-left font-bold">Payment</th>
                            <th className="border border-gray-300 p-4 text-right font-bold">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Opening Balances */}
                        <tr className="bg-gray-50">
                            <td className="border border-gray-300 p-3 font-semibold text-gray-700">Opening Balance</td>
                            <td className="border border-gray-300 p-3"></td>
                            <td className="border border-gray-300 p-3"></td>
                            <td className="border border-gray-300 p-3"></td>
                        </tr>
                        <tr className="hover:bg-gray-50">
                            <td className="border border-gray-300 p-3 pl-8 text-gray-700">Cash</td>
                            <td className="border border-gray-300 p-3 text-right font-medium">{formatCurrency(openingBalances.cash || 0)}</td>
                            <td className="border border-gray-300 p-3"></td>
                            <td className="border border-gray-300 p-3"></td>
                        </tr>
                        <tr className="hover:bg-gray-50">
                            <td className="border border-gray-300 p-3 pl-8 text-gray-700">Bank</td>
                            <td className="border border-gray-300 p-3 text-right font-medium">{formatCurrency(openingBalances.bank || 0)}</td>
                            <td className="border border-gray-300 p-3"></td>
                            <td className="border border-gray-300 p-3"></td>
                        </tr>
                        <tr className="hover:bg-gray-50">
                            <td className="border border-gray-300 p-3 pl-8 text-gray-700">Saving</td>
                            <td className="border border-gray-300 p-3 text-right font-medium">{formatCurrency(openingBalances.saving || 0)}</td>
                            <td className="border border-gray-300 p-3"></td>
                            <td className="border border-gray-300 p-3"></td>
                        </tr>
                        <tr className="hover:bg-gray-50">
                            <td className="border border-gray-300 p-3 pl-8 text-gray-700">FD</td>
                            <td className="border border-gray-300 p-3 text-right font-medium">{formatCurrency(openingBalances.fd || 0)}</td>
                            <td className="border border-gray-300 p-3"></td>
                            <td className="border border-gray-300 p-3"></td>
                        </tr>

                        {/* Receipts and Payments Headers - Same Row */}
                        <tr className="bg-green-50">
                            <td className="border border-gray-300 p-3 font-semibold text-green-800">Receipts</td>
                            <td className="border border-gray-300 p-3"></td>
                            <td className="border border-gray-300 p-3 font-semibold text-red-800 bg-red-50">Payments</td>
                            <td className="border border-gray-300 p-3 bg-red-50"></td>
                        </tr>

                        {/* Receipts and Payments Items - Side by Side, aligned from same row */}
                        {Array.from({ length: maxItems }).map((_, index) => {
                            const receiptItem = receiptItems[index];
                            const paymentItem = paymentItems[index];
                            
                            // Determine row styling based on which side has content
                            let rowClass = "";
                            if (receiptItem && receiptItem.amount > 0) {
                                rowClass = "hover:bg-green-50";
                            } else if (paymentItem && paymentItem.amount > 0) {
                                rowClass = "hover:bg-red-50";
                            }

                            return (
                                <tr key={index} className={rowClass}>
                                    {/* Receipt side */}
                                    {receiptItem ? (
                                        <>
                                            <td className={`border border-gray-300 p-3 pl-8 text-gray-700 ${receiptItem.isSpecial ? "font-semibold" : ""}`}>
                                                {receiptItem.label}
                                            </td>
                                            <td className={`border border-gray-300 p-3 text-right font-medium ${
                                                receiptItem.amount > 0 
                                                    ? (receiptItem.isSpecial ? "text-blue-600 font-semibold" : "text-green-700")
                                                    : "text-gray-400"
                                            }`}>
                                                {receiptItem.amount > 0 ? formatCurrency(receiptItem.amount) : "-"}
                                            </td>
                                        </>
                                    ) : (
                                        <>
                            <td className="border border-gray-300 p-3"></td>
                            <td className="border border-gray-300 p-3"></td>
                                        </>
                                    )}
                                    
                                    {/* Payment side */}
                                    {paymentItem ? (
                                        <>
                                            <td className={`border border-gray-300 p-3 pl-8 ${
                                                paymentItem.amount > 0
                                                    ? (paymentItem.isBold ? "font-semibold text-gray-800" : "text-gray-700")
                                                    : "text-gray-400"
                                            }`}>
                                                {paymentItem.label}
                                            </td>
                                            <td className={`border border-gray-300 p-3 text-right font-medium ${
                                                paymentItem.amount > 0
                                                    ? (paymentItem.isBold ? "text-red-600 font-semibold" : "text-red-700")
                                                    : "text-gray-400"
                                            }`}>
                                                {paymentItem.amount > 0 ? formatCurrency(paymentItem.amount) : "-"}
                                            </td>
                                        </>
                                    ) : (
                                        <>
                            <td className="border border-gray-300 p-3"></td>
                            <td className="border border-gray-300 p-3"></td>
                                        </>
                                    )}
                        </tr>
                            );
                        })}

                        {/* Closing Balances */}
                        <tr className="bg-blue-50">
                            <td className="border border-gray-300 p-3"></td>
                            <td className="border border-gray-300 p-3"></td>
                            <td className="border border-gray-300 p-3 font-semibold text-blue-800">Closing Balance</td>
                            <td className="border border-gray-300 p-3"></td>
                        </tr>
                        <tr className="hover:bg-blue-50">
                            <td className="border border-gray-300 p-3"></td>
                            <td className="border border-gray-300 p-3"></td>
                            <td className="border border-gray-300 p-3 pl-8 text-gray-700">Cash</td>
                            <td className={`border border-gray-300 p-3 text-right font-medium ${
                                (closingBalances.cash || 0) >= 0 ? "text-blue-700" : "text-red-700"
                            }`}>
                                {formatCurrency(closingBalances.cash || 0)}
                            </td>
                        </tr>
                        <tr className="hover:bg-blue-50">
                            <td className="border border-gray-300 p-3"></td>
                            <td className="border border-gray-300 p-3"></td>
                            <td className="border border-gray-300 p-3 pl-8 text-gray-700">Bank</td>
                            <td className="border border-gray-300 p-3 text-right font-medium text-blue-700">{formatCurrency(closingBalances.bank || 0)}</td>
                        </tr>

                        {/* Totals */}
                        <tr className="bg-gradient-to-r from-gray-700 to-gray-800 text-white font-bold">
                            <td className="border border-gray-300 p-4 text-lg">Total</td>
                            <td className="border border-gray-300 p-4 text-right text-xl">
                                {formatCurrency(
                                    (openingBalances.cash || 0) + 
                                    (openingBalances.bank || 0) + 
                                    (openingBalances.saving || 0) + 
                                    (openingBalances.fd || 0) + 
                                    totalReceipts
                                )}
                            </td>
                            <td className="border border-gray-300 p-4 text-lg">Total</td>
                            <td className="border border-gray-300 p-4 text-right text-xl">
                                {formatCurrency(
                                    totalPayments + 
                                    (closingBalances.cash || 0) + 
                                    (closingBalances.bank || 0)
                                )}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
