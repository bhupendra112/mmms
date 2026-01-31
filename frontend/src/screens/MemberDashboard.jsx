import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { DollarSign } from "lucide-react";
import { exportToExcel, exportToPDF, exportMemberLedgerToExcel, exportMemberLedgerToPDF } from "../utils/exportUtils";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import {
  getMemberDetail,
  exportMemberLedger,
  getMemberFinancialLedger,
} from "../services/memberService";
import {
  getMemberDetail as getMemberDetailOffline,
  getMemberFinancialLedger as getMemberFinancialLedgerOffline,
} from "../services/memberServiceOffline";
import { getLoans } from "../services/loanService";
import { getRecoveries } from "../services/recoveryService";
import { getFDsByMember } from "../services/fdService";
import { getPayments } from "../services/paymentService";

import CreateFD from "../components/fd/CreateFD";
import { formatDate, formatCurrency } from "../utils/memberUtils";

import MemberDashboardHeader from "../components/member/MemberDashboardHeader";
import MemberDashboardActions from "../components/member/MemberDashboardActions";
import MemberPhoto from "../components/member/MemberPhoto";
import MemberDetails from "../components/member/MemberDetails";
import MemberIdentityDocuments from "../components/member/MemberIdentityDocuments";
import FinancialSummary from "../components/member/FinancialSummary";
import MembershipFeesSummary from "../components/member/MembershipFeesSummary";
import ExistingMemberFinancialDetails from "../components/member/ExistingMemberFinancialDetails";
import RecoveryDetails from "../components/member/RecoveryDetails";
import FinancialLedger from "../components/member/FinancialLedger";

