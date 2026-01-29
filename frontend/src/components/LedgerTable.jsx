import React from "react";

const LedgerTable = ({ ledger }) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (row) => {
    if (row.formattedDate) return row.formattedDate;
    if (row.date) {
      try {
        return new Date(row.date).toLocaleDateString("en-GB");
      } catch {
        return row.date;
      }
    }
    return "N/A";
  };

  const modeClass = (mode) => {
    if (mode === "Cash") return "bg-green-100 text-green-800";
    if (mode === "Online") return "bg-blue-100 text-blue-800";
    if (mode === "Cash & Online") return "bg-purple-100 text-purple-800";
    return "bg-gray-100 text-gray-800";
  };

  if (!ledger || ledger.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <p className="text-gray-600">No ledger entries found</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile & tablet: card list (no horizontal scroll) */}
      <div className="md:hidden w-full space-y-3">
        {ledger.map((row, index) => (
          <div
            key={index}
            className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden"
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-gray-50 border-b border-gray-200">
              <span className="font-medium text-gray-800 truncate">{row.member || "N/A"}</span>
              <span className="text-xs text-gray-500 shrink-0">{formatDate(row)}</span>
            </div>
            <div className="px-3 py-2.5 space-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-gray-600">Savings</span>
                <span className="font-medium text-right">{formatCurrency(row.savings)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-600">Loan</span>
                <span className="font-medium text-right">{formatCurrency(row.loan)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-600">FD</span>
                <span className="font-medium text-right">{formatCurrency(row.fd)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-600">Interest</span>
                <span className="font-medium text-right">{formatCurrency(row.interest)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-600">Yogdan</span>
                <span className="font-medium text-right">{formatCurrency(row.yogdan)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-600">Other</span>
                <span className="font-medium text-right">{formatCurrency(row.other)}</span>
              </div>
              <div className="flex justify-between gap-2 pt-1.5 border-t border-gray-100">
                <span className="font-semibold text-gray-800">Total</span>
                <span className="font-semibold text-blue-700">{formatCurrency(row.total)}</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-gray-600 text-xs">Mode</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${modeClass(row.mode)}`}>
                  {row.mode || "N/A"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block overflow-x-auto rounded-lg shadow-lg bg-white w-full">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="bg-blue-600 text-white">
            <tr>
              <th className="p-3 border text-left whitespace-nowrap">Date</th>
              <th className="p-3 border text-left whitespace-nowrap">Member</th>
              <th className="p-3 border text-right whitespace-nowrap">Savings</th>
              <th className="p-3 border text-right whitespace-nowrap">Loan</th>
              <th className="p-3 border text-right whitespace-nowrap">FD</th>
              <th className="p-3 border text-right whitespace-nowrap">Interest</th>
              <th className="p-3 border text-right whitespace-nowrap">Yogdan</th>
              <th className="p-3 border text-right whitespace-nowrap">Other</th>
              <th className="p-3 border text-right font-semibold whitespace-nowrap">Total</th>
              <th className="p-3 border text-center whitespace-nowrap">Mode</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((row, index) => (
              <tr key={index} className="odd:bg-gray-50 hover:bg-blue-50 transition-colors">
                <td className="border p-3 whitespace-nowrap">{formatDate(row)}</td>
                <td className="border p-3 min-w-[100px]">{row.member || "N/A"}</td>
                <td className="border p-3 text-right whitespace-nowrap">{formatCurrency(row.savings)}</td>
                <td className="border p-3 text-right whitespace-nowrap">{formatCurrency(row.loan)}</td>
                <td className="border p-3 text-right whitespace-nowrap">{formatCurrency(row.fd)}</td>
                <td className="border p-3 text-right whitespace-nowrap">{formatCurrency(row.interest)}</td>
                <td className="border p-3 text-right whitespace-nowrap">{formatCurrency(row.yogdan)}</td>
                <td className="border p-3 text-right whitespace-nowrap">{formatCurrency(row.other)}</td>
                <td className="border p-3 text-right font-semibold text-blue-700 whitespace-nowrap">{formatCurrency(row.total)}</td>
                <td className="border p-3 text-center whitespace-nowrap">
                  <span className={`px-2 py-1 rounded text-xs ${modeClass(row.mode)}`}>
                    {row.mode || "N/A"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default LedgerTable;
