import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Download, FileText, Calendar, DollarSign, Image as ImageIcon, User, IdCard, Plus } from "lucide-react";
import { exportToExcel, exportToPDF } from "../utils/exportUtils";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getMemberDetail, exportMemberLedger, getMemberFinancialLedger } from "../services/memberService";
import { getLoans } from "../services/loanService";
import { getRecoveries } from "../services/recoveryService";
import { getFDsByMember } from "../services/fdService";
import { getPayments } from "../services/paymentService";
import { exportMemberLedgerToExcel, exportMemberLedgerToPDF } from "../utils/exportUtils";
import CreateFD from "../components/fd/CreateFD";

// Helper function to get full image URL
const getImageUrl = (imagePath) => {
  if (!imagePath) return null;

  // Get backend origin - extract only protocol://host:port (no API paths)
  const rawBaseURL = import.meta.env.VITE_BASE_URL || (import.meta.env.PROD ? "https://api.mmms.online" : "http://localhost:8080");

  let baseURL;
  try {
    // Try to parse as URL and extract origin (protocol://host:port)
    const url = new URL(rawBaseURL);
    baseURL = `${url.protocol}//${url.host}`; // Gets protocol://host:port
  } catch {
    // If parsing fails, extract origin manually
    const match = rawBaseURL.match(/^(https?:\/\/[^/]+)/i);
    baseURL = match ? match[1] : (import.meta.env.PROD ? "https://api.mmms.online" : "http://localhost:8080");
  }

  // Ensure imagePath starts with /
  const cleanImagePath = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
  const fullUrl = `${baseURL}${cleanImagePath}`;

  return fullUrl;
};

// Helper function to format currency values (round to 2 decimal places and format)
const formatCurrency = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return 0;
  // Round to 2 decimal places
  const rounded = Math.round(numValue * 100) / 100;
  return rounded;
};