export default function MemberDashboard() {
  const { id } = useParams();
  const { pathname } = useLocation();
  const isGroupRoute = pathname.startsWith("/group");

  const [loading, setLoading] = useState(false);
  const [memberDoc, setMemberDoc] = useState(null);
  const [loadError, setLoadError] = useState("");

  const [memberLoans, setMemberLoans] = useState([]);
  const [memberRecoveries, setMemberRecoveries] = useState([]);
  const [memberFDs, setMemberFDs] = useState([]);
  const [memberPayments, setMemberPayments] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  const [imageErrors, setImageErrors] = useState({});
  const [ledgerData, setLedgerData] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState("");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showCreateFD, setShowCreateFD] = useState(false);

  // ✅ mobile detection
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== "undefined") return window.innerWidth < 640;
    return false;
  });
  const windowWidthRef = useRef(typeof window !== "undefined" ? window.innerWidth : 1280);

  const handleImageError = (imagePath) => {
    setImageErrors((prev) => ({ ...prev, [imagePath]: true }));
  };

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setLoadError("");

    const fetchDetail = isGroupRoute ? getMemberDetailOffline : getMemberDetail;
    fetchDetail(id)
      .then((res) => {
        setMemberDoc(res?.data || null);

        if (res?.data) {
          loadMemberTransactions(res.data);
          loadFinancialLedger(id, fromDate, toDate);
        }
      })
      .catch((e) => {
        console.error("Failed to load member detail:", e);
        setMemberDoc(null);
        setLoadError(String(e || "Failed to load member"));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isGroupRoute]);

  // reload ledger when filters change
  useEffect(() => {
    if (id && memberDoc) loadFinancialLedger(id, fromDate, toDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  const loadFinancialLedger = async (memberId, from, to) => {
    if (!memberId) return;

    try {
      setLedgerLoading(true);
      setLedgerError("");

      const filters = {};
      if (from) filters.fromDate = from;
      if (to) filters.toDate = to;

      const fetchLedger = isGroupRoute ? getMemberFinancialLedgerOffline : getMemberFinancialLedger;
      const response = await fetchLedger(memberId, filters);

      const ledger = response?.success
        ? (Array.isArray(response.data) ? response.data : response?.data?.ledger || [])
        : [];
      setLedgerData(ledger);
    } catch (error) {
      console.error("[MEMBER_DASHBOARD] Error loading financial ledger:", error);
      setLedgerError(String(error || "Failed to load financial ledger"));
      setLedgerData([]);
    } finally {
      setLedgerLoading(false);
    }
  };

  const loadMemberTransactions = async (memberData) => {
    const groupId = memberData?.group_id || memberData?.group?._id || memberData?.group;
    if (!groupId) return;

    try {
      setTransactionsLoading(true);
      const memberId = memberData._id || id;
      const memberCode = memberData.Member_Id;

      const [loansRes, recoveriesRes, fdsRes, paymentsRes] = await Promise.all([
        getLoans(groupId).catch(() => ({ success: false, data: [] })),
        getRecoveries(groupId).catch(() => ({ success: false, data: [] })),
        getFDsByMember(memberId).catch(() => ({ success: false, data: [] })),
        getPayments({ memberId }).catch(() => ({ success: false, data: [] })),
      ]);

      // loans
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

      // recoveries
      const recoveries = recoveriesRes?.data || [];
      const filteredRecoveries = [];
      if (Array.isArray(recoveries)) {
        recoveries.forEach((recovery) => {
          if (Array.isArray(recovery?.recoveries)) {
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

      // fds
      const fds = fdsRes?.data || [];
      setMemberFDs(Array.isArray(fds) ? fds : []);

      // payments
      const payments = paymentsRes?.data || [];
      const filteredPayments = Array.isArray(payments)
        ? payments.filter(
          (payment) =>
            (payment.memberId === memberId ||
              payment.memberId === id ||
              payment.memberId?._id === memberId ||
              payment.memberId?._id === id) &&
            (payment.status === "approved" || payment.status === "completed")
        )
        : [];
      setMemberPayments(filteredPayments);
    } catch (error) {
      console.error("Error loading member transactions:", error);
    } finally {
      setTransactionsLoading(false);
    }
  };

  const member = useMemo(() => {
    const isExisting = memberDoc?.isExistingMember || false;
    const openingSaving = memberDoc?.openingSaving || 0;
    const fdDetails = memberDoc?.fdDetails || {};
    const loanDetails = memberDoc?.loanDetails || {};
    const openingYogdan = memberDoc?.openingYogdan || 0;

    let currentSavings = openingSaving;
    let currentLoan = loanDetails?.amount || 0;
    let currentFD = fdDetails?.amount || 0;
    let currentInterest = loanDetails?.overdueInterest || 0;
    let lastRecoveryDate = null;
    let totalPenaltyPaid = 0;

    memberRecoveries.forEach((recovery) => {
      const amounts = recovery.amounts || {};
      const savingAmt = parseFloat(amounts.saving || 0);
      const loanAmt = parseFloat(amounts.loan || 0);
      const fdAmt = parseFloat(amounts.fd || 0);
      const interestAmt = parseFloat(amounts.interest || 0);
      const penaltyAmt = parseFloat(amounts.penalty || 0);

      currentSavings += savingAmt;
      currentLoan = Math.max(0, currentLoan - loanAmt);
      currentFD += fdAmt;
      currentInterest = Math.max(0, currentInterest - interestAmt);
      totalPenaltyPaid += penaltyAmt;

      const recoveryDate = recovery.recoveryDate || recovery.date;
      if (recoveryDate) {
        const date = new Date(recoveryDate);
        if (!lastRecoveryDate || date > lastRecoveryDate) lastRecoveryDate = date;
      }
    });

    memberLoans.forEach((loan) => {
      if (loan.transactionType === "Saving") currentSavings += parseFloat(loan.amount || 0);
      else if (loan.transactionType === "Loan") currentLoan += parseFloat(loan.amount || 0);
      else if (loan.transactionType === "FD") currentFD += parseFloat(loan.amount || 0);
    });

    memberFDs.forEach((fd) => {
      currentFD += parseFloat(fd.amount || fd.principal || 0);
    });

    memberPayments.forEach((payment) => {
      const amount = parseFloat(payment.amount || 0);
      if (payment.paymentType === "saving_withdrawal") currentSavings = Math.max(0, currentSavings - amount);
      else if (payment.paymentType === "fd_maturity") currentFD = Math.max(0, currentFD - amount);
    });

    return {
      code: memberDoc?.Member_Id || "-",
      name: memberDoc?.Member_Nm || "-",
      fatherName: memberDoc?.F_H_Name || memberDoc?.F_H_FatherName || "-",
      village: memberDoc?.Village || "-",
      joiningDate: memberDoc?.Dt_Join || "",

      openingBalance: openingSaving,
      savingsTotal: currentSavings,
      loanOutstanding: currentLoan,
      loanDate: loanDetails?.loanDate || null,
      loanOverdueInterest: loanDetails?.overdueInterest || 0,
      fdTotal: currentFD,
      fdDate: fdDetails?.date || null,
      fdMaturityDate: fdDetails?.maturityDate || null,
      fdInterest: fdDetails?.interest || 0,
      interestPending: currentInterest,
      penaltyPaid: totalPenaltyPaid,
      openingYogdan,
      isExistingMember: isExisting,
      lastRecoveryDate,
    };
  }, [memberDoc, memberRecoveries, memberLoans, memberFDs, memberPayments]);

  const ledger = useMemo(() => ledgerData || [], [ledgerData]);

  const filterByDate = (data) => {
    if (!data?.length) return [];
    return data.filter((item) => {
      const itemDate = new Date(item.date);
      const from = fromDate ? new Date(fromDate) : null;
      const to = toDate ? new Date(toDate) : null;
      if (from && itemDate < from) return false;
      if (to && itemDate > to) return false;
      return true;
    });
  };

  const filteredLedger = useMemo(() => filterByDate(ledger), [ledger, fromDate, toDate]);

  const exportTableToExcel = () => {
    const data = filteredLedger.map((row) => {
      const chargesTotal = row.charges
        ? Object.values(row.charges).reduce((sum, amount) => sum + (parseFloat(amount) || 0), 0)
        : 0;

      const chargesDetails =
        row.charges && Object.keys(row.charges).length > 0
          ? Object.entries(row.charges)
            .filter(([_, amount]) => parseFloat(amount) > 0)
            .map(([name, amount]) => `${name}: ₹${parseFloat(amount).toLocaleString()}`)
            .join(", ")
          : "";

      return {
        Date: formatDate(row.date),
        Receipt: row.receipt,
        "Savings Deposit": row.savingsDeposit || 0,
        "Savings Withdraw": row.savingsWithdraw || 0,
        "Savings Balance": row.savingsBalance || 0,
        "Loan Paid": row.loanPaid || 0,
        "Loan Recovered": row.loanRecovered || 0,
        "Loan Balance": row.loanBalance || 0,
        "FD Deposit": row.fdDeposit || 0,
        "FD Withdraw": row.fdWithdraw || 0,
        "FD Balance": row.fdBalance || 0,
        "Interest Due": row.interestDue || 0,
        "Interest Paid": row.interestPaid || 0,
        "Yogdan Due": row.yogdanDue || 0,
        "Yogdan Paid": row.yogdanPaid || 0,
        "Charges Total": chargesTotal,
        "Charges Details": chargesDetails,
      };
    });

    exportToExcel(data, `Member_${member.code}_Transactions_${new Date().toISOString().split("T")[0]}`);
  };

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
      "Yogdan Due",
      "Yogdan Paid",
      "Charges Total",
      "Charges Details",
    ];

    const rows = filteredLedger.map((row) => {
      const chargesTotal = row.charges
        ? Object.values(row.charges).reduce((sum, amount) => sum + (parseFloat(amount) || 0), 0)
        : 0;

      const chargesDetails =
        row.charges && Object.keys(row.charges).length > 0
          ? Object.entries(row.charges)
            .filter(([_, amount]) => parseFloat(amount) > 0)
            .map(([name, amount]) => `${name}: ₹${parseFloat(amount).toLocaleString()}`)
            .join(", ")
          : "";

      return [
        formatDate(row.date),
        row.receipt?.toString?.() || "",
        `${row.savingsDeposit || 0}`,
        `${row.savingsWithdraw || 0}`,
        `${row.savingsBalance || 0}`,
        `${row.loanPaid || 0}`,
        `${row.loanRecovered || 0}`,
        `${row.loanBalance || 0}`,
        `${row.fdDeposit || 0}`,
        `${row.fdWithdraw || 0}`,
        `${row.fdBalance || 0}`,
        `${row.interestDue || 0}`,
        `${row.interestPaid || 0}`,
        `${row.yogdanDue || 0}`,
        `${row.yogdanPaid || 0}`,
        `${chargesTotal}`,
        chargesDetails || "",
      ];
    });

    exportToPDF(
      `${member.name} (${member.code}) - Transaction Report`,
      headers,
      rows,
      `Member_${member.code}_Transactions_${new Date().toISOString().split("T")[0]}`
    );
  };

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
      ...(member.loanOverdueInterest > 0
        ? [["Overdue Interest", `₹${member.loanOverdueInterest.toLocaleString()}`]]
        : []),
      ["FD Total", `₹${member.fdTotal.toLocaleString()}`],
      ...(member.fdDate ? [["FD Date", formatDate(member.fdDate)]] : []),
      ...(member.fdMaturityDate ? [["FD Maturity Date", formatDate(member.fdMaturityDate)]] : []),
      ...(member.fdInterest > 0 ? [["FD Interest", `₹${member.fdInterest.toLocaleString()}`]] : []),
      ...(member.openingYogdan > 0 ? [["Opening Yogdan", `₹${member.openingYogdan.toLocaleString()}`]] : []),
      ["Interest Pending", `₹${member.interestPending.toLocaleString()}`],
      ...(member.penaltyPaid > 0 ? [["Penalty Paid", `₹${member.penaltyPaid.toLocaleString()}`]] : []),
      ["Last Recovery", formatDate(member.lastRecoveryDate) || "N/A"],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Member Details");
    XLSX.writeFile(wb, `Member_${member.code}_Full_Details_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportFullDetailsToPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Member Dashboard - Full Details", 14, 20);

    doc.setFontSize(12);
    doc.text("Basic Details", 14, 35);
    doc.setFontSize(10);

    let yPos = 42;
    const lineHeight = 7;

    doc.text(`Member Code: ${member.code}`, 14, yPos); yPos += lineHeight;
    doc.text(`Name: ${member.name}`, 14, yPos); yPos += lineHeight;
    doc.text(`Father/Husband Name: ${member.fatherName}`, 14, yPos); yPos += lineHeight;
    doc.text(`SSSMID: ${member.sssmid || "N/A"}`, 14, yPos); yPos += lineHeight;
    doc.text(`Village: ${member.village}`, 14, yPos); yPos += lineHeight;
    doc.text(`Date of Joining: ${formatDate(member.joiningDate)}`, 14, yPos);
    yPos += lineHeight + 5;

    doc.setFontSize(12);
    doc.text("Financial Summary", 14, yPos);
    yPos += lineHeight;
    doc.setFontSize(10);

    doc.text(`Opening Balance: ${member.openingBalance.toLocaleString()}`, 14, yPos); yPos += lineHeight;
    doc.text(`Savings Total: ${member.savingsTotal.toLocaleString()}`, 14, yPos); yPos += lineHeight;
    doc.text(`Loan Outstanding: ${member.loanOutstanding.toLocaleString()}`, 14, yPos);

    if (member.loanDate) { yPos += lineHeight; doc.text(`Loan Date: ${formatDate(member.loanDate)}`, 14, yPos); }
    if (member.loanOverdueInterest > 0) { yPos += lineHeight; doc.text(`Overdue Interest: ${member.loanOverdueInterest.toLocaleString()}`, 14, yPos); }

    yPos += lineHeight;
    doc.text(`FD Total: ${member.fdTotal.toLocaleString()}`, 14, yPos);

    if (member.fdDate) { yPos += lineHeight; doc.text(`FD Date: ${formatDate(member.fdDate)}`, 14, yPos); }
    if (member.fdMaturityDate) { yPos += lineHeight; doc.text(`FD Maturity Date: ${formatDate(member.fdMaturityDate)}`, 14, yPos); }
    if (member.fdInterest > 0) { yPos += lineHeight; doc.text(`FD Interest: ${member.fdInterest.toLocaleString()}`, 14, yPos); }
    if (member.openingYogdan > 0) { yPos += lineHeight; doc.text(`Opening Yogdan: ${member.openingYogdan.toLocaleString()}`, 14, yPos); }

    yPos += lineHeight;
    doc.text(`Interest Pending: ${member.interestPending.toLocaleString()}`, 14, yPos);
    if (member.penaltyPaid > 0) {
      yPos += lineHeight;
      doc.text(`Penalty Paid: ${member.penaltyPaid.toLocaleString()}`, 14, yPos);
    }
    yPos += lineHeight;
    doc.text(`Last Recovery: ${formatDate(member.lastRecoveryDate) || "N/A"}`, 14, yPos);
    yPos += lineHeight + 10;

    if (filteredLedger.length > 0) {
      const headers = [
        "Date", "Receipt", "Sav Dep", "Sav Wd", "Sav Bal", "Loan Paid", "Loan Rec", "Loan Bal",
        "FD Dep", "FD Wd", "FD Bal", "Int Due", "Int Paid", "Yog Due", "Yog Paid", "Chg Tot", "Chg Details",
      ];

      const rows = filteredLedger.map((row) => {
        const chargesTotal = row.charges
          ? Object.values(row.charges).reduce((sum, amount) => sum + (parseFloat(amount) || 0), 0)
          : 0;

        const chargesDetails =
          row.charges && Object.keys(row.charges).length > 0
            ? Object.entries(row.charges)
              .filter(([_, amount]) => parseFloat(amount) > 0)
              .map(([name, amount]) => `${name}: ₹${parseFloat(amount).toLocaleString()}`)
              .join(", ")
            : "";

        return [
          formatDate(row.date),
          row.receipt?.toString?.() || "",
          `${row.savingsDeposit || 0}`,
          `${row.savingsWithdraw || 0}`,
          `${row.savingsBalance || 0}`,
          `${row.loanPaid || 0}`,
          `${row.loanRecovered || 0}`,
          `${row.loanBalance || 0}`,
          `${row.fdDeposit || 0}`,
          `${row.fdWithdraw || 0}`,
          `${row.fdBalance || 0}`,
          `${row.interestDue || 0}`,
          `${row.interestPaid || 0}`,
          `${row.yogdanDue || 0}`,
          `${row.yogdanPaid || 0}`,
          `${chargesTotal}`,
          chargesDetails || "",
        ];
      });

      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: yPos,
        styles: { fontSize: 7 },
        margin: { left: 10, right: 10 },
      });
    }

    doc.save(`Member_${member.code}_Full_Details_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const exportCompleteLedger = async (format = "excel") => {
    if (!id) return alert("Member ID is missing");

    try {
      setLoading(true);
      const filters = { memberId: id, fromDate: fromDate || undefined, toDate: toDate || undefined };
      const response = await exportMemberLedger(filters);

      if (response?.success && response?.data?.length > 0) {
        const memberData = response.data[0];
        const memberCode = memberData.memberInfo?.code || "Member";

        if (format === "excel") exportMemberLedgerToExcel([memberData], `Member_${memberCode}_Complete_Ledger`);
        else exportMemberLedgerToPDF([memberData], `Member_${memberCode}_Complete_Ledger`);
      } else {
        alert("No ledger data found to export");
      }
    } catch (error) {
      console.error("Error exporting complete ledger:", error);
      alert("Failed to export complete ledger. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const update = () => {
      const w = window.innerWidth;
      windowWidthRef.current = w;
      setIsMobile(w < 640);
    };

    update();

    let resizeTimeout;
    const onResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(update, 50);
    };

    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div className="member-dashboard-main w-full max-w-full overflow-x-hidden box-border">
      {/* ✅ OUTER PADDING (SAFE ON PHONE) */}
      <div className="w-full max-w-full min-w-0 overflow-x-hidden px-2 sm:px-4">
        {/* ✅ INNER WRAPPER: LEFT ALIGNED + CONTROL WIDTH (THIS FIXES YOUR ISSUE) */}
        <div className="w-full max-w-[380px] sm:max-w-[720px] md:max-w-[920px] lg:max-w-[1200px] mr-auto mx-0 min-w-0 flex flex-col gap-4">
          <MemberDashboardHeader member={member} />

          {loading && (
            <p className="text-sm md:text-base text-gray-600 mb-1">Loading member…</p>
          )}

          {!loading && loadError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 md:p-4">
              <p className="text-sm md:text-base text-red-700 font-semibold">Failed to load member</p>
              <p className="text-xs md:text-sm text-red-600 mt-1 break-words">{loadError}</p>
            </div>
          )}

          <MemberDashboardActions
            onCreateFD={() => setShowCreateFD(true)}
            onExportTableExcel={exportTableToExcel}
            onExportTablePDF={exportTableToPDF}
            onExportFullDetailsExcel={exportFullDetailsToExcel}
            onExportFullDetailsPDF={exportFullDetailsToPDF}
            onExportCompleteLedgerExcel={() => exportCompleteLedger("excel")}
            onExportCompleteLedgerPDF={() => exportCompleteLedger("pdf")}
          />

          {showCreateFD && memberDoc && (
            <CreateFD
              member={memberDoc}
              onClose={() => setShowCreateFD(false)}
              onSuccess={() => {
                if (!id) return;
                const fetchDetail = isGroupRoute ? getMemberDetailOffline : getMemberDetail;
                fetchDetail(id)
                  .then((res) => {
                    setMemberDoc(res?.data || null);
                    if (res?.data) loadMemberTransactions(res.data);
                  })
                  .catch((e) => console.error("Failed to reload member detail:", e));
              }}
            />
          )}

          {/* ✅ PHOTO (now will follow wrapper width => NOT huge on phone) */}
          <MemberPhoto
            photoPath={memberDoc?.Member_Photo}
            imageErrors={imageErrors}
            onImageError={handleImageError}
          />

          <MemberDetails memberDoc={memberDoc} formatDate={formatDate} />

          <MemberIdentityDocuments
            memberDoc={memberDoc}
            imageErrors={imageErrors}
            onImageError={handleImageError}
          />

          <FinancialSummary
            member={member}
            memberDoc={memberDoc}
            isMobile={isMobile}
            windowWidthRef={windowWidthRef}
            formatDate={formatDate}
          />

          <MembershipFeesSummary
            memberRecoveries={memberRecoveries}
            memberDoc={memberDoc}
            isMobile={isMobile}
            windowWidthRef={windowWidthRef}
            formatDate={formatDate}
          />

          <ExistingMemberFinancialDetails
            member={member}
            memberDoc={memberDoc}
            isMobile={isMobile}
            windowWidthRef={windowWidthRef}
            formatDate={formatDate}
          />

          {/* FD Details */}
          {memberFDs.length > 0 && (
            <div className="bg-green-50 border-l-4 border-green-500 rounded-lg shadow-sm p-3 sm:p-4 md:p-6 w-full min-w-0 overflow-x-hidden">
              <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 mb-2 sm:mb-3 md:mb-4 break-words">
                Fixed Deposit Details
              </h2>

              <div className="w-full overflow-x-auto rounded-lg border bg-white">
                <table className="min-w-[800px] w-full border-collapse text-xs md:text-sm">
                  <thead>
                    <tr className="bg-green-100">
                      <th className="p-2 md:p-3 text-left font-semibold text-gray-700 border-b border-green-200">Date</th>
                      <th className="p-2 md:p-3 text-left font-semibold text-gray-700 border-b border-green-200">Amount</th>
                      <th className="p-2 md:p-3 text-left font-semibold text-gray-700 border-b border-green-200">Time Period</th>
                      <th className="p-2 md:p-3 text-left font-semibold text-gray-700 border-b border-green-200">Maturity Date</th>
                      <th className="p-2 md:p-3 text-left font-semibold text-gray-700 border-b border-green-200">Interest</th>
                      <th className="p-2 md:p-3 text-left font-semibold text-gray-700 border-b border-green-200">Maturity Amount</th>
                      <th className="p-2 md:p-3 text-left font-semibold text-gray-700 border-b border-green-200">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberFDs.map((fd) => (
                      <tr key={fd._id} className="border-b border-green-200">
                        <td className="p-2 md:p-3 text-gray-800">{formatDate(fd.date)}</td>
                        <td className="p-2 md:p-3 text-gray-800">₹{parseFloat(fd.amount || 0).toLocaleString()}</td>
                        <td className="p-2 md:p-3 text-gray-800 break-words">
                          {fd.time_period ? (
                            <>
                              {fd.time_period / 12} {fd.time_period / 12 === 1 ? "year" : "years"} ({fd.time_period} months)
                            </>
                          ) : "-"}
                        </td>
                        <td className="p-2 md:p-3 text-gray-800">{formatDate(fd.maturityDate)}</td>
                        <td className="p-2 md:p-3 text-gray-800">₹{parseFloat(fd.interestAmount || 0).toLocaleString()}</td>
                        <td className="p-2 md:p-3 text-gray-800">₹{parseFloat(fd.maturityAmount || 0).toLocaleString()}</td>
                        <td className="p-2 md:p-3 text-gray-800">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${fd.status === "active"
                              ? "bg-green-200 text-green-800"
                              : fd.status === "matured"
                                ? "bg-yellow-200 text-yellow-800"
                                : "bg-gray-200 text-gray-800"
                              }`}
                          >
                            {fd.status || "active"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Loan/Transaction */}
          {memberLoans.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 md:p-6 w-full min-w-0 overflow-x-hidden">
              <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 mb-2 sm:mb-3 md:mb-4 flex flex-wrap items-center gap-2">
                <DollarSign size={18} className="sm:w-5 sm:h-5 text-green-600 shrink-0" />
                <span className="break-words">Loan & Transaction Details ({memberLoans.length})</span>
              </h2>

              {transactionsLoading ? (
                <p className="text-xs sm:text-sm md:text-base text-gray-600">Loading transactions...</p>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="block sm:hidden space-y-3">
                    {memberLoans.map((loan, index) => (
                      <div key={loan._id || index} className="bg-gray-50 border rounded-lg p-3 shadow-sm">
                        <div className="flex justify-between items-start mb-2 gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-gray-700 mb-1 break-words">
                              {formatDate(loan.date || loan.createdAt)}
                            </p>
                            <span
                              className={`inline-block px-2 py-1 rounded text-xs font-semibold ${loan.transactionType === "Loan"
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
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-gray-800">
                              ₹{parseFloat(loan.amount || 0).toLocaleString()}
                            </p>
                            <span
                              className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${loan.status === "verified"
                                ? "bg-green-100 text-green-800"
                                : loan.status === "pending"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-gray-100 text-gray-800"
                                }`}
                            >
                              {loan.status || "N/A"}
                            </span>
                          </div>
                        </div>

                        {loan.purpose && (
                          <p className="text-xs text-gray-600 mb-2 break-words">Purpose: {loan.purpose}</p>
                        )}

                        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                          <span className="text-xs text-gray-600 break-words">Mode: {loan.paymentMode || "N/A"}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden sm:block w-full overflow-x-auto rounded-lg border bg-white">
                    <table className="min-w-[800px] w-full border-collapse text-xs md:text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 p-2 md:p-3 text-left font-semibold">Date</th>
                          <th className="border border-gray-300 p-2 md:p-3 text-left font-semibold">Transaction Type</th>
                          <th className="border border-gray-300 p-2 md:p-3 text-left font-semibold">Purpose</th>
                          <th className="border border-gray-300 p-2 md:p-3 text-right font-semibold">Amount</th>
                          <th className="border border-gray-300 p-2 md:p-3 text-left font-semibold">Payment Mode</th>
                          <th className="border border-gray-300 p-2 md:p-3 text-left font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {memberLoans.map((loan, index) => (
                          <tr key={loan._id || index} className="hover:bg-gray-50">
                            <td className="border border-gray-300 p-2 md:p-3">{formatDate(loan.date || loan.createdAt)}</td>
                            <td className="border border-gray-300 p-2 md:p-3">
                              <span
                                className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${loan.transactionType === "Loan"
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
                            <td className="border border-gray-300 p-2 md:p-3 break-words">{loan.purpose || "N/A"}</td>
                            <td className="border border-gray-300 p-2 md:p-3 text-right font-semibold">
                              ₹{parseFloat(loan.amount || 0).toLocaleString()}
                            </td>
                            <td className="border border-gray-300 p-2 md:p-3 whitespace-nowrap">{loan.paymentMode || "N/A"}</td>
                            <td className="border border-gray-300 p-2 md:p-3">
                              <span
                                className={`px-2 py-1 rounded text-xs whitespace-nowrap ${loan.status === "approved"
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
                </>
              )}
            </div>
          )}

          <RecoveryDetails
            memberRecoveries={memberRecoveries}
            transactionsLoading={transactionsLoading}
            isMobile={isMobile}
            windowWidthRef={windowWidthRef}
            formatDate={formatDate}
          />

          <FinancialLedger
            ledgerData={ledgerData}
            filteredLedger={filteredLedger}
            fromDate={fromDate}
            toDate={toDate}
            onFromDateChange={setFromDate}
            onToDateChange={setToDate}
            ledgerLoading={ledgerLoading}
            ledgerError={ledgerError}
            formatDate={formatDate}
            formatCurrency={formatCurrency}
          />
        </div>
      </div>
    </div>
  );
}
