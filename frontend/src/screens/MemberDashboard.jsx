import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Download, FileText, Calendar } from "lucide-react";
import { exportToExcel, exportToPDF } from "../utils/exportUtils";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { getMemberDetail } from "../services/memberService";

export default function MemberDashboard() {
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [memberDoc, setMemberDoc] = useState(null);
  const [loadError, setLoadError] = useState("");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setLoadError("");
    getMemberDetail(id)
      .then((res) => setMemberDoc(res?.data || null))
      .catch((e) => {
        console.error("Failed to load member detail:", e);
        setMemberDoc(null);
        setLoadError(String(e || "Failed to load member"));
      })
      .finally(() => setLoading(false));
  }, [id]);

  const member = useMemo(() => {
    // Map backend member doc -> UI model
    return {
      code: memberDoc?.Member_Id || "-",
      name: memberDoc?.Member_Nm || "-",
      fatherName: memberDoc?.F_H_Name || memberDoc?.F_H_FatherName || "-",
      village: memberDoc?.Village || "-",
      joiningDate: memberDoc?.Dt_Join || "",
      // Financial fields are not stored yet; keep 0 until ledger APIs are added
      openingBalance: 0,
      savingsTotal: 0,
      loanOutstanding: 0,
      fdTotal: 0,
      interestPending: 0,
      lastRecoveryDate: "",
    };
  }, [memberDoc]);

  // Ledger is not wired yet; keep empty until transaction APIs are implemented
  const ledger = [];

  // Format date to dd/mm/yyyy
  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
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

  // Export table to Excel
  const exportTableToExcel = () => {
    const data = filteredLedger.map((row) => ({
      Date: formatDate(row.date),
      Receipt: row.receipt,
      "Savings Deposit": row.savingsDeposit,
      "Savings Withdraw": row.savingsWithdraw,
      "Savings Balance": row.savingsBalance,
      "Loan Paid": row.loanPaid,
      "Loan Recovered": row.loanRecovered,
      "Loan Balance": row.loanBalance,
      "FD Deposit": row.fdDeposit,
      "FD Withdraw": row.fdWithdraw,
      "FD Balance": row.fdBalance,
      "Interest Due": row.interestDue,
      "Interest Paid": row.interestPaid,
    }));

    exportToExcel(data, `Member_${member.code}_Transactions_${new Date().toISOString().split("T")[0]}`);
  };

  // Export table to PDF
  const exportTableToPDF = () => {
    const headers = [
      "Date",
      "Receipt",
      "Savings Deposit",
      "Savings Withdraw",
      "Savings Balance",
      "Loan Paid",
      "Loan Recovered",
      "Loan Balance",
      "FD Deposit",
      "FD Withdraw",
      "FD Balance",
      "Interest Due",
      "Interest Paid",
    ];

    const rows = filteredLedger.map((row) => [
      formatDate(row.date),
      row.receipt.toString(),
      `₹${row.savingsDeposit}`,
      `₹${row.savingsWithdraw}`,
      `₹${row.savingsBalance}`,
      `₹${row.loanPaid}`,
      `₹${row.loanRecovered}`,
      `₹${row.loanBalance}`,
      `₹${row.fdDeposit}`,
      `₹${row.fdWithdraw}`,
      `₹${row.fdBalance}`,
      `₹${row.interestDue}`,
      `₹${row.interestPaid}`,
    ]);

    exportToPDF(
      `${member.name} (${member.code}) - Transaction Report`,
      headers,
      rows,
      `Member_${member.code}_Transactions_${new Date().toISOString().split("T")[0]}`
    );
  };

  // Export full member details to Excel
  const exportFullDetailsToExcel = () => {
    const data = [
      ["Field", "Value"],
      ["Member Code", member.code],
      ["Name", member.name],
      ["Father/Husband Name", member.fatherName],
      ["SSSMID", member.sssmid],
      ["Village", member.village],
      ["Date of Joining", formatDate(member.joiningDate)],
      ["Opening Balance", `₹${member.openingBalance}`],
      ["Savings Total", `₹${member.savingsTotal}`],
      ["Loan Outstanding", `₹${member.loanOutstanding}`],
      ["FD Total", `₹${member.fdTotal}`],
      ["Interest Pending", `₹${member.interestPending}`],
      ["Last Recovery", formatDate(member.lastRecoveryDate)],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Member Details");
    XLSX.writeFile(wb, `Member_${member.code}_Full_Details_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // Export full member details to PDF
  const exportFullDetailsToPDF = () => {
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.text("Member Dashboard - Full Details", 14, 20);

    // Member Information
    doc.setFontSize(12);
    doc.text("Basic Details", 14, 35);
    doc.setFontSize(10);

    let yPos = 42;
    const lineHeight = 7;

    doc.text(`Member Code: ${member.code}`, 14, yPos);
    yPos += lineHeight;
    doc.text(`Name: ${member.name}`, 14, yPos);
    yPos += lineHeight;
    doc.text(`Father/Husband Name: ${member.fatherName}`, 14, yPos);
    yPos += lineHeight;
    doc.text(`SSSMID: ${member.sssmid}`, 14, yPos);
    yPos += lineHeight;
    doc.text(`Village: ${member.village}`, 14, yPos);
    yPos += lineHeight;
    doc.text(`Date of Joining: ${formatDate(member.joiningDate)}`, 14, yPos);
    yPos += lineHeight + 5;

    // Financial Summary
    doc.setFontSize(12);
    doc.text("Financial Summary", 14, yPos);
    yPos += lineHeight;
    doc.setFontSize(10);

    doc.text(`Opening Balance: ₹${member.openingBalance}`, 14, yPos);
    yPos += lineHeight;
    doc.text(`Savings Total: ₹${member.savingsTotal}`, 14, yPos);
    yPos += lineHeight;
    doc.text(`Loan Outstanding: ₹${member.loanOutstanding}`, 14, yPos);
    yPos += lineHeight;
    doc.text(`FD Total: ₹${member.fdTotal}`, 14, yPos);
    yPos += lineHeight;
    doc.text(`Interest Pending: ₹${member.interestPending}`, 14, yPos);
    yPos += lineHeight;
    doc.text(`Last Recovery: ${formatDate(member.lastRecoveryDate)}`, 14, yPos);
    yPos += lineHeight + 10;

    // Transaction Table
    if (filteredLedger.length > 0) {
      const headers = [
        "Date",
        "Receipt",
        "Savings Deposit",
        "Savings Withdraw",
        "Savings Balance",
        "Loan Paid",
        "Loan Recovered",
        "Loan Balance",
        "FD Deposit",
        "FD Withdraw",
        "FD Balance",
        "Interest Due",
        "Interest Paid",
      ];

      const rows = filteredLedger.map((row) => [
        formatDate(row.date),
        row.receipt.toString(),
        `₹${row.savingsDeposit}`,
        `₹${row.savingsWithdraw}`,
        `₹${row.savingsBalance}`,
        `₹${row.loanPaid}`,
        `₹${row.loanRecovered}`,
        `₹${row.loanBalance}`,
        `₹${row.fdDeposit}`,
        `₹${row.fdWithdraw}`,
        `₹${row.fdBalance}`,
        `₹${row.interestDue}`,
        `₹${row.interestPaid}`,
      ]);

      doc.autoTable({
        head: [headers],
        body: rows,
        startY: yPos,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [66, 139, 202] },
        margin: { left: 14, right: 14 },
      });
    }

    doc.save(`Member_${member.code}_Full_Details_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
          <FileText size={32} />
          Member Dashboard
        </h1>
        <p className="text-gray-600 mt-2">{member.name} ({member.code})</p>
      </div>

      {loading && <p className="text-gray-600 mb-6">Loading member…</p>}
      {!loading && loadError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700 font-semibold">Failed to load member</p>
          <p className="text-red-600 text-sm mt-1">{loadError}</p>
        </div>
      )}

      {/* Export Buttons */}
      <div className="flex justify-end gap-4 mb-6">
        <button
          onClick={exportTableToExcel}
          className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold shadow-md"
        >
          <Download size={18} />
          Export Table Excel
        </button>
        <button
          onClick={exportTableToPDF}
          className="flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold shadow-md"
        >
          <FileText size={18} />
          Export Table PDF
        </button>
        <button
          onClick={exportFullDetailsToExcel}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold shadow-md"
        >
          <Download size={18} />
          Export Full Details Excel
        </button>
        <button
          onClick={exportFullDetailsToPDF}
          className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold shadow-md"
        >
          <FileText size={18} />
          Export Full Details PDF
        </button>
      </div>

      {/* Basic Details Table */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Basic Details</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50 w-1/3">Member Code:</td>
                <td className="p-3 text-gray-800">{member.code}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Name:</td>
                <td className="p-3 text-gray-800">{member.name}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Father/Husband Name:</td>
                <td className="p-3 text-gray-800">{member.fatherName}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">SSSMID:</td>
                <td className="p-3 text-gray-800">{member.sssmid}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Village:</td>
                <td className="p-3 text-gray-800">{member.village}</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Date of Joining:</td>
                <td className="p-3 text-gray-800">{formatDate(member.joiningDate)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Financial Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50 w-1/3">Opening Balance:</td>
                <td className="p-3 text-gray-800">₹{member.openingBalance}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Savings Total:</td>
                <td className="p-3 text-gray-800">₹{member.savingsTotal}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Loan Outstanding:</td>
                <td className="p-3 text-gray-800">₹{member.loanOutstanding}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">FD Total:</td>
                <td className="p-3 text-gray-800">₹{member.fdTotal}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Interest Pending:</td>
                <td className="p-3 text-gray-800">₹{member.interestPending}</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Last Recovery:</td>
                <td className="p-3 text-gray-800">{formatDate(member.lastRecoveryDate)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Date Filter */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Calendar size={24} />
          Date Range Filter
        </h2>
        <div className="flex gap-6 items-end">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {fromDate && (
              <p className="text-xs text-gray-500 mt-1">Selected: {formatDate(fromDate)}</p>
            )}
          </div>
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {toDate && (
              <p className="text-xs text-gray-500 mt-1">Selected: {formatDate(toDate)}</p>
            )}
          </div>
          <div>
            <button
              onClick={() => {
                setFromDate("");
                setToDate("");
              }}
              className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Transaction Details</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th rowSpan={2} className="border border-gray-300 p-3 text-left font-semibold">
                  Date
                </th>
                <th rowSpan={2} className="border border-gray-300 p-3 text-left font-semibold">
                  Receipt
                </th>
                <th colSpan={3} className="border border-gray-300 p-3 text-center font-semibold">
                  Monthly Savings
                </th>
                <th colSpan={3} className="border border-gray-300 p-3 text-center font-semibold">
                  General Loan
                </th>
                <th colSpan={3} className="border border-gray-300 p-3 text-center font-semibold">
                  FD
                </th>
                <th colSpan={2} className="border border-gray-300 p-3 text-center font-semibold">
                  Interest
                </th>
              </tr>
              <tr className="bg-gray-50">
                <th className="border border-gray-300 p-2 text-center font-medium">Deposit</th>
                <th className="border border-gray-300 p-2 text-center font-medium">Withdraw</th>
                <th className="border border-gray-300 p-2 text-center font-medium">Balance</th>
                <th className="border border-gray-300 p-2 text-center font-medium">Paid</th>
                <th className="border border-gray-300 p-2 text-center font-medium">Recovered</th>
                <th className="border border-gray-300 p-2 text-center font-medium">Balance</th>
                <th className="border border-gray-300 p-2 text-center font-medium">Deposit</th>
                <th className="border border-gray-300 p-2 text-center font-medium">Withdraw</th>
                <th className="border border-gray-300 p-2 text-center font-medium">Balance</th>
                <th className="border border-gray-300 p-2 text-center font-medium">Due</th>
                <th className="border border-gray-300 p-2 text-center font-medium">Paid</th>
              </tr>
            </thead>
            <tbody>
              {filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan={14} className="text-center p-6 text-gray-500">
                    No records found for the selected date range
                  </td>
                </tr>
              ) : (
                filteredLedger.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="border border-gray-300 p-3">{formatDate(row.date)}</td>
                    <td className="border border-gray-300 p-3">{row.receipt}</td>
                    <td className="border border-gray-300 p-3 text-right">₹{row.savingsDeposit}</td>
                    <td className="border border-gray-300 p-3 text-right">₹{row.savingsWithdraw}</td>
                    <td className="border border-gray-300 p-3 text-right font-semibold">
                      ₹{row.savingsBalance}
                    </td>
                    <td className="border border-gray-300 p-3 text-right">₹{row.loanPaid}</td>
                    <td className="border border-gray-300 p-3 text-right">₹{row.loanRecovered}</td>
                    <td className="border border-gray-300 p-3 text-right font-semibold">
                      ₹{row.loanBalance}
                    </td>
                    <td className="border border-gray-300 p-3 text-right">₹{row.fdDeposit}</td>
                    <td className="border border-gray-300 p-3 text-right">₹{row.fdWithdraw}</td>
                    <td className="border border-gray-300 p-3 text-right font-semibold">
                      ₹{row.fdBalance}
                    </td>
                    <td className="border border-gray-300 p-3 text-right">₹{row.interestDue}</td>
                    <td className="border border-gray-300 p-3 text-right">₹{row.interestPaid}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filteredLedger.length > 0 && (
          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredLedger.length} record(s)
            {fromDate || toDate
              ? ` (Filtered from ${fromDate ? formatDate(fromDate) : "beginning"} to ${toDate ? formatDate(toDate) : "end"
              })`
              : " (All records)"}
          </div>
        )}
      </div>
    </div>
  );
}
