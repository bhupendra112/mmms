import React from "react";

/**
 * Renders Income & Expense report from API response.
 * New API shape: income.headers[].items[], expenditure.headers[].items[], surplusOrDeficit, unmapped.
 * Falls back to legacy shape: data.income/expenses objects, data.surplus, data.totals.
 */
export default function IncomeExpenseAccount({ data, fromDate, toDate, groupName }) {
    if (!data) {
        return <div className="text-center py-8 text-gray-600">No data available</div>;
    }

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 2,
        }).format(amount ?? 0);
    };

    const formatDate = (date) => {
        if (!date) return "All Time";
        try {
            const d = typeof date === "string" ? new Date(date) : date;
            return d.toLocaleDateString("en-GB");
        } catch {
            return "";
        }
    };

    // New API shape (master mapping)
    const hasNewShape =
        data.income &&
        Array.isArray(data.income.headers) &&
        data.expenditure &&
        Array.isArray(data.expenditure.headers);

    if (hasNewShape) {
        const incomeTotal = data.income.total ?? 0;
        const expenditureTotal = data.expenditure.total ?? 0;
        const surplusOrDeficit = data.surplusOrDeficit ?? incomeTotal - expenditureTotal;
        const unmapped = data.unmapped || { count: 0, total: 0, items: [] };

        return (
            <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
                <div className="mb-4">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Income & Expense A/c</h2>
                    <p className="text-gray-600">
                        {data.fromDate && data.toDate ? (
                            <>
                                Period: {formatDate(data.fromDate)} to {formatDate(data.toDate)}
                            </>
                        ) : fromDate && toDate ? (
                            <>
                                Period: {formatDate(fromDate)} to {formatDate(toDate)}
                            </>
                        ) : (
                            <>Period: All Time</>
                        )}
                    </p>
                    {groupName && <p className="text-gray-600">Group: {groupName}</p>}
                </div>

                {/* Income section: headers and items */}
                <section>
                    <h3 className="text-lg font-semibold text-green-800 mb-3 border-b border-green-200 pb-2">
                        Income
                    </h3>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="bg-green-50">
                                    <th className="border border-gray-200 p-2 text-left font-semibold text-gray-700">
                                        Header / Item
                                    </th>
                                    <th className="border border-gray-200 p-2 text-right font-semibold text-gray-700 w-32">
                                        Amount (₹)
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {(data.income.headers || []).map((header, headerIdx) => (
                                    <React.Fragment key={`income-h-${headerIdx}-${header.headerName || header.headerCode || ""}`}>
                                        <tr className="bg-green-50/50">
                                            <td className="border border-gray-200 p-2 font-medium text-gray-800 pl-4">
                                                {header.headerName || header.headName || "—"}
                                            </td>
                                            <td className="border border-gray-200 p-2 text-right font-medium text-green-700">
                                                {formatCurrency(header.total)}
                                            </td>
                                        </tr>
                                        {(header.items || []).map((item, itemIdx) => (
                                            <tr key={`income-i-${headerIdx}-${itemIdx}-${item.itemName || ""}`} className="hover:bg-gray-50">
                                                <td className="border border-gray-200 p-2 pl-8 text-gray-700">
                                                    {item.itemName || item.headName || "—"}
                                                    {item.ledgerCode != null && (
                                                        <span className="text-gray-500 text-xs ml-1">
                                                            ({item.ledgerCode})
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="border border-gray-200 p-2 text-right text-gray-700">
                                                    {formatCurrency(item.amount)}
                                                </td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))}
                                <tr className="bg-green-100 font-bold">
                                    <td className="border border-gray-200 p-3 text-gray-900">Total Income</td>
                                    <td className="border border-gray-200 p-3 text-right text-green-800">
                                        {formatCurrency(incomeTotal)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Expenditure section: headers and items */}
                <section>
                    <h3 className="text-lg font-semibold text-red-800 mb-3 border-b border-red-200 pb-2">
                        Expenditure
                    </h3>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="bg-red-50">
                                    <th className="border border-gray-200 p-2 text-left font-semibold text-gray-700">
                                        Header / Item
                                    </th>
                                    <th className="border border-gray-200 p-2 text-right font-semibold text-gray-700 w-32">
                                        Amount (₹)
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {(data.expenditure.headers || []).map((header, headerIdx) => (
                                    <React.Fragment key={`exp-h-${headerIdx}-${header.headerName || header.headerCode || ""}`}>
                                        <tr className="bg-red-50/50">
                                            <td className="border border-gray-200 p-2 font-medium text-gray-800 pl-4">
                                                {header.headerName || header.headName || "—"}
                                            </td>
                                            <td className="border border-gray-200 p-2 text-right font-medium text-red-700">
                                                {formatCurrency(header.total)}
                                            </td>
                                        </tr>
                                        {(header.items || []).map((item, itemIdx) => (
                                            <tr key={`exp-i-${headerIdx}-${itemIdx}-${item.itemName || ""}`} className="hover:bg-gray-50">
                                                <td className="border border-gray-200 p-2 pl-8 text-gray-700">
                                                    {item.itemName || item.headName || "—"}
                                                    {item.ledgerCode != null && (
                                                        <span className="text-gray-500 text-xs ml-1">
                                                            ({item.ledgerCode})
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="border border-gray-200 p-2 text-right text-gray-700">
                                                    {formatCurrency(item.amount)}
                                                </td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))}
                                <tr className="bg-red-100 font-bold">
                                    <td className="border border-gray-200 p-3 text-gray-900">Total Expenditure</td>
                                    <td className="border border-gray-200 p-3 text-right text-red-800">
                                        {formatCurrency(expenditureTotal)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Surplus / Deficit */}
                <div
                    className={`rounded-lg border p-4 font-semibold text-lg ${surplusOrDeficit >= 0
                        ? "bg-green-50 border-green-200 text-green-800"
                        : "bg-red-50 border-red-200 text-red-800"
                        }`}
                >
                    {surplusOrDeficit >= 0 ? "Surplus" : "Deficit"}: {formatCurrency(surplusOrDeficit)}
                </div>

                {/* Unmapped (if any) */}
                {unmapped.count > 0 && (
                    <section>
                        <h3 className="text-lg font-semibold text-amber-800 mb-3 border-b border-amber-200 pb-2">
                            Unmapped entries ({unmapped.count})
                        </h3>
                        <p className="text-sm text-gray-600 mb-2">
                            These transaction heads could not be matched to the master mapping. Total:{" "}
                            {formatCurrency(unmapped.total)}
                            {((unmapped.expenditureTotal ?? 0) > 0 || (unmapped.incomeTotal ?? 0) > 0) && (
                                <> (Expenditure: {formatCurrency(unmapped.expenditureTotal ?? 0)}, Income: {formatCurrency(unmapped.incomeTotal ?? 0)})</>
                            )}
                        </p>
                        <div className="overflow-x-auto rounded-lg border border-amber-200">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="bg-amber-50">
                                        <th className="border border-gray-200 p-2 text-left font-semibold text-gray-700">
                                            Source name
                                        </th>
                                        <th className="border border-gray-200 p-2 text-left font-semibold text-gray-700">
                                            Type
                                        </th>
                                        <th className="border border-gray-200 p-2 text-left font-semibold text-gray-700">
                                            Date
                                        </th>
                                        <th className="border border-gray-200 p-2 text-right font-semibold text-gray-700 w-32">
                                            Amount (₹)
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(unmapped.items || []).map((item, idx) => (
                                        <tr key={idx} className="hover:bg-amber-50/50">
                                            <td className="border border-gray-200 p-2 text-gray-700">
                                                {item.sourceName || "—"}
                                            </td>
                                            <td className="border border-gray-200 p-2 text-gray-600">
                                                {item.bucket === "expenditure" || item.bucket === "expense" ? "Expenditure" : item.bucket === "income" ? "Income" : "—"}
                                            </td>
                                            <td className="border border-gray-200 p-2 text-gray-600">
                                                {item.date ? formatDate(item.date) : "—"}
                                            </td>
                                            <td className="border border-gray-200 p-2 text-right text-gray-700">
                                                {formatCurrency(item.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}
            </div>
        );
    }

    // Legacy shape: flat income/expenses objects
    const expenses = data.expenses || {};
    const income = data.income || {};
    const surplus = data.surplus ?? data.netProfit ?? 0;
    const totalExpenses = data.totals?.expenses ?? Object.values(expenses).reduce((s, v) => s + (v || 0), 0);
    const totalIncome = data.totals?.income ?? Object.values(income).reduce((s, v) => s + (v || 0), 0);

    const expenseItems = Object.entries(expenses)
        .filter(([, amount]) => amount > 0)
        .map(([label, amount]) => ({ label, amount }))
        .sort((a, b) => b.amount - a.amount);

    const incomeItems = Object.entries(income)
        .filter(([, amount]) => amount > 0)
        .map(([label, amount]) => ({ label, amount }))
        .sort((a, b) => b.amount - a.amount);

    const maxItems = Math.max(expenseItems.length + 1, incomeItems.length);

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Income & Expense A/c</h2>
                <p className="text-gray-600">
                    {fromDate && toDate ? (
                        <>
                            Period: {formatDate(fromDate)} to {formatDate(toDate)}
                        </>
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
                        <tr className="bg-red-50">
                            <td className="border border-gray-300 p-3 font-semibold text-red-800">Expenses</td>
                            <td className="border border-gray-300 p-3"></td>
                            <td className="border border-gray-300 p-3 font-semibold text-green-800 bg-green-50">
                                Income
                            </td>
                            <td className="border border-gray-300 p-3 bg-green-50"></td>
                        </tr>

                        {Array.from({ length: maxItems }).map((_, index) => {
                            if (index === expenseItems.length) {
                                return (
                                    <tr key={`surplus-${index}`} className="hover:bg-gray-50">
                                        <td className="border border-gray-300 p-3 text-gray-700 font-semibold">
                                            Net Profit / Surplus
                                        </td>
                                        <td
                                            className={`border border-gray-300 p-3 text-right font-bold ${surplus >= 0 ? "text-green-700" : "text-red-700"
                                                }`}
                                        >
                                            {formatCurrency(surplus)}
                                        </td>
                                        {incomeItems[index] ? (
                                            <>
                                                <td
                                                    className={`border border-gray-300 p-3 ${incomeItems[index].amount > 0 ? "text-gray-700" : "text-gray-400"
                                                        }`}
                                                >
                                                    {incomeItems[index].label}
                                                </td>
                                                <td
                                                    className={`border border-gray-300 p-3 text-right font-medium ${incomeItems[index].amount > 0 ? "text-green-700" : "text-gray-400"
                                                        }`}
                                                >
                                                    {incomeItems[index].amount > 0
                                                        ? formatCurrency(incomeItems[index].amount)
                                                        : "-"}
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
                            let rowClass = "";
                            if (expenseItem?.amount > 0) rowClass = "hover:bg-red-50";
                            else if (incomeItem?.amount > 0) rowClass = "hover:bg-green-50";

                            return (
                                <tr key={index} className={rowClass}>
                                    {expenseItem ? (
                                        <>
                                            <td
                                                className={`border border-gray-300 p-3 ${expenseItem.amount > 0 ? "text-gray-700" : "text-gray-400"
                                                    }`}
                                            >
                                                {expenseItem.label}
                                            </td>
                                            <td
                                                className={`border border-gray-300 p-3 text-right font-medium ${expenseItem.amount > 0 ? "text-red-700" : "text-gray-400"
                                                    }`}
                                            >
                                                {expenseItem.amount > 0 ? formatCurrency(expenseItem.amount) : "-"}
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="border border-gray-300 p-3"></td>
                                            <td className="border border-gray-300 p-3"></td>
                                        </>
                                    )}
                                    {incomeItem ? (
                                        <>
                                            <td
                                                className={`border border-gray-300 p-3 ${incomeItem.amount > 0 ? "text-gray-700" : "text-gray-400"
                                                    }`}
                                            >
                                                {incomeItem.label}
                                            </td>
                                            <td
                                                className={`border border-gray-300 p-3 text-right font-medium ${incomeItem.amount > 0 ? "text-green-700" : "text-gray-400"
                                                    }`}
                                            >
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

                        <tr className="bg-gradient-to-r from-gray-700 to-gray-800 text-white font-bold">
                            <td className="border border-gray-300 p-4 text-lg">Total</td>
                            <td className="border border-gray-300 p-4 text-right text-xl">
                                {formatCurrency(totalExpenses + surplus)}
                            </td>
                            <td className="border border-gray-300 p-4 text-lg">Total</td>
                            <td className="border border-gray-300 p-4 text-right text-xl">
                                {formatCurrency(totalIncome)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
