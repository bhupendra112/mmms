import { useState } from "react";
import { useParams } from "react-router-dom";

export default function MemberDashboard() {
  const { id } = useParams();

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // LEDGER DATA
  const ledger = [
    {
      date: "2024-03-05",
      receipt: 1000,

      savingsDeposit: 500,
      savingsWithdraw: 0,
      savingsBalance: 8200,

      loanPaid: 1200,
      loanRecovered: 1200,
      loanBalance: 4500,

      fdDeposit: 2000,
      fdWithdraw: 0,
      fdBalance: 12000,

      interestDue: 200,
      interestPaid: 50,
    },
    {
      date: "2024-02-05",
      receipt: 800,

      savingsDeposit: 400,
      savingsWithdraw: 0,
      savingsBalance: 7700,

      loanPaid: 0,
      loanRecovered: 1200,
      loanBalance: 5700,

      fdDeposit: 0,
      fdWithdraw: 0,
      fdBalance: 10000,

      interestDue: 600,
      interestPaid: 100,
    },
  ];

  // MEMBER DETAILS
  const member = {
    code: "M001",
    name: "Rahul Patel",
    fatherName: "Ramesh Patel",
    sssmid: "1234-5678",
    village: "Rewa",
    joiningDate: "2021-05-12",
    openingBalance: 1500,
    savingsTotal: 8200,
    loanOutstanding: 4500,
    fdTotal: 12000,
    interestPending: 800,
    lastRecoveryDate: "2024-03-10",
  };

  // DATE FILTER FUNCTION
  const filterByDate = (data) => {
    return data.filter((item) => {
      const itemDate = new Date(item.date);
      const from = fromDate ? new Date(fromDate) : null;
      const to = toDate ? new Date(toDate) : null;

      if (from && itemDate < from) return false;
      if (to && itemDate > to) return false;

      return true;
    });
  };

  const filteredLedger = filterByDate(ledger);

  // EXPORT CSV
  const exportFullDetails = () => {
    const data = [
      ["Field", "Value"],
      ["Member Code", member.code],
      ["Name", member.name],
      ["Father/Husband Name", member.fatherName],
      ["SSSMID", member.sssmid],
      ["Village", member.village],
      ["Joining Date", member.joiningDate],
      ["Opening Balance", member.openingBalance],
      ["Savings Total", member.savingsTotal],
      ["Loan Outstanding", member.loanOutstanding],
      ["FD Total", member.fdTotal],
      ["Interest Pending", member.interestPending],
      ["Last Recovery Date", member.lastRecoveryDate],
    ];

    const csv = data.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `member_full_detail_${member.code}.csv`;
    a.click();
  };

  return (
    <div className="p-6">
      
      {/* TOP BUTTONS */}
      <div className="flex justify-end gap-4 mb-6">
        <button className="bg-red-600 hover:bg-red-700 px-6 py-3 text-white font-semibold rounded-lg shadow">
          Start Recovery Entry
        </button>

        <button
          onClick={exportFullDetails}
          className="bg-blue-700 hover:bg-blue-800 px-6 py-3 text-white font-semibold rounded-lg shadow"
        >
          Export Full Details
        </button>
      </div>

      <h1 className="text-3xl font-bold mb-6">Member Dashboard</h1>

      {/* BASIC DETAILS */}
      <div className="bg-white p-6 rounded-xl shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">Basic Details</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <p><b>Member Code:</b> {member.code}</p>
          <p><b>Name:</b> {member.name}</p>
          <p><b>Father/Husband Name:</b> {member.fatherName}</p>
          <p><b>SSSMID:</b> {member.sssmid}</p>
          <p><b>Village:</b> {member.village}</p>
          <p><b>Date of Joining:</b> {member.joiningDate}</p>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="bg-white p-6 rounded-xl shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">Financial Summary</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <p><b>Opening Balance:</b> ₹{member.openingBalance}</p>
          <p><b>Savings Total:</b> ₹{member.savingsTotal}</p>
          <p><b>Loan Outstanding:</b> ₹{member.loanOutstanding}</p>
          <p><b>FD Total:</b> ₹{member.fdTotal}</p>
          <p><b>Interest Pending:</b> ₹{member.interestPending}</p>
          <p><b>Last Recovery:</b> {member.lastRecoveryDate}</p>
        </div>
      </div>

      {/* DATE FILTER */}
      <div className="flex gap-4 mb-6">
        <div>
          <label>From</label>
          <input
            type="date"
            className="border p-2 ml-2"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div>
          <label>To</label>
          <input
            type="date"
            className="border p-2 ml-2"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </div>

      {/* LEDGER TABLE */}
      <div className="overflow-auto">
        <table className="w-full border text-sm">
          <thead>
            <tr className="bg-gray-200">
              <th rowSpan="2" className="border p-2">Date</th>
              <th rowSpan="2" className="border p-2">Receipt</th>

              <th colSpan="3" className="border p-2">Monthly Savings</th>
              <th colSpan="3" className="border p-2">General Loan</th>
              <th colSpan="3" className="border p-2">FD</th>
              <th colSpan="2" className="border p-2">Interest</th>
            </tr>

            <tr className="bg-gray-100">
              <th className="border p-2">Deposit</th>
              <th className="border p-2">Withdraw</th>
              <th className="border p-2">Balance</th>

              <th className="border p-2">Paid</th>
              <th className="border p-2">Recovered</th>
              <th className="border p-2">Balance</th>

              <th className="border p-2">Deposit</th>
              <th className="border p-2">Withdraw</th>
              <th className="border p-2">Balance</th>

              <th className="border p-2">Due</th>
              <th className="border p-2">Paid</th>
            </tr>
          </thead>

          <tbody>
            {filteredLedger.length === 0 ? (
              <tr>
                <td colSpan="14" className="text-center p-3">
                  No Records Found
                </td>
              </tr>
            ) : (
              filteredLedger.map((row, i) => (
                <tr key={i}>
                  <td className="border p-2">{row.date}</td>
                  <td className="border p-2">{row.receipt}</td>

                  <td className="border p-2">{row.savingsDeposit}</td>
                  <td className="border p-2">{row.savingsWithdraw}</td>
                  <td className="border p-2">{row.savingsBalance}</td>

                  <td className="border p-2">{row.loanPaid}</td>
                  <td className="border p-2">{row.loanRecovered}</td>
                  <td className="border p-2">{row.loanBalance}</td>

                  <td className="border p-2">{row.fdDeposit}</td>
                  <td className="border p-2">{row.fdWithdraw}</td>
                  <td className="border p-2">{row.fdBalance}</td>

                  <td className="border p-2">{row.interestDue}</td>
                  <td className="border p-2">{row.interestPaid}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
