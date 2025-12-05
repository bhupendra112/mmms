import React from "react";

const LedgerTable = ({ ledger }) => {
  return (
    <div className="overflow-auto rounded-lg shadow-lg">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-blue-600 text-white">
          <tr>
            <th className="p-2 border">Date</th>
            <th className="p-2 border">Member</th>
            <th className="p-2 border">Savings</th>
            <th className="p-2 border">Loan</th>
            <th className="p-2 border">FD</th>
            <th className="p-2 border">Interest</th>
            <th className="p-2 border">Other</th>
            <th className="p-2 border">Total</th>
            <th className="p-2 border">Mode</th>
          </tr>
        </thead>

        <tbody>
          {ledger.map((row, index) => (
            <tr key={index} className="odd:bg-gray-100">
              <td className="border p-2">{row.date}</td>
              <td className="border p-2">{row.member}</td>
              <td className="border p-2">₹ {row.savings}</td>
              <td className="border p-2">₹ {row.loan}</td>
              <td className="border p-2">₹ {row.fd}</td>
              <td className="border p-2">₹ {row.interest}</td>
              <td className="border p-2">₹ {row.other}</td>
              <td className="border p-2 font-semibold">₹ {row.total}</td>
              <td className="border p-2">{row.mode}</td>
            </tr>
          ))}
        </tbody>

      </table>
    </div>
  );
};

export default LedgerTable;
