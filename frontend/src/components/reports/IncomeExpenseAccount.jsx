import React from "react";

export default function IncomeExpenseAccount({ data, fromDate, toDate, groupName }) {
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

    const expenses = data.expenses || {};
    const income = data.income || {};
    const surplus = data.surplus || 0;
    const totalExpenses = data.totals?.expenses || 0;
    const totalIncome = data.totals?.income || 0;

    // Prepare expense items - show all items even if 0 for proper alignment
    const expenseItems = [
        { label: "Stationery", amount: expenses.Stationery || 0 },
        { label: "Travel", amount: expenses.Travel || 0 },
        { label: "Other", amount: expenses.Other || 0 },
    ];

    // Prepare income items - show all items even if 0 for proper alignment
    const incomeItems = [
        { label: "Mem. Fees", amount: income.memberFees || 0 },
    ];

    // Find max length to align rows (+1 for Surplus in expenses)
    const maxItems = Math.max(expenseItems.length + 1, incomeItems.length);

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Income & Expense A/c</h2>
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
                            <th className="border border-gray-300 p-4 text-left font-bold">Expense</th>
                            <th className="border border-gray-300 p-4 text-right font-bold">Amount</th>
                            <th className="border border-gray-300 p-4 text-left font-bold">Income</th>
                            <th className="border border-gray-300 p-4 text-right font-bold">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Expenses and Income Headers - Same Row */}
                        <tr className="bg-red-50">
                            <td className="border border-gray-300 p-3 font-semibold text-red-800">Expenses</td>
                            <td className="border border-gray-300 p-3"></td>
                            <td className="border border-gray-300 p-3 font-semibold text-green-800 bg-green-50">Income</td>
                            <td className="border border-gray-300 p-3 bg-green-50"></td>
                        </tr>

                        {/* Expense and Income Items - Side by Side */}
                        {Array.from({ length: maxItems }).map((_, index) => {
                            // Handle Surplus (always show after expense items)
                            if (index === expenseItems.length) {
                                return (
                                    <tr key={`surplus-${index}`} className="hover:bg-gray-50">
                                        <td className="border border-gray-300 p-3 text-gray-700">Surplus</td>
                                        <td className={`border border-gray-300 p-3 text-right font-medium ${
                                            surplus >= 0 ? "text-gray-700" : "text-red-700"
                                        }`}>
                                            {formatCurrency(surplus)}
                                        </td>
                                        {incomeItems[index] ? (
                                            <>
                                                <td className={`border border-gray-300 p-3 ${
                                                    incomeItems[index].amount > 0 ? "text-gray-700" : "text-gray-400"
                                                }`}>
                                                    {incomeItems[index].label}
                                                </td>
                                                <td className={`border border-gray-300 p-3 text-right font-medium ${
                                                    incomeItems[index].amount > 0 ? "text-green-700" : "text-gray-400"
                                                }`}>
                                                    {incomeItems[index].amount > 0 ? formatCurrency(incomeItems[index].amount) : "-"}
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
                            }

                            const expenseItem = expenseItems[index];
                            const incomeItem = incomeItems[index];
                            
                            // Determine row styling
                            let rowClass = "";
                            if (expenseItem && expenseItem.amount > 0) {
                                rowClass = "hover:bg-red-50";
                            } else if (incomeItem && incomeItem.amount > 0) {
                                rowClass = "hover:bg-green-50";
                            }

                            return (
                                <tr key={index} className={rowClass}>
                                    {/* Expense side */}
                                    {expenseItem ? (
                                        <>
                                            <td className={`border border-gray-300 p-3 ${
                                                expenseItem.amount > 0 ? "text-gray-700" : "text-gray-400"
                                            }`}>
                                                {expenseItem.label}
                                            </td>
                                            <td className={`border border-gray-300 p-3 text-right font-medium ${
                                                expenseItem.amount > 0 ? "text-red-700" : "text-gray-400"
                                            }`}>
                                                {expenseItem.amount > 0 ? formatCurrency(expenseItem.amount) : "-"}
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="border border-gray-300 p-3"></td>
                                            <td className="border border-gray-300 p-3"></td>
                                        </>
                                    )}
                                    
                                    {/* Income side */}
                                    {incomeItem ? (
                                        <>
                                            <td className={`border border-gray-300 p-3 ${
                                                incomeItem.amount > 0 ? "text-gray-700" : "text-gray-400"
                                            }`}>
                                                {incomeItem.label}
                                            </td>
                                            <td className={`border border-gray-300 p-3 text-right font-medium ${
                                                incomeItem.amount > 0 ? "text-green-700" : "text-gray-400"
                                            }`}>
                                                {incomeItem.amount > 0 ? formatCurrency(incomeItem.amount) : "-"}
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

                        {/* Totals */}
                        <tr className="bg-gradient-to-r from-gray-700 to-gray-800 text-white font-bold">
                            <td className="border border-gray-300 p-4 text-lg">Total</td>
                            <td className="border border-gray-300 p-4 text-right text-xl">{formatCurrency(totalExpenses + surplus)}</td>
                            <td className="border border-gray-300 p-4 text-lg">Total</td>
                            <td className="border border-gray-300 p-4 text-right text-xl">{formatCurrency(totalIncome)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
