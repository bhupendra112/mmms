import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Download, FileText, Calendar, DollarSign, Image as ImageIcon, User, IdCard } from "lucide-react";
import { exportToExcel, exportToPDF } from "../utils/exportUtils";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { getMemberDetail } from "../services/memberService";
import { getLoans } from "../services/loanService";
import { getRecoveries } from "../services/recoveryService";

// Helper function to get full image URL
const getImageUrl = (imagePath) => {
  if (!imagePath) return null;

  // Get backend origin - extract only protocol://host:port (no API paths)
  const rawBaseURL = import.meta.env.VITE_BASE_URL || "http://localhost:8080";

  let baseURL;
  try {
    // Try to parse as URL and extract origin (protocol://host:port)
    const url = new URL(rawBaseURL);
    baseURL = `${url.protocol}//${url.host}`; // Gets protocol://host:port
  } catch {
    // If parsing fails, extract origin manually
    const match = rawBaseURL.match(/^(https?:\/\/[^/]+)/i);
    baseURL = match ? match[1] : "http://localhost:8080";
  }

  // Ensure imagePath starts with /
  const cleanImagePath = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
  const fullUrl = `${baseURL}${cleanImagePath}`;

  return fullUrl;
};

export default function MemberDashboard() {
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [memberDoc, setMemberDoc] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [memberLoans, setMemberLoans] = useState([]);
  const [memberRecoveries, setMemberRecoveries] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [imageErrors, setImageErrors] = useState({});

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const handleImageError = (imagePath) => {
    setImageErrors(prev => ({ ...prev, [imagePath]: true }));
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setLoadError("");
    getMemberDetail(id)
      .then((res) => {
        setMemberDoc(res?.data || null);
        // After member is loaded, fetch transactions
        if (res?.data) {
          loadMemberTransactions(res.data);
        }
      })
      .catch((e) => {
        console.error("Failed to load member detail:", e);
        setMemberDoc(null);
        setLoadError(String(e || "Failed to load member"));
      })
      .finally(() => setLoading(false));
  }, [id]);

  const loadMemberTransactions = async (memberData) => {
    if (!memberData?.group) return;

    try {
      setTransactionsLoading(true);
      const groupId = memberData.group._id || memberData.group;
      const memberId = memberData._id || id;
      const memberCode = memberData.Member_Id;

      // Fetch loans and recoveries for the group
      const [loansRes, recoveriesRes] = await Promise.all([
        getLoans(groupId).catch(() => ({ success: false, data: [] })),
        getRecoveries(groupId).catch(() => ({ success: false, data: [] })),
      ]);

      // Filter loans by memberId or memberCode
      const loans = loansRes?.data || [];
      const filteredLoans = Array.isArray(loans)
        ? loans.filter(
          (loan) =>
            loan.memberId === memberId ||
            loan.memberId === id ||
            loan.memberCode === memberCode ||
            loan.memberCode === memberData.Member_Id
        )
        : [];
      setMemberLoans(filteredLoans);

      // Filter recoveries by memberId or memberCode
      const recoveries = recoveriesRes?.data || [];
      const filteredRecoveries = [];
      if (Array.isArray(recoveries)) {
        recoveries.forEach((recovery) => {
          if (recovery.recoveries && Array.isArray(recovery.recoveries)) {
            recovery.recoveries.forEach((memberRecovery) => {
              if (
                memberRecovery.memberId === memberId ||
                memberRecovery.memberId === id ||
                memberRecovery.memberCode === memberCode ||
                memberRecovery.memberCode === memberData.Member_Id
              ) {
                filteredRecoveries.push({
                  ...memberRecovery,
                  recoveryDate: recovery.date,
                  recoveryId: recovery._id,
                });
              }
            });
          }
        });
      }
      setMemberRecoveries(filteredRecoveries);
    } catch (error) {
      console.error("Error loading member transactions:", error);
    } finally {
      setTransactionsLoading(false);
    }
  };

  const member = useMemo(() => {
    // Map backend member doc -> UI model
    const isExisting = memberDoc?.isExistingMember || false;
    const openingSaving = memberDoc?.openingSaving || 0;
    const fdDetails = memberDoc?.fdDetails || {};
    const loanDetails = memberDoc?.loanDetails || {};
    const openingYogdan = memberDoc?.openingYogdan || 0;

    return {
      code: memberDoc?.Member_Id || "-",
      name: memberDoc?.Member_Nm || "-",
      fatherName: memberDoc?.F_H_Name || memberDoc?.F_H_FatherName || "-",
      village: memberDoc?.Village || "-",
      joiningDate: memberDoc?.Dt_Join || "",
      // Financial fields from existing member data
      openingBalance: openingSaving,
      savingsTotal: openingSaving, // Opening saving is the initial savings total
      loanOutstanding: loanDetails?.amount || 0,
      loanDate: loanDetails?.loanDate || null,
      loanOverdueInterest: loanDetails?.overdueInterest || 0,
      fdTotal: fdDetails?.amount || 0,
      fdDate: fdDetails?.date || null,
      fdMaturityDate: fdDetails?.maturityDate || null,
      fdInterest: fdDetails?.interest || 0,
      interestPending: loanDetails?.overdueInterest || 0,
      openingYogdan: openingYogdan,
      isExistingMember: isExisting,
      lastRecoveryDate: "",
    };
  }, [memberDoc]);

  // Create ledger entries from existing member financial data and actual transactions
  const ledger = useMemo(() => {
    const entries = [];
    let runningSavings = member.openingBalance || 0;
    let runningLoan = member.loanOutstanding || 0;
    let runningFD = member.fdTotal || 0;
    let runningInterest = member.loanOverdueInterest || 0;

    // Add opening balance entry if member is existing member
    if (member.isExistingMember) {
      const openingDate = member.joiningDate || memberDoc?.createdAt || new Date();

      // Opening Saving entry
      if (member.openingBalance > 0) {
        entries.push({
          date: openingDate,
          receipt: "Opening",
          savingsDeposit: member.openingBalance,
          savingsWithdraw: 0,
          savingsBalance: runningSavings,
          loanPaid: 0,
          loanRecovered: 0,
          loanBalance: runningLoan,
          fdDeposit: member.fdTotal,
          fdWithdraw: 0,
          fdBalance: runningFD,
          interestDue: member.loanOverdueInterest,
          interestPaid: 0,
        });
      }

      // FD entry (if different date from opening)
      if (member.fdTotal > 0 && member.fdDate && member.fdDate !== openingDate) {
        entries.push({
          date: member.fdDate,
          receipt: "FD Opening",
          savingsDeposit: 0,
          savingsWithdraw: 0,
          savingsBalance: runningSavings,
          loanPaid: 0,
          loanRecovered: 0,
          loanBalance: runningLoan,
          fdDeposit: member.fdTotal,
          fdWithdraw: 0,
          fdBalance: runningFD,
          interestDue: runningInterest,
          interestPaid: 0,
        });
      }

      // Loan entry (if different date from opening)
      if (member.loanOutstanding > 0 && member.loanDate && member.loanDate !== openingDate) {
        entries.push({
          date: member.loanDate,
          receipt: "Loan Taken",
          savingsDeposit: 0,
          savingsWithdraw: 0,
          savingsBalance: runningSavings,
          loanPaid: 0,
          loanRecovered: 0,
          loanBalance: runningLoan,
          fdDeposit: 0,
          fdWithdraw: 0,
          fdBalance: runningFD,
          interestDue: runningInterest,
          interestPaid: 0,
        });
      }
    }

    // Add actual loan transactions
    memberLoans.forEach((loan) => {
      const loanDate = loan.date || loan.createdAt;
      const amount = parseFloat(loan.amount || 0);

      if (loan.transactionType === "Loan") {
        runningLoan += amount;
        entries.push({
          date: loanDate,
          receipt: `Loan - ${loan.purpose || "N/A"}`,
          savingsDeposit: 0,
          savingsWithdraw: 0,
          savingsBalance: runningSavings,
          loanPaid: 0,
          loanRecovered: 0,
          loanBalance: runningLoan,
          fdDeposit: 0,
          fdWithdraw: 0,
          fdBalance: runningFD,
          interestDue: runningInterest,
          interestPaid: 0,
        });
      } else if (loan.transactionType === "FD") {
        runningFD += amount;
        entries.push({
          date: loanDate,
          receipt: `FD - ${loan.purpose || "N/A"}`,
          savingsDeposit: 0,
          savingsWithdraw: 0,
          savingsBalance: runningSavings,
          loanPaid: 0,
          loanRecovered: 0,
          loanBalance: runningLoan,
          fdDeposit: amount,
          fdWithdraw: 0,
          fdBalance: runningFD,
          interestDue: runningInterest,
          interestPaid: 0,
        });
      } else if (loan.transactionType === "Saving") {
        runningSavings += amount;
        entries.push({
          date: loanDate,
          receipt: `Saving - ${loan.purpose || "N/A"}`,
          savingsDeposit: amount,
          savingsWithdraw: 0,
          savingsBalance: runningSavings,
          loanPaid: 0,
          loanRecovered: 0,
          loanBalance: runningLoan,
          fdDeposit: 0,
          fdWithdraw: 0,
          fdBalance: runningFD,
          interestDue: runningInterest,
          interestPaid: 0,
        });
      }
    });

    // Add recovery transactions
    memberRecoveries.forEach((recovery) => {
      const recoveryDate = recovery.recoveryDate || recovery.date;
      const amounts = recovery.amounts || {};
      const saving = parseFloat(amounts.saving || 0);
      const loan = parseFloat(amounts.loan || 0);
      const fd = parseFloat(amounts.fd || 0);
      const interest = parseFloat(amounts.interest || 0);
      const yogdan = parseFloat(amounts.yogdan || 0);
      const other = parseFloat(amounts.other || 0);

      runningSavings += saving;
      runningLoan = Math.max(0, runningLoan - loan);
      runningFD += fd;
      runningInterest = Math.max(0, runningInterest - interest);

      entries.push({
        date: recoveryDate,
        receipt: "Recovery",
        savingsDeposit: saving,
        savingsWithdraw: 0,
        savingsBalance: runningSavings,
        loanPaid: loan,
        loanRecovered: loan,
        loanBalance: runningLoan,
        fdDeposit: fd,
        fdWithdraw: 0,
        fdBalance: runningFD,
        interestDue: runningInterest + interest,
        interestPaid: interest,
      });
    });

    // Sort by date
    return entries.sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [member, memberDoc, memberLoans, memberRecoveries]);

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
      ["SSSMID", member.sssmid || "N/A"],
      ["Village", member.village],
      ["Date of Joining", formatDate(member.joiningDate)],
      ["Opening Balance", `₹${member.openingBalance.toLocaleString()}`],
      ["Savings Total", `₹${member.savingsTotal.toLocaleString()}`],
      ["Loan Outstanding", `₹${member.loanOutstanding.toLocaleString()}`],
      ...(member.loanDate ? [["Loan Date", formatDate(member.loanDate)]] : []),
      ...(member.loanOverdueInterest > 0 ? [["Overdue Interest", `₹${member.loanOverdueInterest.toLocaleString()}`]] : []),
      ["FD Total", `₹${member.fdTotal.toLocaleString()}`],
      ...(member.fdDate ? [["FD Date", formatDate(member.fdDate)]] : []),
      ...(member.fdMaturityDate ? [["FD Maturity Date", formatDate(member.fdMaturityDate)]] : []),
      ...(member.fdInterest > 0 ? [["FD Interest", `₹${member.fdInterest.toLocaleString()}`]] : []),
      ...(member.openingYogdan > 0 ? [["Opening Yogdan", `₹${member.openingYogdan.toLocaleString()}`]] : []),
      ["Interest Pending", `₹${member.interestPending.toLocaleString()}`],
      ["Last Recovery", formatDate(member.lastRecoveryDate) || "N/A"],
    ].filter(row => row !== null);

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

    doc.text(`Opening Balance: ₹${member.openingBalance.toLocaleString()}`, 14, yPos);
    yPos += lineHeight;
    doc.text(`Savings Total: ₹${member.savingsTotal.toLocaleString()}`, 14, yPos);
    yPos += lineHeight;
    doc.text(`Loan Outstanding: ₹${member.loanOutstanding.toLocaleString()}`, 14, yPos);
    if (member.loanDate) {
      yPos += lineHeight;
      doc.text(`Loan Date: ${formatDate(member.loanDate)}`, 14, yPos);
    }
    if (member.loanOverdueInterest > 0) {
      yPos += lineHeight;
      doc.text(`Overdue Interest: ₹${member.loanOverdueInterest.toLocaleString()}`, 14, yPos);
    }
    yPos += lineHeight;
    doc.text(`FD Total: ₹${member.fdTotal.toLocaleString()}`, 14, yPos);
    if (member.fdDate) {
      yPos += lineHeight;
      doc.text(`FD Date: ${formatDate(member.fdDate)}`, 14, yPos);
    }
    if (member.fdMaturityDate) {
      yPos += lineHeight;
      doc.text(`FD Maturity Date: ${formatDate(member.fdMaturityDate)}`, 14, yPos);
    }
    if (member.fdInterest > 0) {
      yPos += lineHeight;
      doc.text(`FD Interest: ₹${member.fdInterest.toLocaleString()}`, 14, yPos);
    }
    if (member.openingYogdan > 0) {
      yPos += lineHeight;
      doc.text(`Opening Yogdan: ₹${member.openingYogdan.toLocaleString()}`, 14, yPos);
    }
    yPos += lineHeight;
    doc.text(`Interest Pending: ₹${member.interestPending.toLocaleString()}`, 14, yPos);
    yPos += lineHeight;
    doc.text(`Last Recovery: ${formatDate(member.lastRecoveryDate) || "N/A"}`, 14, yPos);
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

      {/* Full Member Details */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <User size={24} />
          Complete Member Details
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50 w-1/3">Member Code:</td>
                <td className="p-3 text-gray-800">{memberDoc?.Member_Id || "-"}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Member Name:</td>
                <td className="p-3 text-gray-800">{memberDoc?.Member_Nm || "-"}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Member Date:</td>
                <td className="p-3 text-gray-800">{formatDate(memberDoc?.Member_Dt) || "-"}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Date of Joining:</td>
                <td className="p-3 text-gray-800">{formatDate(memberDoc?.Dt_Join) || "-"}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Father/Husband Name:</td>
                <td className="p-3 text-gray-800">{memberDoc?.F_H_Name || "-"}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Father's Father Name:</td>
                <td className="p-3 text-gray-800">{memberDoc?.F_H_FatherName || "-"}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Voter ID:</td>
                <td className="p-3 text-gray-800">{memberDoc?.Voter_Id || "-"}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Aadhar Number:</td>
                <td className="p-3 text-gray-800">{memberDoc?.Adhar_Id || "-"}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Ration Card Number:</td>
                <td className="p-3 text-gray-800">{memberDoc?.Ration_Card || "-"}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Job Card Number:</td>
                <td className="p-3 text-gray-800">{memberDoc?.Job_Card || "-"}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">APL/BPL:</td>
                <td className="p-3 text-gray-800">{memberDoc?.Apl_Bpl_Etc || "-"}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Designation:</td>
                <td className="p-3 text-gray-800">{memberDoc?.Desg || "-"}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Bank Name:</td>
                <td className="p-3 text-gray-800">{memberDoc?.Bank_Name || "-"}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Branch Name:</td>
                <td className="p-3 text-gray-800">{memberDoc?.Br_Name || "-"}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Bank Account:</td>
                <td className="p-3 text-gray-800">{memberDoc?.Bank_Ac || "-"}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">IFSC Code:</td>
                <td className="p-3 text-gray-800">{memberDoc?.Ifsc_No || "-"}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Age:</td>
                <td className="p-3 text-gray-800">{memberDoc?.Age || "-"}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Education Qualification:</td>
                <td className="p-3 text-gray-800">{memberDoc?.Edu_Qual || "-"}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Annual Income:</td>
                <td className="p-3 text-gray-800">{memberDoc?.Anual_Income ? `₹${memberDoc.Anual_Income.toLocaleString()}` : "-"}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Profession:</td>
                <td className="p-3 text-gray-800">{memberDoc?.Profession || "-"}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Caste:</td>
                <td className="p-3 text-gray-800">{memberDoc?.Caste || "-"}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Religion:</td>
                <td className="p-3 text-gray-800">{memberDoc?.Religion || "-"}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Mobile Number:</td>
                <td className="p-3 text-gray-800">{memberDoc?.cell_phone || "-"}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Date of Birth:</td>
                <td className="p-3 text-gray-800">{formatDate(memberDoc?.dt_birth) || "-"}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Nominee 1:</td>
                <td className="p-3 text-gray-800">{memberDoc?.nominee_1 || "-"}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Nominee 2:</td>
                <td className="p-3 text-gray-800">{memberDoc?.nominee_2 || "-"}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Address Line 1:</td>
                <td className="p-3 text-gray-800">{memberDoc?.res_add1 || "-"}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Address Line 2:</td>
                <td className="p-3 text-gray-800">{memberDoc?.res_add2 || "-"}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Village:</td>
                <td className="p-3 text-gray-800">{memberDoc?.Village || "-"}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Group Name:</td>
                <td className="p-3 text-gray-800">{memberDoc?.Group_Name || "-"}</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Registration Date:</td>
                <td className="p-3 text-gray-800">{formatDate(memberDoc?.createdAt) || "-"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Identity Documents with Images */}
      {(memberDoc?.Voter_Id_File || memberDoc?.Adhar_Id_File || memberDoc?.Ration_Card_File || memberDoc?.Job_Card_File) && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <IdCard size={24} />
            Identity Documents
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {memberDoc?.Voter_Id_File && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-700 mb-2">Voter ID Document</h3>
                <p className="text-sm text-gray-600 mb-3">Voter ID: {memberDoc?.Voter_Id || "-"}</p>
                <div className="relative">
                  {imageErrors[memberDoc.Voter_Id_File] ? (
                    <div className="flex items-center justify-center bg-gray-100 rounded-lg h-48">
                      <div className="text-center">
                        <ImageIcon size={48} className="mx-auto text-gray-400 mb-2" />
                        <p className="text-gray-500 text-sm">Image not available</p>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={getImageUrl(memberDoc.Voter_Id_File)}
                      alt="Voter ID Document"
                      className="w-full h-auto rounded-lg border border-gray-300 cursor-pointer hover:opacity-90 transition-opacity"
                      onError={() => handleImageError(memberDoc.Voter_Id_File)}
                    />
                  )}
                  {!imageErrors[memberDoc.Voter_Id_File] && (
                    <a
                      href={getImageUrl(memberDoc.Voter_Id_File)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      <ImageIcon size={16} />
                      View Full Size
                    </a>
                  )}
                </div>
              </div>
            )}

            {memberDoc?.Adhar_Id_File && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-700 mb-2">Aadhar Document</h3>
                <p className="text-sm text-gray-600 mb-3">Aadhar Number: {memberDoc?.Adhar_Id || "-"}</p>
                <div className="relative">
                  {imageErrors[memberDoc.Adhar_Id_File] ? (
                    <div className="flex items-center justify-center bg-gray-100 rounded-lg h-48">
                      <div className="text-center">
                        <ImageIcon size={48} className="mx-auto text-gray-400 mb-2" />
                        <p className="text-gray-500 text-sm">Image not available</p>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={getImageUrl(memberDoc.Adhar_Id_File)}
                      alt="Aadhar Document"
                      className="w-full h-auto rounded-lg border border-gray-300 cursor-pointer hover:opacity-90 transition-opacity"
                      onError={() => handleImageError(memberDoc.Adhar_Id_File)}
                    />
                  )}
                  {!imageErrors[memberDoc.Adhar_Id_File] && (
                    <a
                      href={getImageUrl(memberDoc.Adhar_Id_File)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      <ImageIcon size={16} />
                      View Full Size
                    </a>
                  )}
                </div>
              </div>
            )}

            {memberDoc?.Ration_Card_File && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-700 mb-2">Ration Card Document</h3>
                <p className="text-sm text-gray-600 mb-3">Ration Card Number: {memberDoc?.Ration_Card || "-"}</p>
                <div className="relative">
                  {imageErrors[memberDoc.Ration_Card_File] ? (
                    <div className="flex items-center justify-center bg-gray-100 rounded-lg h-48">
                      <div className="text-center">
                        <ImageIcon size={48} className="mx-auto text-gray-400 mb-2" />
                        <p className="text-gray-500 text-sm">Image not available</p>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={getImageUrl(memberDoc.Ration_Card_File)}
                      alt="Ration Card Document"
                      className="w-full h-auto rounded-lg border border-gray-300 cursor-pointer hover:opacity-90 transition-opacity"
                      onError={() => handleImageError(memberDoc.Ration_Card_File)}
                    />
                  )}
                  {!imageErrors[memberDoc.Ration_Card_File] && (
                    <a
                      href={getImageUrl(memberDoc.Ration_Card_File)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      <ImageIcon size={16} />
                      View Full Size
                    </a>
                  )}
                </div>
              </div>
            )}

            {memberDoc?.Job_Card_File && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-700 mb-2">Job Card Document</h3>
                <p className="text-sm text-gray-600 mb-3">Job Card Number: {memberDoc?.Job_Card || "-"}</p>
                <div className="relative">
                  {imageErrors[memberDoc.Job_Card_File] ? (
                    <div className="flex items-center justify-center bg-gray-100 rounded-lg h-48">
                      <div className="text-center">
                        <ImageIcon size={48} className="mx-auto text-gray-400 mb-2" />
                        <p className="text-gray-500 text-sm">Image not available</p>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={getImageUrl(memberDoc.Job_Card_File)}
                      alt="Job Card Document"
                      className="w-full h-auto rounded-lg border border-gray-300 cursor-pointer hover:opacity-90 transition-opacity"
                      onError={() => handleImageError(memberDoc.Job_Card_File)}
                    />
                  )}
                  {!imageErrors[memberDoc.Job_Card_File] && (
                    <a
                      href={getImageUrl(memberDoc.Job_Card_File)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      <ImageIcon size={16} />
                      View Full Size
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Financial Summary */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Financial Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50 w-1/3">Opening Balance:</td>
                <td className="p-3 text-gray-800">₹{member.openingBalance.toLocaleString()}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Savings Total:</td>
                <td className="p-3 text-gray-800">₹{member.savingsTotal.toLocaleString()}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Loan Outstanding:</td>
                <td className="p-3 text-gray-800">₹{member.loanOutstanding.toLocaleString()}</td>
              </tr>
              {member.loanDate && (
                <tr className="border-b border-gray-200">
                  <td className="p-3 font-semibold text-gray-700 bg-gray-50">Loan Date:</td>
                  <td className="p-3 text-gray-800">{formatDate(member.loanDate)}</td>
                </tr>
              )}
              {member.loanOverdueInterest > 0 && (
                <tr className="border-b border-gray-200">
                  <td className="p-3 font-semibold text-gray-700 bg-gray-50">Overdue Interest:</td>
                  <td className="p-3 text-gray-800">₹{member.loanOverdueInterest.toLocaleString()}</td>
                </tr>
              )}
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">FD Total:</td>
                <td className="p-3 text-gray-800">₹{member.fdTotal.toLocaleString()}</td>
              </tr>
              {member.fdDate && (
                <tr className="border-b border-gray-200">
                  <td className="p-3 font-semibold text-gray-700 bg-gray-50">FD Date:</td>
                  <td className="p-3 text-gray-800">{formatDate(member.fdDate)}</td>
                </tr>
              )}
              {member.fdMaturityDate && (
                <tr className="border-b border-gray-200">
                  <td className="p-3 font-semibold text-gray-700 bg-gray-50">FD Maturity Date:</td>
                  <td className="p-3 text-gray-800">{formatDate(member.fdMaturityDate)}</td>
                </tr>
              )}
              {member.fdInterest > 0 && (
                <tr className="border-b border-gray-200">
                  <td className="p-3 font-semibold text-gray-700 bg-gray-50">FD Interest:</td>
                  <td className="p-3 text-gray-800">₹{member.fdInterest.toLocaleString()}</td>
                </tr>
              )}
              {member.openingYogdan > 0 && (
                <tr className="border-b border-gray-200">
                  <td className="p-3 font-semibold text-gray-700 bg-gray-50">Opening Yogdan:</td>
                  <td className="p-3 text-gray-800">₹{member.openingYogdan.toLocaleString()}</td>
                </tr>
              )}
              <tr className="border-b border-gray-200">
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Interest Pending:</td>
                <td className="p-3 text-gray-800">₹{member.interestPending.toLocaleString()}</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-gray-700 bg-gray-50">Last Recovery:</td>
                <td className="p-3 text-gray-800">{formatDate(member.lastRecoveryDate) || "N/A"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Existing Member Financial Details Section */}
      {member.isExistingMember && (
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Existing Member Financial Details</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <tbody>
                <tr className="border-b border-blue-200">
                  <td className="p-3 font-semibold text-gray-700 bg-blue-100 w-1/3">Opening Saving:</td>
                  <td className="p-3 text-gray-800">₹{member.openingBalance.toLocaleString()}</td>
                </tr>
                {member.fdTotal > 0 && (
                  <>
                    <tr className="border-b border-blue-200">
                      <td className="p-3 font-semibold text-gray-700 bg-blue-100">FD Amount:</td>
                      <td className="p-3 text-gray-800">₹{member.fdTotal.toLocaleString()}</td>
                    </tr>
                    {member.fdDate && (
                      <tr className="border-b border-blue-200">
                        <td className="p-3 font-semibold text-gray-700 bg-blue-100">FD Date:</td>
                        <td className="p-3 text-gray-800">{formatDate(member.fdDate)}</td>
                      </tr>
                    )}
                    {member.fdMaturityDate && (
                      <tr className="border-b border-blue-200">
                        <td className="p-3 font-semibold text-gray-700 bg-blue-100">FD Maturity Date:</td>
                        <td className="p-3 text-gray-800">{formatDate(member.fdMaturityDate)}</td>
                      </tr>
                    )}
                    {member.fdInterest > 0 && (
                      <tr className="border-b border-blue-200">
                        <td className="p-3 font-semibold text-gray-700 bg-blue-100">FD Interest:</td>
                        <td className="p-3 text-gray-800">₹{member.fdInterest.toLocaleString()}</td>
                      </tr>
                    )}
                  </>
                )}
                {member.loanOutstanding > 0 && (
                  <>
                    <tr className="border-b border-blue-200">
                      <td className="p-3 font-semibold text-gray-700 bg-blue-100">Loan Amount:</td>
                      <td className="p-3 text-gray-800">₹{member.loanOutstanding.toLocaleString()}</td>
                    </tr>
                    {member.loanDate && (
                      <tr className="border-b border-blue-200">
                        <td className="p-3 font-semibold text-gray-700 bg-blue-100">Loan Date:</td>
                        <td className="p-3 text-gray-800">{formatDate(member.loanDate)}</td>
                      </tr>
                    )}
                    {member.loanOverdueInterest > 0 && (
                      <tr className="border-b border-blue-200">
                        <td className="p-3 font-semibold text-gray-700 bg-blue-100">Overdue Interest:</td>
                        <td className="p-3 text-gray-800">₹{member.loanOverdueInterest.toLocaleString()}</td>
                      </tr>
                    )}
                  </>
                )}
                {member.openingYogdan > 0 && (
                  <tr>
                    <td className="p-3 font-semibold text-gray-700 bg-blue-100">Opening Yogdan:</td>
                    <td className="p-3 text-gray-800">₹{member.openingYogdan.toLocaleString()}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

      {/* Loan/Transaction Details Table */}
      {memberLoans.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <DollarSign size={24} className="text-green-600" />
            Loan & Transaction Details ({memberLoans.length})
          </h2>
          {transactionsLoading ? (
            <p className="text-gray-600">Loading transactions...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 p-3 text-left font-semibold">Date</th>
                    <th className="border border-gray-300 p-3 text-left font-semibold">Transaction Type</th>
                    <th className="border border-gray-300 p-3 text-left font-semibold">Purpose</th>
                    <th className="border border-gray-300 p-3 text-right font-semibold">Amount</th>
                    <th className="border border-gray-300 p-3 text-left font-semibold">Payment Mode</th>
                    <th className="border border-gray-300 p-3 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {memberLoans.map((loan, index) => (
                    <tr key={loan._id || index} className="hover:bg-gray-50">
                      <td className="border border-gray-300 p-3">
                        {formatDate(loan.date || loan.createdAt)}
                      </td>
                      <td className="border border-gray-300 p-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${loan.transactionType === "Loan"
                            ? "bg-red-100 text-red-800"
                            : loan.transactionType === "FD"
                              ? "bg-blue-100 text-blue-800"
                              : loan.transactionType === "Saving"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                        >
                          {loan.transactionType || "N/A"}
                        </span>
                      </td>
                      <td className="border border-gray-300 p-3">{loan.purpose || "N/A"}</td>
                      <td className="border border-gray-300 p-3 text-right font-semibold">
                        ₹{parseFloat(loan.amount || 0).toLocaleString()}
                      </td>
                      <td className="border border-gray-300 p-3">{loan.paymentMode || "N/A"}</td>
                      <td className="border border-gray-300 p-3">
                        <span
                          className={`px-2 py-1 rounded text-xs ${loan.status === "approved"
                            ? "bg-green-100 text-green-800"
                            : loan.status === "rejected"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                            }`}
                        >
                          {loan.status || "Pending"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Recovery Details Table */}
      {memberRecoveries.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FileText size={24} className="text-blue-600" />
            Recovery Details ({memberRecoveries.length})
          </h2>
          {transactionsLoading ? (
            <p className="text-gray-600">Loading recoveries...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 p-3 text-left font-semibold">Date</th>
                    <th className="border border-gray-300 p-3 text-right font-semibold">Savings</th>
                    <th className="border border-gray-300 p-3 text-right font-semibold">Loan</th>
                    <th className="border border-gray-300 p-3 text-right font-semibold">FD</th>
                    <th className="border border-gray-300 p-3 text-right font-semibold">Interest</th>
                    <th className="border border-gray-300 p-3 text-right font-semibold">Yogdan</th>
                    <th className="border border-gray-300 p-3 text-right font-semibold">Other</th>
                    <th className="border border-gray-300 p-3 text-right font-semibold">Total</th>
                    <th className="border border-gray-300 p-3 text-left font-semibold">Payment Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {memberRecoveries.map((recovery, index) => {
                    const amounts = recovery.amounts || {};
                    const saving = parseFloat(amounts.saving || 0);
                    const loan = parseFloat(amounts.loan || 0);
                    const fd = parseFloat(amounts.fd || 0);
                    const interest = parseFloat(amounts.interest || 0);
                    const yogdan = parseFloat(amounts.yogdan || 0);
                    const other = parseFloat(amounts.other || 0);
                    const total = saving + loan + fd + interest + yogdan + other;
                    const mode = recovery.paymentMode?.cash && recovery.paymentMode?.online
                      ? "Cash & Online"
                      : recovery.paymentMode?.cash
                        ? "Cash"
                        : recovery.paymentMode?.online
                          ? "Online"
                          : "N/A";

                    return (
                      <tr key={recovery.recoveryId || index} className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-3">
                          {formatDate(recovery.recoveryDate || recovery.date)}
                        </td>
                        <td className="border border-gray-300 p-3 text-right">₹{saving.toLocaleString()}</td>
                        <td className="border border-gray-300 p-3 text-right">₹{loan.toLocaleString()}</td>
                        <td className="border border-gray-300 p-3 text-right">₹{fd.toLocaleString()}</td>
                        <td className="border border-gray-300 p-3 text-right">₹{interest.toLocaleString()}</td>
                        <td className="border border-gray-300 p-3 text-right">₹{yogdan.toLocaleString()}</td>
                        <td className="border border-gray-300 p-3 text-right">₹{other.toLocaleString()}</td>
                        <td className="border border-gray-300 p-3 text-right font-semibold text-green-700">
                          ₹{total.toLocaleString()}
                        </td>
                        <td className="border border-gray-300 p-3">
                          <span
                            className={`px-2 py-1 rounded text-xs ${mode === "Cash"
                              ? "bg-green-100 text-green-800"
                              : mode === "Online"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-purple-100 text-purple-800"
                              }`}
                          >
                            {mode}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Transaction Table */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Financial Ledger</h2>
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
