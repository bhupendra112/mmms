import React from "react";

export default function BalanceSheet({ data, asOnDate, groupName }) {
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
        if (!date) return "";
        try {
            const d = new Date(date);
            return d.toLocaleDateString("en-GB");
        } catch {
            return "";
        }
    };

    const liabilities = data.liabilities || {};
    const assets = data.assets || {};

    // Prepare liability items - dynamically from data (backward compatible)
    // New format: liabilities is an object with head names as keys (excluding 'total')
    // Old format: liabilities has fixed keys like surplus, saving, fd
    const liabilityItems = Object.entries(liabilities)
        .filter(([key, amount]) => key !== 'total' && (amount || 0) > 0) // Exclude 'total' and show only non-zero
        .map(([label, amount]) => ({ label, amount }))
        .sort((a, b) => b.amount - a.amount); // Sort by amount descending

    // Prepare asset items - dynamically from data (backward compatible)
    // New format: assets is an object with head names as keys (excluding 'total')
    // Old format: assets has fixed keys like loan, cash, bank
    const assetItems = Object.entries(assets)
        .filter(([key, amount]) => key !== 'total' && (amount || 0) > 0) // Exclude 'total' and show only non-zero
        .map(([label, amount]) => ({ label, amount }))
        .sort((a, b) => b.amount - a.amount); // Sort by amount descending

    // Find max length to align rows
    const maxItems = Math.max(liabilityItems.length, assetItems.length);

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Balance Sheet</h2>
                <p className="text-gray-600">As on: {formatDate(asOnDate)}</p>
                {groupName && <p className="text-gray-600">Group: {groupName}</p>}
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                            <th className="border border-gray-300 p-4 text-left font-bold">Liabilities</th>
                            <th className="border border-gray-300 p-4 text-right font-bold">Amount</th>
                            <th className="border border-gray-300 p-4 text-left font-bold">Assets</th>
                            <th className="border border-gray-300 p-4 text-right font-bold">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Liabilities and Assets Headers - Same Row */}
                        <tr className="bg-purple-50">
                            <td className="border border-gray-300 p-3 font-semibold text-purple-800">Liabilities</td>
                            <td className="border border-gray-300 p-3"></td>
                            <td className="border border-gray-300 p-3 font-semibold text-blue-800 bg-blue-50">Assets</td>
                            <td className="border border-gray-300 p-3 bg-blue-50"></td>
                        </tr>

                        {/* Liability and Asset Items - Side by Side */}
                        {Array.from({ length: maxItems }).map((_, index) => {
                            const liabilityItem = liabilityItems[index];
                            const assetItem = assetItems[index];
                            const hasLiability = liabilityItem && (liabilityItem.amount || 0) >= 0;
                            const hasAsset = assetItem && (assetItem.amount || 0) >= 0;

                            return (
                                <tr key={index} className={hasLiability ? "hover:bg-purple-50" : hasAsset ? "hover:bg-blue-50" : ""}>
                                    {hasLiability ? (
                                        <>
                                            <td className="border border-gray-300 p-3 text-gray-700">{liabilityItem.label}</td>
                                            <td className="border border-gray-300 p-3 text-right font-medium text-purple-700">{formatCurrency(liabilityItem.amount || 0)}</td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="border border-gray-300 p-3"></td>
                                            <td className="border border-gray-300 p-3"></td>
                                        </>
                                    )}
                                    {hasAsset ? (
                                        <>
                                            <td className="border border-gray-300 p-3 text-gray-700">{assetItem.label}</td>
                                            <td className="border border-gray-300 p-3 text-right font-medium text-blue-700">{formatCurrency(assetItem.amount || 0)}</td>
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
                            <td className="border border-gray-300 p-4 text-right text-xl">{formatCurrency(liabilities.total || 0)}</td>
                            <td className="border border-gray-300 p-4 text-lg">Total</td>
                            <td className="border border-gray-300 p-4 text-right text-xl">{formatCurrency(assets.total || 0)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
