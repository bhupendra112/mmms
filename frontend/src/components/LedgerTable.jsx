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

  if (!ledger || ledger.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <p className="text-gray-600">No ledger entries found</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-lg shadow-lg bg-white">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-blue-600 text-white">
          <tr>
            <th className="p-3 border text-left">Date</th>
            <th className="p-3 border text-left">Member</th>
            <th className="p-3 border text-right">Savings</th>
            <th className="p-3 border text-right">Loan</th>
            <th className="p-3 border text-right">FD</th>
            <th className="p-3 border text-right">Interest</th>
            <th className="p-3 border text-right">Yogdan</th>
            <th className="p-3 border text-right">Other</th>
            <th className="p-3 border text-right font-semibold">Total</th>
            <th className="p-3 border text-center">Mode</th>
          </tr>
        </thead>

        <tbody>
          {ledger.map((row, index) => (
            <tr key={index} className="odd:bg-gray-50 hover:bg-blue-50 transition-colors">
              <td className="border p-3">{formatDate(row)}</td>
              <td className="border p-3">{row.member || "N/A"}</td>
              <td className="border p-3 text-right">{formatCurrency(row.savings)}</td>
              <td className="border p-3 text-right">{formatCurrency(row.loan)}</td>
              <td className="border p-3 text-right">{formatCurrency(row.fd)}</td>
              <td className="border p-3 text-right">{formatCurrency(row.interest)}</td>
              <td className="border p-3 text-right">{formatCurrency(row.yogdan)}</td>
              <td className="border p-3 text-right">{formatCurrency(row.other)}</td>
              <td className="border p-3 text-right font-semibold text-blue-700">{formatCurrency(row.total)}</td>
              <td className="border p-3 text-center">
                <span className={`px-2 py-1 rounded text-xs ${row.mode === "Cash" ? "bg-green-100 text-green-800" :
                    row.mode === "Online" ? "bg-blue-100 text-blue-800" :
                      row.mode === "Cash & Online" ? "bg-purple-100 text-purple-800" :
                        "bg-gray-100 text-gray-800"
                  }`}>
                  {row.mode || "N/A"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default LedgerTable;