export default function MemberDashboard() {
  const { id } = useParams();
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
          loadFinancialLedger();
        }
      })
      .catch((e) => {
        console.error("Failed to load member detail:", e);
        setMemberDoc(null);
        setLoadError(String(e || "Failed to load member"));
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Load financial ledger when date filters change
  useEffect(() => {
    if (id && memberDoc) {
      loadFinancialLedger();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  const loadFinancialLedger = async () => {
    if (!id) return;

    try {
      setLedgerLoading(true);
      setLedgerError("");
      const filters = {};
      if (fromDate) filters.fromDate = fromDate;
      if (toDate) filters.toDate = toDate;

      console.log('[MEMBER_DASHBOARD] Loading financial ledger', {
        memberId: id,
        filters
      });

      const response = await getMemberFinancialLedger(id, filters);
      console.log('[MEMBER_DASHBOARD] Financial ledger response', {
        success: response?.success,
        ledgerCount: response?.data?.ledger?.length || 0,
        summary: response?.data?.summary
      });

      if (response?.success && response?.data?.ledger) {
        const ledgerEntries = response.data.ledger || [];
        console.log('[MEMBER_DASHBOARD] ===== FINANCIAL LEDGER DATA RECEIVED =====');
        console.log('[MEMBER_DASHBOARD] Entry count:', ledgerEntries.length);
        console.log('[MEMBER_DASHBOARD] Full ledger entries:', ledgerEntries);
        console.log('[MEMBER_DASHBOARD] YogdanDue values:', ledgerEntries.map(e => ({
          date: e.date,
          receipt: e.receipt,
          yogdanDue: e.yogdanDue,
          yogdanDueType: typeof e.yogdanDue,
          yogdanPaid: e.yogdanPaid,
          yogdanPaidType: typeof e.yogdanPaid
        })));
        console.log('[MEMBER_DASHBOARD] Summary:', response.data.summary);
        setLedgerData(ledgerEntries);
      } else {
        console.log('[MEMBER_DASHBOARD] No ledger data in response', {
          response: response,
          success: response?.success,
          hasData: !!response?.data,
          hasLedger: !!response?.data?.ledger
        });
        setLedgerData([]);
      }
    } catch (error) {
      console.error('[MEMBER_DASHBOARD] Error loading financial ledger:', error);
      setLedgerError(String(error || "Failed to load financial ledger"));
      setLedgerData([]);
    } finally {
      setLedgerLoading(false);
    }
  };

  const loadMemberTransactions = async (memberData) => {
    if (!memberData?.group) return;

    try {
      setTransactionsLoading(true);
      const groupId = memberData.group._id || memberData.group;
      const memberId = memberData._id || id;
      const memberCode = memberData.Member_Id;

      // Fetch loans, recoveries, FDs, and payments for the member
      const [loansRes, recoveriesRes, fdsRes, paymentsRes] = await Promise.all([
        getLoans(groupId).catch(() => ({ success: false, data: [] })),
        getRecoveries(groupId).catch(() => ({ success: false, data: [] })),
        getFDsByMember(memberId).catch(() => ({ success: false, data: [] })),
        getPayments({ memberId }).catch(() => ({ success: false, data: [] })),
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

      // Set FDs from FDMaster
      const fds = fdsRes?.data || [];
      setMemberFDs(Array.isArray(fds) ? fds : []);

      // Filter payments by memberId and only include approved/completed payments
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
    // Map backend member doc -> UI model
    const isExisting = memberDoc?.isExistingMember || false;
    const openingSaving = memberDoc?.openingSaving || 0;
    const fdDetails = memberDoc?.fdDetails || {};
    const loanDetails = memberDoc?.loanDetails || {};
    const openingYogdan = memberDoc?.openingYogdan || 0;

    // Calculate current balances from transactions
    // Start with opening balances
    let currentSavings = openingSaving;
    let currentLoan = loanDetails?.amount || 0;
    let currentFD = fdDetails?.amount || 0;
    let currentInterest = loanDetails?.overdueInterest || 0;
    let lastRecoveryDate = null;


    // Add savings from recoveries
    memberRecoveries.forEach((recovery, idx) => {
      const amounts = recovery.amounts || {};
      const savingAmt = parseFloat(amounts.saving || 0);
      const loanAmt = parseFloat(amounts.loan || 0);
      const fdAmt = parseFloat(amounts.fd || 0);
      const interestAmt = parseFloat(amounts.interest || 0);

      currentSavings += savingAmt;
      currentLoan = Math.max(0, currentLoan - loanAmt);
      currentFD += fdAmt;
      currentInterest = Math.max(0, currentInterest - interestAmt);

      // Track last recovery date
      const recoveryDate = recovery.recoveryDate || recovery.date;
      if (recoveryDate) {
        const date = new Date(recoveryDate);
        if (!lastRecoveryDate || date > lastRecoveryDate) {
          lastRecoveryDate = date;
        }
      }
    });

    // Add savings from loan transactions (if transactionType is "Saving")
    memberLoans.forEach((loan) => {
      if (loan.transactionType === "Saving") {
        currentSavings += parseFloat(loan.amount || 0);
      } else if (loan.transactionType === "Loan") {
        currentLoan += parseFloat(loan.amount || 0);
      } else if (loan.transactionType === "FD") {
        currentFD += parseFloat(loan.amount || 0);
      }
    });

    // Add FDs from FDMaster
    memberFDs.forEach((fd) => {
      currentFD += parseFloat(fd.amount || fd.principal || 0);
    });

    // Subtract payments (savings withdrawals and FD maturities)
    memberPayments.forEach((payment) => {
      const amount = parseFloat(payment.amount || 0);
      if (payment.paymentType === "saving_withdrawal") {
        currentSavings = Math.max(0, currentSavings - amount);
      } else if (payment.paymentType === "fd_maturity") {
        currentFD = Math.max(0, currentFD - amount);
      }
    });

    return {
      code: memberDoc?.Member_Id || "-",
      name: memberDoc?.Member_Nm || "-",
      fatherName: memberDoc?.F_H_Name || memberDoc?.F_H_FatherName || "-",
      village: memberDoc?.Village || "-",
      joiningDate: memberDoc?.Dt_Join || "",
      // Financial fields - opening balances
      openingBalance: openingSaving,
      // Financial fields - current balances (calculated from transactions)
      savingsTotal: currentSavings, // Current total savings (opening + all deposits)
      loanOutstanding: currentLoan, // Current outstanding loan (opening + loans taken - loans recovered)
      loanDate: loanDetails?.loanDate || null,
      loanOverdueInterest: loanDetails?.overdueInterest || 0,
      fdTotal: currentFD, // Current total FD (opening + all FD deposits)
      fdDate: fdDetails?.date || null,
      fdMaturityDate: fdDetails?.maturityDate || null,
      fdInterest: fdDetails?.interest || 0,
      interestPending: currentInterest, // Current pending interest (opening - interest paid)
      openingYogdan: openingYogdan,
      isExistingMember: isExisting,
      lastRecoveryDate: lastRecoveryDate,
    };
  }, [memberDoc, memberRecoveries, memberLoans, memberFDs, memberPayments]);

  // Use ledger data from API instead of calculating on frontend
  const ledger = useMemo(() => {
    // Return ledger data from API, or empty array if not loaded yet
    return ledgerData || [];
  }, [ledgerData]);

  // OLD LEDGER CALCULATION - KEPT FOR REFERENCE BUT NOT USED
  // This complex calculation is now done on the backend
  const ledger_OLD = useMemo(() => {
    const entries = [];
    // Start with opening balances only (not the calculated totals which include transactions)
    const openingFD = memberDoc?.fdDetails?.amount || 0;
    const openingLoan = memberDoc?.loanDetails?.amount || 0;
    let runningSavings = member.openingBalance || 0;
    let runningLoan = openingLoan; // Start with opening loan only, not member.loanOutstanding (which includes memberLoans)
    let runningFD = openingFD; // Start with opening FD only, not member.fdTotal (which includes memberFDs)
    let runningInterest = member.loanOverdueInterest || 0;
    let cumulativeLoanPaid = 0; // Track cumulative total loan paid


    // Track FDs from FDMaster to avoid double counting with member.fdDetails
    const fdFromFDMaster = new Set();

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
          loanPaid: cumulativeLoanPaid, // Cumulative total paid so far (0 at opening)
          loanRecovered: 0, // No recovery at opening
          loanBalance: runningLoan,
          fdDeposit: openingFD, // Use openingFD, not member.fdTotal
          fdWithdraw: 0,
          fdBalance: runningFD,
          interestDue: member.loanOverdueInterest,
          interestPaid: 0,
        });
      }

      // FD entry (if different date from opening)
      if (openingFD > 0 && member.fdDate && member.fdDate !== openingDate) {
        entries.push({
          date: member.fdDate,
          receipt: "FD Opening",
          savingsDeposit: 0,
          savingsWithdraw: 0,
          savingsBalance: runningSavings,
          loanPaid: cumulativeLoanPaid, // Cumulative total paid so far
          loanRecovered: 0, // No recovery at FD opening
          loanBalance: runningLoan,
          fdDeposit: openingFD, // Use openingFD, not member.fdTotal
          fdWithdraw: 0,
          fdBalance: runningFD,
          interestDue: runningInterest,
          interestPaid: 0,
        });
      }

      // Loan entry (if different date from opening)
      if (openingLoan > 0 && member.loanDate && member.loanDate !== openingDate) {
        entries.push({
          date: member.loanDate,
          receipt: "Loan Taken",
          savingsDeposit: 0,
          savingsWithdraw: 0,
          savingsBalance: runningSavings,
          loanPaid: cumulativeLoanPaid, // Cumulative total paid so far (0 at this point)
          loanRecovered: 0, // Loan taken, not recovered yet
          loanBalance: runningLoan, // Outstanding loan balance (opening loan)
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
          loanPaid: cumulativeLoanPaid, // Cumulative total paid so far
          loanRecovered: 0, // Loan taken, not recovered
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
          loanPaid: cumulativeLoanPaid, // Cumulative total paid so far
          loanRecovered: 0, // No loan recovery in FD entry
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
          loanPaid: cumulativeLoanPaid, // Cumulative total paid so far
          loanRecovered: 0, // No loan recovery in saving entry
          loanBalance: runningLoan,
          fdDeposit: 0,
          fdWithdraw: 0,
          fdBalance: runningFD,
          interestDue: runningInterest,
          interestPaid: 0,
        });
      }
    });

    // Add FD transactions from FDMaster
    memberFDs.forEach((fd) => {
      const fdDate = fd.date || fd.createdAt;
      const amount = parseFloat(fd.amount || 0);

      if (amount > 0) {
        runningFD += amount;
        fdFromFDMaster.add(fd._id);
        entries.push({
          date: fdDate,
          receipt: `FD - ${fd.status || "Active"}`,
          savingsDeposit: 0,
          savingsWithdraw: 0,
          savingsBalance: runningSavings,
          loanPaid: cumulativeLoanPaid, // Cumulative total paid so far
          loanRecovered: 0, // No loan recovery in FD entry
          loanBalance: runningLoan,
          fdDeposit: amount,
          fdWithdraw: 0,
          fdBalance: runningFD,
          interestDue: runningInterest,
          interestPaid: 0,
        });
      }
    });

    // Add recovery transactions
    memberRecoveries.forEach((recovery, idx) => {
      const recoveryDate = recovery.recoveryDate || recovery.date;
      const amounts = recovery.amounts || {};


      const saving = parseFloat(amounts.saving || 0);
      const loan = parseFloat(amounts.loan || 0);
      const fd = parseFloat(amounts.fd || 0);
      const interest = parseFloat(amounts.interest || 0);
      const yogdan = parseFloat(amounts.yogdan || 0);
      const other = parseFloat(amounts.other || 0);


      const beforeBalances = { runningSavings, runningLoan, runningFD, runningInterest, cumulativeLoanPaid };
      runningSavings += saving;
      // Update loan balance: subtract loan recovery amount
      const loanBeforeRecovery = runningLoan;
      const loanAmount = isNaN(loan) ? 0 : loan;

      // Store cumulative BEFORE adding this recovery (for loanPaid display)
      const cumulativeLoanPaidBefore = cumulativeLoanPaid;

      runningLoan = Math.max(0, runningLoan - loanAmount);

      // Update cumulative loan paid AFTER storing the before value
      cumulativeLoanPaid += loanAmount;

      runningFD += fd;
      // Update interest: subtract interest paid
      // Interest due should show the total interest due (before payment) + interest paid in this recovery
      // This way it shows the full interest amount that was due
      const interestBeforeRecovery = runningInterest;
      const interestDueForThisRecovery = interest; // Interest paid in this recovery
      const totalInterestDue = interestBeforeRecovery + interestDueForThisRecovery; // Total interest due before this payment
      runningInterest = Math.max(0, runningInterest - interest);

      // Ensure interest amount is a number
      const interestAmount = isNaN(interest) ? 0 : interest;


      const entry = {
        date: recoveryDate,
        receipt: "Recovery",
        savingsDeposit: saving,
        savingsWithdraw: 0,
        savingsBalance: runningSavings,
        loanPaid: cumulativeLoanPaidBefore, // Cumulative total loan paid BEFORE this recovery
        loanRecovered: loanAmount, // Amount recovered from member in this transaction
        loanBalance: runningLoan, // Remaining loan balance after recovery
        fdDeposit: fd,
        fdWithdraw: 0,
        fdBalance: runningFD,
        interestDue: totalInterestDue, // Total interest due (before payment) - shows full interest amount
        interestPaid: interestAmount, // Interest paid in this recovery
      };

      entries.push(entry);
    });

    // Add payment transactions (FD maturity and savings withdrawal)
    memberPayments.forEach((payment) => {
      const paymentDate = payment.paymentDate || payment.createdAt;
      const amount = parseFloat(payment.amount || 0);
      const paymentType = payment.paymentType;

      if (paymentType === "saving_withdrawal") {
        // Savings withdrawal reduces savings balance
        runningSavings = Math.max(0, runningSavings - amount);
        entries.push({
          date: paymentDate,
          receipt: "Savings Withdrawal",
          savingsDeposit: 0,
          savingsWithdraw: amount,
          savingsBalance: runningSavings,
          loanPaid: cumulativeLoanPaid, // Cumulative total paid so far
          loanRecovered: 0, // No loan recovery in payment entry
          loanBalance: runningLoan,
          fdDeposit: 0,
          fdWithdraw: 0,
          fdBalance: runningFD,
          interestDue: runningInterest,
          interestPaid: 0,
        });
      } else if (paymentType === "fd_maturity") {
        // FD maturity reduces FD balance
        runningFD = Math.max(0, runningFD - amount);
        entries.push({
          date: paymentDate,
          receipt: "FD Maturity",
          savingsDeposit: 0,
          savingsWithdraw: 0,
          savingsBalance: runningSavings,
          loanPaid: cumulativeLoanPaid, // Cumulative total paid so far
          loanRecovered: 0, // No loan recovery in payment entry
          loanBalance: runningLoan,
          fdDeposit: 0,
          fdWithdraw: amount,
          fdBalance: runningFD,
          interestDue: runningInterest,
          interestPaid: 0,
        });
      }
    });

    // Sort by date
    const sortedEntries = entries.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Recalculate ALL running balances in chronological order
    // This is necessary because entries were processed in a different order
    let recalcSavings = member.openingBalance || 0;
    let recalcLoan = openingLoan;
    let recalcFD = openingFD;
    let recalcInterest = member.loanOverdueInterest || 0;
    // NOTE: UI "General Loan" columns:
    // - Paid: total loan DISBURSED (given to member) cumulative
    // - Recovered: amount recovered in the current transaction (for "Recovery" rows)
    let cumulativeLoanDisbursed = 0;
    let cumulativeLoanRecovered = 0;

    sortedEntries.forEach((entry) => {

      // Process entry based on receipt type - use deposit/withdraw amounts, not stored balances
      if (entry.receipt === "Opening" || entry.receipt === "FD Opening") {
        // Opening balance entries
        if (entry.savingsDeposit > 0) {
          recalcSavings = entry.savingsDeposit;
        }
        if (entry.fdDeposit > 0) {
          recalcFD = entry.fdDeposit;
        }
        // Don't repeat Paid on non-loan rows
        entry.loanPaid = 0;
      } else if (entry.receipt === "Loan Taken" || entry.receipt.startsWith("Loan -")) {
        // Loan taken - calculate amount from balance difference
        const loanAmount = entry.loanBalance - recalcLoan;
        if (loanAmount > 0) {
          recalcLoan += loanAmount;
        } else {
          recalcLoan = entry.loanBalance; // Use the entry's balance directly
        }
        // "Paid" should reflect loan disbursed
        cumulativeLoanDisbursed += Math.max(0, loanAmount);
        entry.loanPaid = cumulativeLoanDisbursed;
      } else if (entry.receipt.startsWith("FD -")) {
        // FD deposit
        recalcFD += entry.fdDeposit;
        // Don't repeat Paid on non-loan rows
        entry.loanPaid = 0;
      } else if (entry.receipt === "Recovery") {
        // Recovery - add savings deposit, subtract loan recovered, add FD deposit, subtract interest paid
        recalcSavings += entry.savingsDeposit || 0;
        const loanRecovered = entry.loanRecovered || 0;
        // "Paid" stays as total disbursed; "Recovered" is per-transaction
        entry.loanPaid = cumulativeLoanDisbursed;
        cumulativeLoanRecovered += loanRecovered;

        recalcLoan = Math.max(0, recalcLoan - loanRecovered);
        recalcFD += entry.fdDeposit || 0;
        recalcInterest = Math.max(0, recalcInterest - (entry.interestPaid || 0));
      } else if (entry.receipt === "Savings Withdrawal") {
        // Savings withdrawal - subtract from savings
        recalcSavings = Math.max(0, recalcSavings - (entry.savingsWithdraw || 0));
        // Don't repeat Paid on non-loan rows
        entry.loanPaid = 0;
      } else if (entry.receipt === "FD Maturity") {
        // FD maturity - subtract from FD
        recalcFD = Math.max(0, recalcFD - (entry.fdWithdraw || 0));
        // Don't repeat Paid on non-loan rows
        entry.loanPaid = 0;
      }

      // Update entry balances
      entry.savingsBalance = recalcSavings;
      entry.loanBalance = recalcLoan;
      entry.fdBalance = recalcFD;
      entry.interestDue = recalcInterest;
    });

    return sortedEntries;
  }, [member, memberDoc, memberLoans, memberRecoveries, memberFDs, memberPayments]);

  // Format date to dd/mm/yyyy
  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // DATE FILTER FUNCTION - Note: Date filtering is now done on backend, but we keep this for client-side filtering if needed
  const filterByDate = (data) => {
    if (!data || data.length === 0) return [];
    return data.filter((item) => {
      const itemDate = new Date(item.date);
      const from = fromDate ? new Date(fromDate) : null;
      const to = toDate ? new Date(toDate) : null;

      if (from && itemDate < from) return false;
      if (to && itemDate > to) return false;

      return true;
    });
  };

  // Filter ledger - backend already filters by date, but we can apply additional client-side filtering if needed
  const filteredLedger = useMemo(() => {
    const filtered = filterByDate(ledger);
    console.log('[MEMBER_DASHBOARD] ===== FILTERED LEDGER COMPUTED =====');
    console.log('[MEMBER_DASHBOARD] Original ledger length:', ledger?.length || 0);
    console.log('[MEMBER_DASHBOARD] Filtered ledger length:', filtered?.length || 0);
    console.log('[MEMBER_DASHBOARD] Date filters:', { fromDate, toDate });
    console.log('[MEMBER_DASHBOARD] Filtered ledger entries:', filtered);
    console.log('[MEMBER_DASHBOARD] YogdanDue in filtered ledger:', filtered.map(e => ({
      date: e.date,
      receipt: e.receipt,
      yogdanDue: e.yogdanDue,
      yogdanPaid: e.yogdanPaid
    })));
    return filtered;
  }, [ledger, fromDate, toDate]);

  // Export table to Excel
  const exportTableToExcel = () => {
    const data = filteredLedger.map((row) => {
      const chargesTotal = row.charges ?
        Object.values(row.charges).reduce((sum, amount) => sum + (parseFloat(amount) || 0), 0) : 0;
      const chargesDetails = row.charges && Object.keys(row.charges).length > 0
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
      "Yogdan Due",
      "Yogdan Paid",
      "Charges Total",
      "Charges Details",
    ];

    const rows = filteredLedger.map((row) => {
      const chargesTotal = row.charges ?
        Object.values(row.charges).reduce((sum, amount) => sum + (parseFloat(amount) || 0), 0) : 0;
      const chargesDetails = row.charges && Object.keys(row.charges).length > 0
        ? Object.entries(row.charges)
          .filter(([_, amount]) => parseFloat(amount) > 0)
          .map(([name, amount]) => `${name}: ₹${parseFloat(amount).toLocaleString()}`)
          .join(", ")
        : "";

      return [
        formatDate(row.date),
        row.receipt.toString(),
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

    doc.text(`Opening Balance: ${member.openingBalance.toLocaleString()}`, 14, yPos);
    yPos += lineHeight;
    doc.text(`Savings Total: ${member.savingsTotal.toLocaleString()}`, 14, yPos);
    yPos += lineHeight;
    doc.text(`Loan Outstanding: ${member.loanOutstanding.toLocaleString()}`, 14, yPos);
    if (member.loanDate) {
      yPos += lineHeight;
      doc.text(`Loan Date: ${formatDate(member.loanDate)}`, 14, yPos);
    }
    if (member.loanOverdueInterest > 0) {
      yPos += lineHeight;
      doc.text(`Overdue Interest: ${member.loanOverdueInterest.toLocaleString()}`, 14, yPos);
    }
    yPos += lineHeight;
    doc.text(`FD Total: ${member.fdTotal.toLocaleString()}`, 14, yPos);
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
      doc.text(`FD Interest: ${member.fdInterest.toLocaleString()}`, 14, yPos);
    }
    if (member.openingYogdan > 0) {
      yPos += lineHeight;
      doc.text(`Opening Yogdan: ${member.openingYogdan.toLocaleString()}`, 14, yPos);
    }
    yPos += lineHeight;
    doc.text(`Interest Pending: ${member.interestPending.toLocaleString()}`, 14, yPos);
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
        "Yogdan Due",
        "Yogdan Paid",
        "Charges Total",
        "Charges Details",
      ];

      const rows = filteredLedger.map((row) => {
        const chargesTotal = row.charges ?
          Object.values(row.charges).reduce((sum, amount) => sum + (parseFloat(amount) || 0), 0) : 0;
        const chargesDetails = row.charges && Object.keys(row.charges).length > 0
          ? Object.entries(row.charges)
            .filter(([_, amount]) => parseFloat(amount) > 0)
            .map(([name, amount]) => `${name}: ₹${parseFloat(amount).toLocaleString()}`)
            .join(", ")
          : "";

        return [
          formatDate(row.date),
          row.receipt.toString(),
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
        headStyles: { fillColor: [66, 139, 202] },
        margin: { left: 14, right: 14 },
      });
    }

    doc.save(`Member_${member.code}_Full_Details_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  // Export complete ledger (from backend API)
  const exportCompleteLedger = async (format = 'excel') => {
    if (!id) {
      alert("Member ID is missing");
      return;
    }

    try {
      setLoading(true);
      const filters = {
        memberId: id,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      };

      const response = await exportMemberLedger(filters);

      if (response?.success && response?.data && response.data.length > 0) {
        const memberData = response.data[0];
        const memberCode = memberData.memberInfo?.code || "Member";

        if (format === 'excel') {
          exportMemberLedgerToExcel([memberData], `Member_${memberCode}_Complete_Ledger`);
        } else {
          exportMemberLedgerToPDF([memberData], `Member_${memberCode}_Complete_Ledger`);
        }
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

      {/* Action Buttons */}
      <div className="flex justify-end gap-4 mb-6">
        <button
          onClick={() => setShowCreateFD(true)}
          className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold shadow-md"
        >
          <Plus size={18} />
          Create New FD
        </button>
        <button
          onClick={exportTableToExcel}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold shadow-md"
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
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold shadow-md"
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
        <button
          onClick={() => exportCompleteLedger('excel')}
          className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold shadow-md"
        >
          <Download size={18} />
          Export Complete Ledger Excel
        </button>
        <button
          onClick={() => exportCompleteLedger('pdf')}
          className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold shadow-md"
        >
          <FileText size={18} />
          Export Complete Ledger PDF
        </button>
      </div>

      {/* Create FD Modal */}
      {showCreateFD && memberDoc && (
        <CreateFD
          member={memberDoc}
          onClose={() => setShowCreateFD(false)}
          onSuccess={() => {
            // Reload member data after FD creation
            if (id) {
              getMemberDetail(id)
                .then((res) => {
                  setMemberDoc(res?.data || null);
                  if (res?.data) {
                    loadMemberTransactions(res.data);
                  }
                })
                .catch((e) => {
                  console.error("Failed to reload member detail:", e);
                });
            }
          }}
        />
      )}

      {/* Member Photo */}
      {memberDoc?.Member_Photo && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <ImageIcon size={24} />
            Member Photo
          </h2>
          <div className="flex justify-center">
            <div className="relative">
              {imageErrors[memberDoc.Member_Photo] ? (
                <div className="flex items-center justify-center bg-gray-100 rounded-lg w-64 h-80">
                  <div className="text-center">
                    <ImageIcon size={48} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-500 text-sm">Photo not available</p>
                  </div>
                </div>
              ) : (
                <img
                  src={getImageUrl(memberDoc.Member_Photo)}
                  alt="Member Photo"
                  className="w-64 h-80 object-cover rounded-lg border-4 border-gray-300 shadow-lg"
                  onError={() => handleImageError(memberDoc.Member_Photo)}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Complete Member & Spouse Details - Side by Side */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <User size={24} />
          Complete Member & Spouse Details
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Member Details Column */}
          <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
            <h3 className="text-lg font-bold text-blue-800 mb-4 pb-2 border-b-2 border-blue-300">Member Details</h3>
            <div className="space-y-2">
              <div className="flex justify-between border-b border-blue-200 pb-1">
                <span className="font-semibold text-gray-700">Member Code:</span>
                <span className="text-gray-800">{memberDoc?.Member_Id || "-"}</span>
              </div>
              <div className="flex justify-between border-b border-blue-200 pb-1">
                <span className="font-semibold text-gray-700">Member Name:</span>
                <span className="text-gray-800">{memberDoc?.Member_Nm || "-"}</span>
              </div>
              <div className="flex justify-between border-b border-blue-200 pb-1">
                <span className="font-semibold text-gray-700">Date of Birth:</span>
                <span className="text-gray-800">{formatDate(memberDoc?.dt_birth) || "-"}</span>
              </div>
              <div className="flex justify-between border-b border-blue-200 pb-1">
                <span className="font-semibold text-gray-700">Age:</span>
                <span className="text-gray-800">{memberDoc?.Age || "-"}</span>
              </div>
              <div className="flex justify-between border-b border-blue-200 pb-1">
                <span className="font-semibold text-gray-700">Aadhar Number:</span>
                <span className="text-gray-800">{memberDoc?.Adhar_Id || "-"}</span>
              </div>
              <div className="flex justify-between border-b border-blue-200 pb-1">
                <span className="font-semibold text-gray-700">Mobile Number:</span>
                <span className="text-gray-800">{memberDoc?.cell_phone || "-"}</span>
              </div>
              <div className="flex justify-between border-b border-blue-200 pb-1">
                <span className="font-semibold text-gray-700">Bank Account:</span>
                <span className="text-gray-800">{memberDoc?.Bank_Ac || "-"}</span>
              </div>
              <div className="flex justify-between border-b border-blue-200 pb-1">
                <span className="font-semibold text-gray-700">Samagra ID:</span>
                <span className="text-gray-800">{memberDoc?.Samagra_Id || "-"}</span>
              </div>
              <div className="flex justify-between border-b border-blue-200 pb-1">
                <span className="font-semibold text-gray-700">Voter ID:</span>
                <span className="text-gray-800">{memberDoc?.Voter_Id || "-"}</span>
              </div>
              <div className="flex justify-between border-b border-blue-200 pb-1">
                <span className="font-semibold text-gray-700">Date of Joining:</span>
                <span className="text-gray-800">{formatDate(memberDoc?.Dt_Join) || "-"}</span>
              </div>
              <div className="flex justify-between border-b border-blue-200 pb-1">
                <span className="font-semibold text-gray-700">Father/Husband Name:</span>
                <span className="text-gray-800">{memberDoc?.F_H_Name || "-"}</span>
              </div>
              <div className="flex justify-between border-b border-blue-200 pb-1">
                <span className="font-semibold text-gray-700">Bank Name:</span>
                <span className="text-gray-800">{memberDoc?.Bank_Name || "-"}</span>
              </div>
              <div className="flex justify-between border-b border-blue-200 pb-1">
                <span className="font-semibold text-gray-700">IFSC Code:</span>
                <span className="text-gray-800">{memberDoc?.Ifsc_No || "-"}</span>
              </div>
            </div>
          </div>

          {/* Spouse (Pati) Details Column */}
          <div className="bg-pink-50 rounded-lg p-4 border-2 border-pink-200">
            <h3 className="text-lg font-bold text-pink-800 mb-4 pb-2 border-b-2 border-pink-300">Spouse (Pati) Details</h3>
            <div className="space-y-2">
              <div className="flex justify-between border-b border-pink-200 pb-1">
                <span className="font-semibold text-gray-700">Spouse Name:</span>
                <span className="text-gray-800">{memberDoc?.F_H_Name || "-"}</span>
              </div>
              <div className="flex justify-between border-b border-pink-200 pb-1">
                <span className="font-semibold text-gray-700">Date of Birth:</span>
                <span className="text-gray-800">{formatDate(memberDoc?.dt_birth_pati) || "-"}</span>
              </div>
              <div className="flex justify-between border-b border-pink-200 pb-1">
                <span className="font-semibold text-gray-700">Age:</span>
                <span className="text-gray-800">{memberDoc?.Age_Pati || "-"}</span>
              </div>
              <div className="flex justify-between border-b border-pink-200 pb-1">
                <span className="font-semibold text-gray-700">Aadhar Number:</span>
                <span className="text-gray-800">{memberDoc?.Adhar_Id_Pati || "-"}</span>
              </div>
              <div className="flex justify-between border-b border-pink-200 pb-1">
                <span className="font-semibold text-gray-700">Mobile Number:</span>
                <span className="text-gray-800">{memberDoc?.cell_phone_pati || "-"}</span>
              </div>
              <div className="flex justify-between border-b border-pink-200 pb-1">
                <span className="font-semibold text-gray-700">Bank Account:</span>
                <span className="text-gray-800">{memberDoc?.Bank_Ac_Pati || "-"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Member Details */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Additional Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex justify-between border-b border-gray-200 pb-2">
              <span className="font-semibold text-gray-700">Ration Card:</span>
              <span className="text-gray-800">{memberDoc?.Ration_Card || "-"}</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-2">
              <span className="font-semibold text-gray-700">Job Card:</span>
              <span className="text-gray-800">{memberDoc?.Job_Card || "-"}</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-2">
              <span className="font-semibold text-gray-700">Education:</span>
              <span className="text-gray-800">{memberDoc?.Edu_Qual || "-"}</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-2">
              <span className="font-semibold text-gray-700">Profession:</span>
              <span className="text-gray-800">{memberDoc?.Profession || "-"}</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-2">
              <span className="font-semibold text-gray-700">Annual Income:</span>
              <span className="text-gray-800">{memberDoc?.Anual_Income ? `₹${memberDoc.Anual_Income.toLocaleString()}` : "-"}</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-2">
              <span className="font-semibold text-gray-700">Caste:</span>
              <span className="text-gray-800">{memberDoc?.Caste || "-"}</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-2">
              <span className="font-semibold text-gray-700">Religion:</span>
              <span className="text-gray-800">{memberDoc?.Religion || "-"}</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-2">
              <span className="font-semibold text-gray-700">APL/BPL:</span>
              <span className="text-gray-800">{memberDoc?.Apl_Bpl_Etc || "-"}</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-2">
              <span className="font-semibold text-gray-700">Designation:</span>
              <span className="text-gray-800">{memberDoc?.Desg || "-"}</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-2">
              <span className="font-semibold text-gray-700">Village:</span>
              <span className="text-gray-800">{memberDoc?.Village || "-"}</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-2">
              <span className="font-semibold text-gray-700">Address:</span>
              <span className="text-gray-800">{memberDoc?.res_add1 || "-"}</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-2">
              <span className="font-semibold text-gray-700">Group Name:</span>
              <span className="text-gray-800">{memberDoc?.Group_Name || "-"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Identity Documents with Images - Member */}
      {(memberDoc?.Voter_Id_File || memberDoc?.Adhar_Id_File || memberDoc?.Bank_File || memberDoc?.Ration_Card_File || memberDoc?.Job_Card_File) && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <IdCard size={24} />
            Member Identity Documents
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

            {memberDoc?.Bank_File && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-700 mb-2">Bank Document</h3>
                <p className="text-sm text-gray-600 mb-3">Account: {memberDoc?.Bank_Ac || "-"}</p>
                <div className="relative">
                  {imageErrors[memberDoc.Bank_File] ? (
                    <div className="flex items-center justify-center bg-gray-100 rounded-lg h-48">
                      <div className="text-center">
                        <ImageIcon size={48} className="mx-auto text-gray-400 mb-2" />
                        <p className="text-gray-500 text-sm">Image not available</p>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={getImageUrl(memberDoc.Bank_File)}
                      alt="Bank Document"
                      className="w-full h-auto rounded-lg border border-gray-300 cursor-pointer hover:opacity-90 transition-opacity"
                      onError={() => handleImageError(memberDoc.Bank_File)}
                    />
                  )}
                  {!imageErrors[memberDoc.Bank_File] && (
                    <a
                      href={getImageUrl(memberDoc.Bank_File)}
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

      {/* Spouse Document Attachments */}
      {(memberDoc?.Adhar_Id_Pati_File || memberDoc?.Voter_Id_Pati_File || memberDoc?.Bank_Pati_File) && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <IdCard size={24} />
            Spouse (Pati) Document Attachments
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {memberDoc?.Adhar_Id_Pati_File && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-700 mb-2">Spouse Aadhar Document</h3>
                <p className="text-sm text-gray-600 mb-3">Aadhar Number: {memberDoc?.Adhar_Id_Pati || "-"}</p>
                <div className="relative">
                  {imageErrors[memberDoc.Adhar_Id_Pati_File] ? (
                    <div className="flex items-center justify-center bg-gray-100 rounded-lg h-48">
                      <div className="text-center">
                        <ImageIcon size={48} className="mx-auto text-gray-400 mb-2" />
                        <p className="text-gray-500 text-sm">Image not available</p>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={getImageUrl(memberDoc.Adhar_Id_Pati_File)}
                      alt="Spouse Aadhar Document"
                      className="w-full h-auto rounded-lg border border-gray-300 cursor-pointer hover:opacity-90 transition-opacity"
                      onError={() => handleImageError(memberDoc.Adhar_Id_Pati_File)}
                    />
                  )}
                  {!imageErrors[memberDoc.Adhar_Id_Pati_File] && (
                    <a
                      href={getImageUrl(memberDoc.Adhar_Id_Pati_File)}
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

            {memberDoc?.Voter_Id_Pati_File && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-700 mb-2">Spouse Voter ID Document</h3>
                <div className="relative">
                  {imageErrors[memberDoc.Voter_Id_Pati_File] ? (
                    <div className="flex items-center justify-center bg-gray-100 rounded-lg h-48">
                      <div className="text-center">
                        <ImageIcon size={48} className="mx-auto text-gray-400 mb-2" />
                        <p className="text-gray-500 text-sm">Image not available</p>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={getImageUrl(memberDoc.Voter_Id_Pati_File)}
                      alt="Spouse Voter ID Document"
                      className="w-full h-auto rounded-lg border border-gray-300 cursor-pointer hover:opacity-90 transition-opacity"
                      onError={() => handleImageError(memberDoc.Voter_Id_Pati_File)}
                    />
                  )}
                  {!imageErrors[memberDoc.Voter_Id_Pati_File] && (
                    <a
                      href={getImageUrl(memberDoc.Voter_Id_Pati_File)}
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

            {memberDoc?.Bank_Pati_File && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-700 mb-2">Spouse Bank Document</h3>
                <p className="text-sm text-gray-600 mb-3">Account: {memberDoc?.Bank_Ac_Pati || "-"}</p>
                <div className="relative">
                  {imageErrors[memberDoc.Bank_Pati_File] ? (
                    <div className="flex items-center justify-center bg-gray-100 rounded-lg h-48">
                      <div className="text-center">
                        <ImageIcon size={48} className="mx-auto text-gray-400 mb-2" />
                        <p className="text-gray-500 text-sm">Image not available</p>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={getImageUrl(memberDoc.Bank_Pati_File)}
                      alt="Spouse Bank Document"
                      className="w-full h-auto rounded-lg border border-gray-300 cursor-pointer hover:opacity-90 transition-opacity"
                      onError={() => handleImageError(memberDoc.Bank_Pati_File)}
                    />
                  )}
                  {!imageErrors[memberDoc.Bank_Pati_File] && (
                    <a
                      href={getImageUrl(memberDoc.Bank_Pati_File)}
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
              {memberDoc?.loanDetails?.time_period && (
                <tr className="border-b border-gray-200">
                  <td className="p-3 font-semibold text-gray-700 bg-gray-50">Loan Time Period:</td>
                  <td className="p-3 text-gray-800">
                    {memberDoc.loanDetails.time_period / 12} {memberDoc.loanDetails.time_period / 12 === 1 ? 'year' : 'years'} ({memberDoc.loanDetails.time_period} months)
                  </td>
                </tr>
              )}
              {memberDoc?.loanDetails?.installment_amount && (
                <tr className="border-b border-gray-200">
                  <td className="p-3 font-semibold text-gray-700 bg-gray-50">Monthly Installment:</td>
                  <td className="p-3 text-gray-800">₹{parseFloat(memberDoc.loanDetails.installment_amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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

      {/* Membership Fees Summary */}
      {(() => {
        // Calculate totals for membership fees
        const totalMemFeesGroup = memberRecoveries.reduce((sum, recovery) => {
          return sum + (parseFloat(recovery.amounts?.memFeesGroup || 0) || 0);
        }, 0);
        const totalMemFeesSHG = memberRecoveries.reduce((sum, recovery) => {
          return sum + (parseFloat(recovery.amounts?.memFeesSHG || 0) || 0);
        }, 0);
        const totalMemFeesSamiti = memberRecoveries.reduce((sum, recovery) => {
          return sum + (parseFloat(recovery.amounts?.memFeesSamiti || 0) || 0);
        }, 0);

        // Get last payment dates from member document
        const lastMemFeesSHGDate = memberDoc?.lastMembershipPaidDate;
        const lastMemFeesGroupDate = memberDoc?.lastMembershipGroupPaidDate;

        // Helper function to check if paid for current April-to-April cycle
        const getCurrentCycleStart = () => {
          const now = new Date();
          const currentYear = now.getFullYear();
          const currentMonth = now.getMonth(); // 0-11, where 0 is January
          // If current month is before April (month 3), cycle started last year
          if (currentMonth < 3) {
            return new Date(currentYear - 1, 3, 1); // April 1 of previous year
          }
          return new Date(currentYear, 3, 1); // April 1 of current year
        };

        const currentCycleStart = getCurrentCycleStart();
        const isMemFeesSHGPaid = lastMemFeesSHGDate && new Date(lastMemFeesSHGDate) >= currentCycleStart;
        const isMemFeesGroupPaid = lastMemFeesGroupDate && new Date(lastMemFeesGroupDate) >= currentCycleStart;

        return (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Membership Fees Summary</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-3 text-left font-semibold text-gray-700 border-b border-gray-200">Fee Type</th>
                    <th className="p-3 text-right font-semibold text-gray-700 border-b border-gray-200">Total Paid</th>
                    <th className="p-3 text-left font-semibold text-gray-700 border-b border-gray-200">Payment Status</th>
                    <th className="p-3 text-left font-semibold text-gray-700 border-b border-gray-200">Last Payment Date</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="p-3 font-semibold text-gray-700 bg-gray-50">Mem. Fees SHG (Yearly)</td>
                    <td className="p-3 text-gray-800 text-right">₹{totalMemFeesSHG.toLocaleString()}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${isMemFeesSHGPaid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                        {isMemFeesSHGPaid ? "Paid" : "Not Paid"}
                      </span>
                    </td>
                    <td className="p-3 text-gray-800">{lastMemFeesSHGDate ? formatDate(lastMemFeesSHGDate) : "Never"}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="p-3 font-semibold text-gray-700 bg-gray-50">Mem. Fees Group</td>
                    <td className="p-3 text-gray-800 text-right">₹{totalMemFeesGroup.toLocaleString()}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${isMemFeesGroupPaid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                        {isMemFeesGroupPaid ? "Paid" : "Not Paid"}
                      </span>
                    </td>
                    <td className="p-3 text-gray-800">{lastMemFeesGroupDate ? formatDate(lastMemFeesGroupDate) : "Never"}</td>
                  </tr>
                  {totalMemFeesSamiti > 0 && (
                    <tr className="border-b border-gray-200">
                      <td className="p-3 font-semibold text-gray-700 bg-gray-50">Mem. Fees Samiti (Yearly)</td>
                      <td className="p-3 text-gray-800 text-right">₹{totalMemFeesSamiti.toLocaleString()}</td>
                      <td className="p-3">
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                          Paid
                        </span>
                      </td>
                      <td className="p-3 text-gray-800">—</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

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
                    {memberDoc?.loanDetails?.time_period && (
                      <tr className="border-b border-blue-200">
                        <td className="p-3 font-semibold text-gray-700 bg-blue-100">Loan Time Period:</td>
                        <td className="p-3 text-gray-800">
                          {memberDoc.loanDetails.time_period / 12} {memberDoc.loanDetails.time_period / 12 === 1 ? 'year' : 'years'} ({memberDoc.loanDetails.time_period} months)
                        </td>
                      </tr>
                    )}
                    {memberDoc?.loanDetails?.installment_amount && (
                      <tr className="border-b border-blue-200">
                        <td className="p-3 font-semibold text-gray-700 bg-blue-100">Monthly Installment:</td>
                        <td className="p-3 text-gray-800">₹{parseFloat(memberDoc.loanDetails.installment_amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    )}
                  </>
                )}
                {member.openingYogdan > 0 && (
                  <tr className="border-b border-blue-200">
                    <td className="p-3 font-semibold text-gray-700 bg-blue-100">Opening Yogdan:</td>
                    <td className="p-3 text-gray-800">₹{member.openingYogdan.toLocaleString()}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Saving Rate Snapshot Section */}
          {memberDoc?.saving_per_member_snapshot && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Saving Rate Snapshot</h3>
              <p className="text-sm text-gray-600 mb-4">
                This rate is used for saving demand calculations instead of current group rate.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <tbody>
                    <tr className="border-b border-blue-200">
                      <td className="p-3 font-semibold text-gray-700 bg-blue-100 w-1/3">Saving Per Member Snapshot:</td>
                      <td className="p-3 text-gray-800">₹{memberDoc.saving_per_member_snapshot.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FD Details from FDMaster */}
      {memberFDs.length > 0 && (
        <div className="bg-green-50 border-l-4 border-green-500 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Fixed Deposit Details</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-green-100">
                  <th className="p-3 text-left font-semibold text-gray-700 border-b border-green-200">Date</th>
                  <th className="p-3 text-left font-semibold text-gray-700 border-b border-green-200">Amount</th>
                  <th className="p-3 text-left font-semibold text-gray-700 border-b border-green-200">Time Period</th>
                  <th className="p-3 text-left font-semibold text-gray-700 border-b border-green-200">Maturity Date</th>
                  <th className="p-3 text-left font-semibold text-gray-700 border-b border-green-200">Interest</th>
                  <th className="p-3 text-left font-semibold text-gray-700 border-b border-green-200">Maturity Amount</th>
                  <th className="p-3 text-left font-semibold text-gray-700 border-b border-green-200">Status</th>
                </tr>
              </thead>
              <tbody>
                {memberFDs.map((fd) => (
                  <tr key={fd._id} className="border-b border-green-200">
                    <td className="p-3 text-gray-800">{formatDate(fd.date)}</td>
                    <td className="p-3 text-gray-800">₹{parseFloat(fd.amount || 0).toLocaleString()}</td>
                    <td className="p-3 text-gray-800">
                      {fd.time_period ? (
                        <>
                          {fd.time_period / 12} {fd.time_period / 12 === 1 ? 'year' : 'years'} ({fd.time_period} months)
                        </>
                      ) : "-"}
                    </td>
                    <td className="p-3 text-gray-800">{formatDate(fd.maturityDate)}</td>
                    <td className="p-3 text-gray-800">₹{parseFloat(fd.interestAmount || 0).toLocaleString()}</td>
                    <td className="p-3 text-gray-800">₹{parseFloat(fd.maturityAmount || 0).toLocaleString()}</td>
                    <td className="p-3 text-gray-800">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${fd.status === "active" ? "bg-green-200 text-green-800" :
                        fd.status === "matured" ? "bg-yellow-200 text-yellow-800" :
                          "bg-gray-200 text-gray-800"
                        }`}>
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
                    <th className="border border-gray-300 p-3 text-right font-semibold">Mem. Fees SHG</th>
                    <th className="border border-gray-300 p-3 text-right font-semibold">Mem. Fees Group</th>
                    <th className="border border-gray-300 p-3 text-right font-semibold">Charges</th>
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
                    const memFeesSHG = parseFloat(amounts.memFeesSHG || 0);
                    const memFeesGroup = parseFloat(amounts.memFeesGroup || 0);
                    const memFeesSamiti = parseFloat(amounts.memFeesSamiti || 0);
                    const other = parseFloat(amounts.other || 0);
                    const chargesTotal = amounts.charges ?
                      Object.values(amounts.charges).reduce((sum, amount) => sum + (parseFloat(amount) || 0), 0) : 0;
                    const total = saving + loan + fd + interest + yogdan + memFeesSHG + memFeesGroup + memFeesSamiti + other + chargesTotal;
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
                        <td className="border border-gray-300 p-3 text-right">₹{memFeesSHG.toLocaleString()}</td>
                        <td className="border border-gray-300 p-3 text-right">₹{memFeesGroup.toLocaleString()}</td>
                        <td className="border border-gray-300 p-3 text-right" title={
                          amounts.charges && Object.keys(amounts.charges).length > 0
                            ? Object.entries(amounts.charges)
                              .filter(([_, amount]) => parseFloat(amount) > 0)
                              .map(([name, amount]) => `${name}: ₹${parseFloat(amount).toLocaleString()}`)
                              .join(", ")
                            : ""
                        }>
                          ₹{chargesTotal.toLocaleString()}
                        </td>
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
        {ledgerError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-700 font-semibold">Error loading ledger</p>
            <p className="text-red-600 text-sm mt-1">{ledgerError}</p>
          </div>
        )}
        {ledgerLoading && (
          <div className="text-center p-6 text-gray-600">
            Loading financial ledger...
          </div>
        )}
        {!ledgerLoading && !ledgerError && (
          <>
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
                    <th colSpan={2} className="border border-gray-300 p-3 text-center font-semibold">
                      Yogdan
                    </th>
                    <th className="border border-gray-300 p-3 text-center font-semibold">
                      Charges
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
                    <th className="border border-gray-300 p-2 text-center font-medium">Due</th>
                    <th className="border border-gray-300 p-2 text-center font-medium">Paid</th>
                    <th className="border border-gray-300 p-2 text-center font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan={17} className="text-center p-6 text-gray-500">
                        No records found for the selected date range
                      </td>
                    </tr>
                  ) : (
                    filteredLedger.map((row, i) => {
                      // Calculate total charges amount
                      const chargesTotal = row.charges ?
                        Object.values(row.charges).reduce((sum, amount) => sum + (parseFloat(amount) || 0), 0) : 0;
                      // Format charges details for display
                      const chargesDetails = row.charges && Object.keys(row.charges).length > 0
                        ? Object.entries(row.charges)
                          .filter(([_, amount]) => parseFloat(amount) > 0)
                          .map(([name, amount]) => `${name}: ₹${parseFloat(amount).toLocaleString()}`)
                          .join(", ")
                        : "—";

                      // Format all numeric values properly
                      const formattedSavingsDeposit = formatCurrency(row.savingsDeposit);
                      const formattedSavingsWithdraw = formatCurrency(row.savingsWithdraw);
                      const formattedSavingsBalance = formatCurrency(row.savingsBalance);
                      const formattedLoanPaid = formatCurrency(row.loanPaid);
                      const formattedLoanRecovered = formatCurrency(row.loanRecovered);
                      const formattedLoanBalance = formatCurrency(row.loanBalance);
                      const formattedFdDeposit = formatCurrency(row.fdDeposit);
                      const formattedFdWithdraw = formatCurrency(row.fdWithdraw);
                      const formattedFdBalance = formatCurrency(row.fdBalance);

                      // For recovery entries, show remaining due (due - paid) instead of total due before payment
                      // For other entries, show the due amount as is
                      let displayInterestDue = row.interestDue || 0;
                      let displayYogdanDue = row.yogdanDue || 0;
                      if (row.receipt === "Recovery") {
                        // Calculate remaining due after payment
                        displayInterestDue = Math.max(0, (row.interestDue || 0) - (row.interestPaid || 0));
                        displayYogdanDue = Math.max(0, (row.yogdanDue || 0) - (row.yogdanPaid || 0));
                      }

                      const formattedInterestDue = formatCurrency(displayInterestDue);
                      const formattedInterestPaid = formatCurrency(row.interestPaid);
                      const formattedYogdanDue = formatCurrency(displayYogdanDue);
                      const formattedYogdanPaid = formatCurrency(row.yogdanPaid);

                      // Log each row being rendered for debugging
                      console.log('[MEMBER_DASHBOARD] Rendering ledger row', {
                        index: i,
                        date: row.date,
                        receipt: row.receipt,
                        rawYogdanDue: row.yogdanDue,
                        rawYogdanPaid: row.yogdanPaid,
                        formattedYogdanDue,
                        formattedYogdanPaid,
                        rawInterestDue: row.interestDue,
                        formattedInterestDue,
                        rawLoanPaid: row.loanPaid,
                        formattedLoanPaid,
                        fullRow: row
                      });

                      return (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="border border-gray-300 p-3">{formatDate(row.date)}</td>
                          <td className="border border-gray-300 p-3">{row.receipt}</td>
                          <td className="border border-gray-300 p-3 text-right">
                            {formattedSavingsDeposit > 0 ? `₹${formattedSavingsDeposit.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : "—"}
                          </td>
                          <td className="border border-gray-300 p-3 text-right">
                            {formattedSavingsWithdraw > 0 ? `₹${formattedSavingsWithdraw.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : "—"}
                          </td>
                          <td className="border border-gray-300 p-3 text-right font-semibold">
                            {formattedSavingsBalance > 0 ? `₹${formattedSavingsBalance.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : "—"}
                          </td>
                          <td className="border border-gray-300 p-3 text-right">
                            {formattedLoanPaid > 0 ? `₹${formattedLoanPaid.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : "—"}
                          </td>
                          <td className="border border-gray-300 p-3 text-right">
                            {formattedLoanRecovered > 0 ? `₹${formattedLoanRecovered.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : "—"}
                          </td>
                          <td className="border border-gray-300 p-3 text-right font-semibold">
                            {formattedLoanBalance > 0 ? `₹${formattedLoanBalance.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : "—"}
                          </td>
                          <td className="border border-gray-300 p-3 text-right">
                            {formattedFdDeposit > 0 ? `₹${formattedFdDeposit.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : "—"}
                          </td>
                          <td className="border border-gray-300 p-3 text-right">
                            {formattedFdWithdraw > 0 ? `₹${formattedFdWithdraw.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : "—"}
                          </td>
                          <td className="border border-gray-300 p-3 text-right font-semibold">
                            {formattedFdBalance > 0 ? `₹${formattedFdBalance.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : "—"}
                          </td>
                          <td className="border border-gray-300 p-3 text-right">
                            {formattedInterestDue > 0
                              ? `₹${formattedInterestDue.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                              : (row.receipt === "Recovery" ? "₹0" : "—")}
                          </td>
                          <td className="border border-gray-300 p-3 text-right">
                            {formattedInterestPaid > 0
                              ? `₹${formattedInterestPaid.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                              : (row.receipt === "Recovery" ? "₹0" : "—")}
                          </td>
                          <td className="border border-gray-300 p-3 text-right">
                            {formattedYogdanDue > 0
                              ? `₹${formattedYogdanDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : (row.receipt === "Recovery" ? "₹0.00" : "—")}
                          </td>
                          <td className="border border-gray-300 p-3 text-right">
                            {formattedYogdanPaid > 0
                              ? `₹${formattedYogdanPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : (row.receipt === "Recovery" ? "₹0.00" : "—")}
                          </td>
                          <td className="border border-gray-300 p-3 text-right" title={chargesDetails}>
                            {chargesTotal > 0 ? `₹${chargesTotal.toLocaleString()}` : "—"}
                          </td>
                        </tr>
                      );
                    })
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
          </>
        )}
      </div>
    </div>
  );
}
