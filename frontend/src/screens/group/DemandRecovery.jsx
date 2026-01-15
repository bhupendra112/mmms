import React, { useState, useEffect } from "react";
import {
  User,
  Building2,
  DollarSign,
  CheckCircle,
  XCircle,
  Upload,
  Camera,
  Check,
  X,
  ArrowRight,
  ArrowLeft,
  FileText,
  Download,
  Wifi,
  WifiOff,
  Plus,
  CreditCard,
  Wallet,
  LayoutGrid,
} from "lucide-react";
import { Input, Select } from "../../components/forms/FormComponents";
import { exportRecoveryToExcel } from "../../utils/exportUtils";
import { useGroup } from "../../contexts/GroupContext";
import { createApprovalRequest } from "../../services/approvalDB";
import { registerRecovery, updateMemberRecovery, getRecoveryByDate, updateRecoveryPhoto, getPreviousRecoveryData, getDemandDetails, getMemberLoanTotals, getMemberRevenueRemaining, exportRecoveryPDF, getMemberRecoveryStatus } from "../../services/recoveryService";
import { getLoans } from "../../services/loanService";
import { getGroups, getGroupBanks } from "../../services/groupService";
import { getMembersByGroup } from "../../services/memberService";
import { isMeetingDay, getNextMeetingDate, formatMeetingDateTime } from "../../utils/meetingDateUtils";
import CreateFD from "../../components/fd/CreateFD";

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

  // If imagePath already starts with http, return as is
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }

  // Ensure imagePath starts with /
  const cleanImagePath = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
  const fullUrl = `${baseURL}${cleanImagePath}`;

  return fullUrl;
};

export default function DemandRecovery() {
  const { currentGroup, isOnline, isGroupPanel, isGroupLoading } = useGroup();
  const isAdminMode = !isGroupPanel;
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState(null); // { name, code }
  const [allMembers, setAllMembers] = useState([]);
  const [recoveries, setRecoveries] = useState([]);
  const [currentMemberIndex, setCurrentMemberIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  // Start at step 1 if currentGroup exists (group panel), step 0 if not (admin panel)
  const [currentStep, setCurrentStep] = useState(() => (isAdminMode ? 0 : 1)); // 0: Select Group (admin only), 1: Recovery Entry, 2: Summary & Photo
  const [selectedGroup, setSelectedGroup] = useState(null); // For admin: selected group from list

  // Form state for current member
  const [attendance, setAttendance] = useState("present");
  const [recoveryByOther, setRecoveryByOther] = useState(false);
  const [otherMemberId, setOtherMemberId] = useState("");
  const [amountBreakup, setAmountBreakup] = useState({
    saving: "",
    loan: "",
    interest: "",
    yogdan: "",
    memFeesSHG: "",
    memFeesSamiti: "",
    memFeesGroup: "",
    penalty: "",
    other: "",
    fd: "",
    charges: {}, // Dynamic charges: { [chargeName]: amount }
  });
  const [totalAmount, setTotalAmount] = useState(""); // Single total amount input for auto-calculation
  const [autoCalculated, setAutoCalculated] = useState(false); // Track if amounts are auto-calculated
  const [fdTimePeriod, setFdTimePeriod] = useState("");
  const [paymentMode, setPaymentMode] = useState({
    cash: false,
    online: false,
  });
  const [onlineRef, setOnlineRef] = useState("");
  const [selectedBankId, setSelectedBankId] = useState("");
  const [groupBanks, setGroupBanks] = useState([]);
  const [screenshot, setScreenshot] = useState(null);
  const [groupPhoto, setGroupPhoto] = useState(null);
  const [showCreateFD, setShowCreateFD] = useState(false);
  const [selectedMemberForFD, setSelectedMemberForFD] = useState(null);
  const [cashDenominations, setCashDenominations] = useState({
    note200: "",
    note500: "",
    note100: "",
    note50: "",
    note20: "",
    note10: "",
    note5: "",
    note2: "",
    note1: "",
  });
  const [showFullLoanRecovery, setShowFullLoanRecovery] = useState(false);
  const [fullLoanRecoveryPaymentMode, setFullLoanRecoveryPaymentMode] = useState({ cash: false, online: false });
  const [fullLoanRecoveryBankId, setFullLoanRecoveryBankId] = useState("");
  const [fullLoanRecoveryOnlineRef, setFullLoanRecoveryOnlineRef] = useState("");
  const [fullLoanRecoveryScreenshot, setFullLoanRecoveryScreenshot] = useState(null);
  const [loanTotals, setLoanTotals] = useState({ totalLoanAmount: 0, totalLoanRecovered: 0, remainingLoanAmount: 0 });
  const [loadingLoanTotals, setLoadingLoanTotals] = useState(false);
  const [memberLoanTotals, setMemberLoanTotals] = useState({}); // Store loan totals for each member
  const [memberRevenueRemaining, setMemberRevenueRemaining] = useState({}); // Store remaining revenue demands for each member
  const [memberRecoveryStatus, setMemberRecoveryStatus] = useState({}); // Store recovery status for each member: { [memberId]: { recoveredToday: boolean, recovery: object } }

  // Determine active group: use currentGroup from context if available, otherwise use selectedGroup (admin)
  const activeGroup = currentGroup || selectedGroup;

  // Check if today is a meeting day and get next meeting date
  const today = new Date();
  const isTodayMeetingDay = activeGroup ? isMeetingDay(today, activeGroup) : false;
  const nextMeetingDate = activeGroup ? getNextMeetingDate(activeGroup) : null;
  const meetingTime = activeGroup?.raw?.meeting_date_2_time || activeGroup?.meeting_date_2_time || null;

  // State to store previous recovery data and active loans
  const [previousRecoveryData, setPreviousRecoveryData] = useState({});
  const [activeLoans, setActiveLoans] = useState({});
  const [demandSummaries, setDemandSummaries] = useState({});

  // Load active loans for all members
  useEffect(() => {
    if (!activeGroup?.id) return;

    getLoans(activeGroup.id)
      .then((res) => {
        const loans = Array.isArray(res?.data) ? res.data : [];
        const loansByMember = {};

        loans.forEach(loan => {
          if (loan.transactionType === "Loan" && loan.status === "approved" && loan.memberId) {
            const memberId = loan.memberId.toString();
            if (!loansByMember[memberId] || new Date(loan.date) > new Date(loansByMember[memberId].date)) {
              loansByMember[memberId] = loan;
            }
          }
        });

        setActiveLoans(loansByMember);
      })
      .catch((err) => {
        console.error("Error loading loans:", err);
        setActiveLoans({});
      });
  }, [activeGroup?.id]);

  // Load previous recovery data and check recovery status when member changes
  useEffect(() => {
    if (!activeGroup?.id || !allMembers.length || currentMemberIndex < 0) return;

    const member = allMembers[currentMemberIndex];
    if (!member?.id) return;

    const today = new Date().toLocaleDateString("en-GB");

    // Check recovery status for today
    getMemberRecoveryStatus(member.id, activeGroup.id, today)
      .then((res) => {
        if (res?.success) {
          setMemberRecoveryStatus(prev => ({
            ...prev,
            [member.id]: res.data
          }));
        }
      })
      .catch((err) => {
        console.error("Error loading recovery status:", err);
        // Set as not recovered on error
        setMemberRecoveryStatus(prev => ({
          ...prev,
          [member.id]: { recoveredToday: false, recovery: null }
        }));
      });

    getPreviousRecoveryData(activeGroup.id, member.id, today)
      .then((res) => {
        if (res?.success) {
          setPreviousRecoveryData(prev => ({
            ...prev,
            [member.id]: res.data
          }));
        }
      })
      .catch((err) => {
        console.error("Error loading previous recovery data:", err);
      });

    // Fetch demandDetails from backend
    getDemandDetails(activeGroup.id, member.id, today)
      .then((res) => {
        if (res?.success && res?.data) {
          setDemandSummaries(prev => ({
            ...prev,
            [member.id]: res.data
          }));
        }
      })
      .catch((err) => {
        console.error("Error loading demand details:", err);
      });

    // Fetch loan totals and remaining amounts for auto-calculation
    getMemberLoanTotals(activeGroup.id, member.id)
      .then((res) => {
        if (res?.success && res?.data) {
          setMemberLoanTotals(prev => ({
            ...prev,
            [member.id]: {
              // Loan data
              totalLoanAmount: res.data.totalLoanAmount || 0,
              totalLoanRecovered: res.data.totalLoanRecovered || 0,
              remainingLoanAmount: res.data.remainingLoanAmount || 0,
              // Yogdan data
              openingYogdan: res.data.openingYogdan || 0,
              totalYogdanRecovered: res.data.totalYogdanRecovered || 0,
              remainingYogdanAmount: res.data.remainingYogdanAmount || 0,
              // Overdue Interest data
              openingOverdueInterest: res.data.openingOverdueInterest || 0,
              totalOverdueInterestRecovered: res.data.totalOverdueInterestRecovered || 0,
              remainingOverdueInterestAmount: res.data.remainingOverdueInterestAmount || 0,
            }
          }));
        }
      })
      .catch((err) => {
        console.error("Error loading loan totals:", err);
      });

    // Fetch remaining revenue demands (membership fees, group fees) from MemberRevenueDemand
    getMemberRevenueRemaining(activeGroup.id, member.id)
      .then((res) => {
        if (res?.success && res?.data) {
          setMemberRevenueRemaining(prev => ({
            ...prev,
            [member.id]: {
              membershipFeesSHG: {
                remainingAmount: res.data.membershipFeesSHG?.remainingAmount || 0,
                totalDemand: res.data.membershipFeesSHG?.totalDemand || 0,
                totalPaid: res.data.membershipFeesSHG?.totalPaid || 0,
                details: res.data.membershipFeesSHG?.details || []
              },
              membershipFeesGroup: {
                remainingAmount: res.data.membershipFeesGroup?.remainingAmount || 0,
                totalDemand: res.data.membershipFeesGroup?.totalDemand || 0,
                totalPaid: res.data.membershipFeesGroup?.totalPaid || 0,
                details: res.data.membershipFeesGroup?.details || []
              },
              hasUnpaidDemands: res.data.hasUnpaidDemands || false
            }
          }));
        }
      })
      .catch((err) => {
        console.error("Error loading revenue remaining amounts:", err);
      });
  }, [activeGroup?.id, currentMemberIndex, allMembers]);


  const getDemandSummary = (memberId) => {
    const recovery = recoveries.find((r) => r.memberId === memberId);
    const member = allMembers.find((m) => m.id === memberId);

    // Priority 1: Use demandDetails from recovery if available (calculated by backend when saving)
    if (recovery?.demandDetails) {
      const dd = recovery.demandDetails;
      // Get remaining amounts from API (prefer remaining amounts over recovery demandDetails for yogdan and overdueInterest)
      const remainingAmounts = memberLoanTotals[memberId] || {};
      const remainingYogdan = remainingAmounts.remainingYogdanAmount || 0;
      const remainingOverdueInterest = remainingAmounts.remainingOverdueInterestAmount || 0;

      // Get remaining revenue demands from MemberRevenueDemand API
      const revenueRemaining = memberRevenueRemaining[memberId] || {};

      return {
        saving: {
          prev: dd.saving?.prevDemand || 0,
          curr: dd.saving?.currDemand || 0,
          total: dd.saving?.totalDemand || 0,
          actual: dd.saving?.actualPaid || 0,
          unpaid: dd.saving?.unpaidDemand || 0,
          opening: dd.saving?.openingBalance || 0,
          closing: dd.saving?.closingBalance || 0,
        },
        loan: {
          prev: dd.loan?.prevDemand || 0,
          curr: dd.loan?.currDemand || 0,
          total: dd.loan?.totalDemand || 0,
          actual: dd.loan?.actualPaid || 0,
          unpaid: dd.loan?.unpaidDemand || 0,
          opening: dd.loan?.openingBalance || 0,
          closing: dd.loan?.closingBalance || 0,
        },
        interest: {
          prev: dd.interest?.prevDemand || 0,
          curr: dd.interest?.currDemand || 0,
          total: dd.interest?.totalDemand || 0,
          actual: dd.interest?.actualPaid || 0,
          unpaid: dd.interest?.unpaidDemand || 0,
          opening: dd.interest?.openingBalance || 0,
          closing: dd.interest?.closingBalance || 0,
        },
        fd: {
          prev: 0,
          curr: 0,
          total: 0,
          actual: dd.fd?.actualPaid || 0,
          unpaid: 0,
          opening: dd.fd?.openingBalance || 0,
          closing: dd.fd?.closingBalance || 0,
        },
        yogdan: {
          prev: dd.yogdan?.prevDemand || 0,
          // Use remaining yogdan from API if available, otherwise use backend demandDetails
          curr: remainingYogdan > 0 ? remainingYogdan : (dd.yogdan?.currDemand || dd.yogdan?.totalDemand || 0),
          // Use remaining yogdan from API if available, otherwise use backend total
          total: remainingYogdan > 0 ? remainingYogdan : (dd.yogdan?.totalDemand || 0),
          actual: recovery?.amounts?.yogdan || 0,
          // Use remaining yogdan - actual if available, otherwise use backend unpaid
          unpaid: remainingYogdan > 0 ? Math.max(0, remainingYogdan - (recovery?.amounts?.yogdan || 0)) : (dd.yogdan?.unpaidDemand || 0),
          opening: dd.yogdan?.openingBalance || 0, // Opening balance is only cumulative payments, NOT openingYogdan
          closing: dd.yogdan?.closingBalance || (dd.yogdan?.openingBalance || 0) + (recovery?.amounts?.yogdan || 0),
        },
        memFeesSHG: {
          prev: 0,
          // Use remaining amount from MemberRevenueDemand API if available, otherwise use backend demandDetails
          curr: (revenueRemaining?.membershipFeesSHG?.remainingAmount || 0) > 0
            ? (revenueRemaining.membershipFeesSHG.remainingAmount)
            : (dd.membership?.membershipFeesDue || 0),
          total: (revenueRemaining?.membershipFeesSHG?.remainingAmount || 0) > 0
            ? (revenueRemaining.membershipFeesSHG.remainingAmount)
            : (dd.membership?.membershipFeesDue || 0),
          actual: recovery?.amounts?.memFeesSHG || 0,
          unpaid: (revenueRemaining?.membershipFeesSHG?.remainingAmount || 0) > 0
            ? Math.max(0, (revenueRemaining.membershipFeesSHG.remainingAmount) - (recovery?.amounts?.memFeesSHG || 0))
            : Math.max(0, (dd.membership?.membershipFeesDue || 0) - (recovery?.amounts?.memFeesSHG || 0)),
          opening: 0,
          closing: 0,
        },
        memFeesSamiti: {
          prev: 0,
          curr: 0,
          total: recovery?.amounts?.memFeesSamiti || 0,
          actual: recovery?.amounts?.memFeesSamiti || 0,
          unpaid: 0,
          opening: 0,
          closing: 0,
        },
        memFeesGroup: {
          prev: 0,
          // Use remaining amount from MemberRevenueDemand API if available, otherwise use backend demandDetails
          curr: (revenueRemaining?.membershipFeesGroup?.remainingAmount || 0) > 0
            ? (revenueRemaining.membershipFeesGroup.remainingAmount)
            : (dd.membership?.membershipGroupDue || 0),
          total: (revenueRemaining?.membershipFeesGroup?.remainingAmount || 0) > 0
            ? (revenueRemaining.membershipFeesGroup.remainingAmount)
            : (dd.membership?.membershipGroupDue || 0),
          actual: dd.membership?.actualMemFeesGroup || 0,
          unpaid: (revenueRemaining?.membershipFeesGroup?.remainingAmount || 0) > 0
            ? Math.max(0, (revenueRemaining.membershipFeesGroup.remainingAmount) - (dd.membership?.actualMemFeesGroup || 0))
            : Math.max(0, (dd.membership?.membershipGroupDue || 0) - (dd.membership?.actualMemFeesGroup || 0)),
          opening: 0,
          closing: 0,
        },
        penalty: {
          prev: 0,
          curr: 0,
          total: recovery?.amounts?.penalty || 0,
          actual: recovery?.amounts?.penalty || 0,
          unpaid: 0,
          opening: 0,
          closing: 0,
        },
        other: {
          prev: 0,
          curr: 0,
          total: (recovery?.amounts?.other1 || 0) + (recovery?.amounts?.other2 || 0) + (recovery?.amounts?.other || 0),
          actual: (recovery?.amounts?.other1 || 0) + (recovery?.amounts?.other2 || 0) + (recovery?.amounts?.other || 0),
          unpaid: 0,
          opening: 0,
          closing: 0,
        },
        charges: {
          prev: 0,
          curr: 0,
          total: dd.charges?.totalChargesDue || 0,
          actual: Object.values(dd.charges?.actualCharges || {}).reduce((sum, amount) => sum + (amount || 0), 0),
          unpaid: Math.max(0, (dd.charges?.totalChargesDue || 0) - (dd.charges?.totalChargesPaid || 0)),
          opening: 0,
          closing: 0,
          chargesDue: dd.charges?.chargesDue || {}, // Individual charges due
          actualCharges: dd.charges?.actualCharges || {}, // Individual charges paid
        },
      };
    }

    // Priority 2: Use demandDetails fetched from backend API (for display before saving)
    const backendDemandDetails = demandSummaries[memberId];
    if (backendDemandDetails) {
      const dd = backendDemandDetails;
      // Get remaining amounts from API (prefer remaining amounts over backend demandDetails for yogdan and overdueInterest)
      const remainingAmounts = memberLoanTotals[memberId] || {};
      const remainingYogdan = remainingAmounts.remainingYogdanAmount || 0;
      const remainingOverdueInterest = remainingAmounts.remainingOverdueInterestAmount || 0;

      // Get remaining revenue demands from MemberRevenueDemand API
      const revenueRemaining = memberRevenueRemaining[memberId] || {};

      return {
        saving: {
          prev: dd.saving?.prevDemand || 0,
          curr: dd.saving?.currDemand || 0,
          total: dd.saving?.totalDemand || 0,
          actual: recovery?.amounts?.saving || 0,
          unpaid: dd.saving?.unpaidDemand || 0,
          opening: dd.saving?.openingBalance || 0,
          closing: dd.saving?.closingBalance || 0,
        },
        loan: {
          prev: dd.loan?.prevDemand || 0,
          curr: dd.loan?.currDemand || 0,
          total: dd.loan?.totalDemand || 0,
          actual: recovery?.amounts?.loan || 0,
          unpaid: dd.loan?.unpaidDemand || 0,
          opening: dd.loan?.openingBalance || 0,
          closing: dd.loan?.closingBalance || 0,
        },
        interest: {
          prev: dd.interest?.prevDemand || 0,
          curr: dd.interest?.currDemand || 0,
          total: dd.interest?.totalDemand || 0,
          actual: dd.interest?.actualPaid || 0,
          unpaid: dd.interest?.unpaidDemand || 0,
          opening: dd.interest?.openingBalance || 0,
          closing: dd.interest?.closingBalance || 0,
        },
        fd: {
          prev: 0,
          curr: 0,
          total: 0,
          actual: recovery?.amounts?.fd || 0,
          unpaid: 0,
          opening: dd.fd?.openingBalance || 0,
          closing: dd.fd?.closingBalance || 0,
        },
        yogdan: {
          prev: dd.yogdan?.prevDemand || 0,
          curr: dd.yogdan?.currDemand || dd.yogdan?.totalDemand || 0,
          total: dd.yogdan?.totalDemand || 0,
          actual: recovery?.amounts?.yogdan || 0,
          unpaid: dd.yogdan?.unpaidDemand || 0,
          opening: dd.yogdan?.openingBalance || 0, // Opening balance is only cumulative payments, NOT openingYogdan
          closing: dd.yogdan?.closingBalance || (dd.yogdan?.openingBalance || 0) + (recovery?.amounts?.yogdan || 0),
        },
        memFeesSHG: {
          prev: 0,
          // Use remaining amount from MemberRevenueDemand API if available, otherwise use backend demandDetails
          curr: (revenueRemaining?.membershipFeesSHG?.remainingAmount || 0) > 0
            ? (revenueRemaining.membershipFeesSHG.remainingAmount)
            : (dd.membership?.membershipFeesDue || 0),
          total: (revenueRemaining?.membershipFeesSHG?.remainingAmount || 0) > 0
            ? (revenueRemaining.membershipFeesSHG.remainingAmount)
            : (dd.membership?.membershipFeesDue || 0),
          actual: dd.membership?.actualMemFeesSHG || 0,
          unpaid: (revenueRemaining?.membershipFeesSHG?.remainingAmount || 0) > 0
            ? Math.max(0, (revenueRemaining.membershipFeesSHG.remainingAmount) - (dd.membership?.actualMemFeesSHG || 0))
            : Math.max(0, (dd.membership?.membershipFeesDue || 0) - (dd.membership?.actualMemFeesSHG || 0)),
          opening: 0,
          closing: 0,
        },
        memFeesSamiti: {
          prev: 0,
          curr: 0,
          total: recovery?.amounts?.memFeesSamiti || 0,
          actual: recovery?.amounts?.memFeesSamiti || 0,
          unpaid: 0,
          opening: 0,
          closing: 0,
        },
        memFeesGroup: {
          prev: 0,
          // Use remaining amount from MemberRevenueDemand API if available, otherwise use backend demandDetails
          curr: (revenueRemaining?.membershipFeesGroup?.remainingAmount || 0) > 0
            ? (revenueRemaining.membershipFeesGroup.remainingAmount)
            : (dd.membership?.membershipGroupDue || 0),
          total: (revenueRemaining?.membershipFeesGroup?.remainingAmount || 0) > 0
            ? (revenueRemaining.membershipFeesGroup.remainingAmount)
            : (dd.membership?.membershipGroupDue || 0),
          actual: dd.membership?.actualMemFeesGroup || 0,
          unpaid: (revenueRemaining?.membershipFeesGroup?.remainingAmount || 0) > 0
            ? Math.max(0, (revenueRemaining.membershipFeesGroup.remainingAmount) - (dd.membership?.actualMemFeesGroup || 0))
            : Math.max(0, (dd.membership?.membershipGroupDue || 0) - (dd.membership?.actualMemFeesGroup || 0)),
          opening: 0,
          closing: 0,
        },
        penalty: {
          prev: 0,
          curr: 0,
          total: recovery?.amounts?.penalty || 0,
          actual: recovery?.amounts?.penalty || 0,
          unpaid: 0,
          opening: 0,
          closing: 0,
        },
        other: {
          prev: 0,
          curr: 0,
          total: (recovery?.amounts?.other1 || 0) + (recovery?.amounts?.other2 || 0) + (recovery?.amounts?.other || 0),
          actual: (recovery?.amounts?.other1 || 0) + (recovery?.amounts?.other2 || 0) + (recovery?.amounts?.other || 0),
          unpaid: 0,
          opening: 0,
          closing: 0,
        },
        charges: {
          prev: 0,
          curr: 0,
          total: dd.charges?.totalChargesDue || 0,
          actual: Object.values(recovery?.amounts?.charges || {}).reduce((sum, amount) => sum + (amount || 0), 0),
          unpaid: Math.max(0, (dd.charges?.totalChargesDue || 0) - (dd.charges?.totalChargesPaid || 0)),
          opening: 0,
          closing: 0,
          chargesDue: dd.charges?.chargesDue || {},
          actualCharges: recovery?.amounts?.charges || {},
        },
      };
    }

    // Priority 3: Calculate on frontend if demandDetails not available (fallback)
    const prevData = previousRecoveryData[memberId] || {
      loan: { unpaidDemand: 0, actualPaid: 0 },
      interest: { unpaidDemand: 0, actualPaid: 0 },
      saving: { unpaidDemand: 0, actualPaid: 0, totalDemand: 0 },
    };

    // Get active loan for member
    const activeLoan = activeLoans[memberId];
    const loanInstallment = activeLoan?.installment_amount || 0;

    // Get member data
    const openingSaving = member?.openingSaving || member?.raw?.openingSaving || 0;
    const openingLoan = member?.loanDetails?.amount || member?.raw?.loanDetails?.amount || 0;
    const openingFd = member?.fdDetails?.amount || member?.raw?.fdDetails?.amount || 0;

    // Get remaining amounts from API (prefer API data over member model)
    const remainingAmounts = memberLoanTotals[memberId] || {};
    const remainingYogdan = remainingAmounts.remainingYogdanAmount || 0;
    const remainingOverdueInterest = remainingAmounts.remainingOverdueInterestAmount || 0;

    // Fallback to member model if API data not available
    const openingYogdan = remainingAmounts.openingYogdan || member?.openingYogdan || member?.raw?.openingYogdan || 0;
    const openingInterest = remainingAmounts.openingOverdueInterest || member?.loanDetails?.overdueInterest || member?.raw?.loanDetails?.overdueInterest || 0;

    // Check if member is existing member
    const isExistingMember = member?.isExistingMember || member?.raw?.isExistingMember || false;

    // Current month demand for saving
    // For existing members, use snapshot if available, else use current group rate
    let savingDue = Number(activeGroup?.raw?.saving_per_member || activeGroup?.saving_per_member || 0) || 0;
    if (isExistingMember && member?.saving_per_member_snapshot) {
      savingDue = Number(member.saving_per_member_snapshot) || savingDue;
    }

    // Actual amounts received in this recovery
    const actualSaving = parseFloat(recovery?.amounts?.saving || 0) || 0;
    const actualLoan = parseFloat(recovery?.amounts?.loan || 0) || 0;
    const actualFd = parseFloat(recovery?.amounts?.fd || 0) || 0;
    const actualInterest = parseFloat(recovery?.amounts?.interest || 0) || 0;
    const actualYogdan = parseFloat(recovery?.amounts?.yogdan || 0) || 0;
    const actualMemFeesSHG = parseFloat(recovery?.amounts?.memFeesSHG || 0) || 0;
    const actualMemFeesSamiti = parseFloat(recovery?.amounts?.memFeesSamiti || 0) || 0;
    const actualMemFeesGroup = parseFloat(recovery?.amounts?.memFeesGroup || 0) || 0;
    const actualPenalty = parseFloat(recovery?.amounts?.penalty || 0) || 0;
    const actualOther = (parseFloat(recovery?.amounts?.other1 || 0) || 0) +
      (parseFloat(recovery?.amounts?.other2 || 0) || 0) +
      (parseFloat(recovery?.amounts?.other || 0) || 0);
    const actualCharges = recovery?.amounts?.charges || {};
    const chargesDue = recovery?.demandDetails?.charges?.chargesDue || {};

    // Calculate loan demand details
    // Get monthly installment amount
    let monthlyInstallment = loanInstallment;

    // For existing members, use member's loanDetails if activeLoan not found
    if (!activeLoan && openingLoan > 0) {
      // Try to get installment from member's loanDetails
      const memberInstallment = member?.loanDetails?.installment_amount || member?.raw?.loanDetails?.installment_amount;
      if (memberInstallment) {
        monthlyInstallment = parseFloat(memberInstallment) || 0;
      } else if (member?.loanDetails?.time_period || member?.raw?.loanDetails?.time_period) {
        // Calculate from amount and time_period: monthly installment = loan_amount / time_period
        const timePeriod = member?.loanDetails?.time_period || member?.raw?.loanDetails?.time_period || 0;
        if (timePeriod > 0) {
          monthlyInstallment = openingLoan / timePeriod;
        }
      }
    }

    // Check if group has 2 meetings per month
    const meetingDay1 = activeGroup?.raw?.meeting_date_1_day || activeGroup?.meeting_date_1_day;
    const meetingDay2 = activeGroup?.raw?.meeting_date_2_day || activeGroup?.meeting_date_2_day;
    const hasTwoMeetings = meetingDay1 && meetingDay2;

    // If 2 meetings per month, divide monthly installment by 2 for each meeting
    const loanCurrDemand = hasTwoMeetings ? (monthlyInstallment / 2) : monthlyInstallment;

    const loanPrevDemand = prevData.loan.unpaidDemand || 0;
    const loanTotalDemand = loanPrevDemand + loanCurrDemand;
    const loanUnpaidDemand = Math.max(0, loanTotalDemand - actualLoan);
    // Opening balance = cumulative loan payments (simplified - would need to query all previous recoveries)
    const loanOpeningBalance = 0; // Will be calculated by backend
    const loanClosingBalance = loanOpeningBalance + actualLoan;

    // Interest calculation - use remaining overdueInterest from API
    // For existing members: overdueInterest is one-time until paid
    // Get remaining overdueInterest from memberLoanTotals (calculated from opening - recovered)
    const remainingOverdueInterestForInterest = memberLoanTotals[memberId]?.remainingOverdueInterestAmount || 0;
    const interestPrevDemand = prevData.interest.unpaidDemand || 0;
    // Current demand = remaining overdueInterest (if not yet paid)
    const interestCurrDemand = remainingOverdueInterestForInterest > 0 ? remainingOverdueInterestForInterest : 0;
    const interestTotalDemand = interestPrevDemand + interestCurrDemand;
    const interestUnpaidDemand = Math.max(0, interestTotalDemand - actualInterest);
    const interestOpeningBalance = 0; // Will be calculated by backend
    const interestClosingBalance = interestOpeningBalance + actualInterest;

    // Calculate saving demand details
    // If previous month paid more than demand, previous demand = 0
    let savingPrevDemand = 0;
    if (prevData.saving.actualPaid > prevData.saving.totalDemand) {
      savingPrevDemand = 0;
    } else {
      savingPrevDemand = prevData.saving.unpaidDemand || 0;
    }
    const savingCurrDemand = savingDue;
    const savingTotalDemand = savingPrevDemand + savingCurrDemand;
    const savingUnpaidDemand = Math.max(0, savingTotalDemand - actualSaving);
    const savingOpeningBalance = openingSaving; // Simplified - backend will calculate cumulative
    const savingClosingBalance = savingOpeningBalance + actualSaving;

    // Calculate membership fees due (April-to-April cycle)
    let membershipFeesDue = 0;
    let membershipGroupDue = 0;
    if (activeGroup && member) {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth(); // 0-indexed (0 = January, 3 = April)
      const APRIL_MONTH = 3;
      const currentApril1 = new Date(currentYear, APRIL_MONTH, 1);

      const joinDate = member.Dt_Join || member.Member_Dt || member.createdAt;
      const joinYear = joinDate ? new Date(joinDate).getFullYear() : currentYear;
      const joinMonth = joinDate ? new Date(joinDate).getMonth() : currentMonth;

      const lastMembershipPaidDate = member.lastMembershipPaidDate ? new Date(member.lastMembershipPaidDate) : null;
      const lastMembershipGroupPaidDate = member.lastMembershipGroupPaidDate ? new Date(member.lastMembershipGroupPaidDate) : null;

      const membershipFees = activeGroup?.raw?.membership_fees || activeGroup?.membership_fees || 0;
      const membershipGroup = activeGroup?.raw?.Mship_Group || activeGroup?.Mship_Group || 0;

      const isApril = currentMonth === APRIL_MONTH;

      if (isApril) {
        // In April, all members pay for next year
        membershipFeesDue = membershipFees;
        membershipGroupDue = membershipGroup;
      } else {
        // Not April - check if member needs to pay
        if (!lastMembershipPaidDate || lastMembershipPaidDate < currentApril1) {
          if (joinYear < currentYear || (joinYear === currentYear && joinMonth < APRIL_MONTH)) {
            membershipFeesDue = membershipFees;
          } else if (joinYear === currentYear && joinMonth >= APRIL_MONTH) {
            membershipFeesDue = membershipFees;
          }
        }
        if (!lastMembershipGroupPaidDate || lastMembershipGroupPaidDate < currentApril1) {
          if (joinYear < currentYear || (joinYear === currentYear && joinMonth < APRIL_MONTH)) {
            membershipGroupDue = membershipGroup;
          } else if (joinYear === currentYear && joinMonth >= APRIL_MONTH) {
            membershipGroupDue = membershipGroup;
          }
        }
      }
    }

    return {
      saving: {
        prev: savingPrevDemand,
        curr: savingCurrDemand,
        total: savingTotalDemand,
        actual: actualSaving,
        unpaid: savingUnpaidDemand,
        opening: savingOpeningBalance,
        closing: savingClosingBalance,
      },
      loan: {
        prev: loanPrevDemand,
        curr: loanCurrDemand,
        total: loanTotalDemand,
        actual: actualLoan,
        unpaid: loanUnpaidDemand,
        opening: loanOpeningBalance,
        closing: loanClosingBalance,
      },
      interest: {
        prev: interestPrevDemand,
        curr: interestCurrDemand,
        // Use remaining overdue interest from API if available
        total: remainingOverdueInterestForInterest > 0 ? remainingOverdueInterestForInterest : interestTotalDemand,
        actual: actualInterest,
        unpaid: remainingOverdueInterestForInterest > 0 ? Math.max(0, remainingOverdueInterestForInterest - actualInterest) : interestUnpaidDemand,
        opening: interestOpeningBalance,
        closing: interestClosingBalance,
      },
      fd: {
        prev: 0,
        curr: 0,
        total: 0, // FD doesn't have recurring demand, but can be added during recovery
        actual: actualFd,
        unpaid: 0,
        opening: openingFd,
        closing: openingFd + actualFd,
      },
      yogdan: {
        prev: 0,
        // Use remaining yogdan amount from API
        curr: remainingYogdan,
        total: remainingYogdan,
        actual: actualYogdan,
        unpaid: Math.max(0, remainingYogdan - actualYogdan),
        opening: openingYogdan, // Opening balance = openingYogdan from member model
        closing: (remainingAmounts.totalYogdanRecovered || 0) + actualYogdan, // Closing = total recovered + actual paid
      },
      memFeesSHG: {
        prev: 0,
        // Use remaining amount from MemberRevenueDemand API if available, otherwise use calculated membershipFeesDue
        curr: (memberRevenueRemaining[memberId]?.membershipFeesSHG?.remainingAmount || 0) > 0
          ? (memberRevenueRemaining[memberId].membershipFeesSHG.remainingAmount)
          : membershipFeesDue,
        total: (memberRevenueRemaining[memberId]?.membershipFeesSHG?.remainingAmount || 0) > 0
          ? (memberRevenueRemaining[memberId].membershipFeesSHG.remainingAmount)
          : membershipFeesDue,
        actual: actualMemFeesSHG,
        unpaid: (memberRevenueRemaining[memberId]?.membershipFeesSHG?.remainingAmount || 0) > 0
          ? Math.max(0, (memberRevenueRemaining[memberId].membershipFeesSHG.remainingAmount) - actualMemFeesSHG)
          : Math.max(0, membershipFeesDue - actualMemFeesSHG),
        opening: 0,
        closing: 0,
      },
      memFeesSamiti: {
        prev: 0,
        curr: 0,
        total: actualMemFeesSamiti,
        actual: actualMemFeesSamiti,
        unpaid: 0,
        opening: 0,
        closing: 0,
      },
      memFeesGroup: {
        prev: 0,
        // Use remaining amount from MemberRevenueDemand API if available, otherwise use calculated membershipGroupDue
        curr: (memberRevenueRemaining[memberId]?.membershipFeesGroup?.remainingAmount || 0) > 0
          ? (memberRevenueRemaining[memberId].membershipFeesGroup.remainingAmount)
          : membershipGroupDue,
        total: (memberRevenueRemaining[memberId]?.membershipFeesGroup?.remainingAmount || 0) > 0
          ? (memberRevenueRemaining[memberId].membershipFeesGroup.remainingAmount)
          : membershipGroupDue,
        actual: actualMemFeesGroup,
        unpaid: (memberRevenueRemaining[memberId]?.membershipFeesGroup?.remainingAmount || 0) > 0
          ? Math.max(0, (memberRevenueRemaining[memberId].membershipFeesGroup.remainingAmount) - actualMemFeesGroup)
          : Math.max(0, membershipGroupDue - actualMemFeesGroup),
        opening: 0,
        closing: 0,
      },
      penalty: {
        prev: 0,
        curr: 0,
        total: actualPenalty,
        actual: actualPenalty,
        unpaid: 0,
        opening: 0,
        closing: 0,
      },
      other: {
        prev: 0,
        curr: 0,
        total: actualOther,
        actual: actualOther,
        unpaid: 0,
        opening: 0,
        closing: 0,
      },
      charges: {
        prev: 0,
        curr: 0,
        total: Object.values(chargesDue).reduce((sum, amount) => sum + (amount || 0), 0),
        actual: Object.values(actualCharges).reduce((sum, amount) => sum + (amount || 0), 0),
        unpaid: Math.max(0, Object.values(chargesDue).reduce((sum, amount) => sum + (amount || 0), 0) - Object.values(actualCharges).reduce((sum, amount) => sum + (amount || 0), 0)),
        opening: 0,
        closing: 0,
        chargesDue: chargesDue, // Individual charges due (from backend)
        actualCharges: actualCharges, // Individual charges paid
      },
    };
  };

  // Admin mode: load groups list dynamically
  useEffect(() => {
    if (!isAdminMode) return;
    setGroupsLoading(true);
    getGroups()
      .then((res) => {
        const list = Array.isArray(res?.data) ? res.data : [];
        setGroups(
          list.map((g) => ({
            id: g._id,
            code: g.group_code,
            name: g.group_name,
            village: g.village,
            cluster_name: g.cluster_name,
            cluster_code: g.cluster_code,
            memberCount: g.memberCount ?? g.no_members ?? 0,
            raw: g,
          }))
        );
      })
      .catch((e) => {
        console.error("Failed to load groups:", e);
        setGroups([]);
      })
      .finally(() => setGroupsLoading(false));
  }, [isAdminMode]);

  // Initialize members from active group (dynamic)
  useEffect(() => {
    if (!activeGroup?.id) {
      setAllMembers([]);
      return;
    }
    getMembersByGroup(activeGroup.id)
      .then((res) => {
        const list = Array.isArray(res?.data) ? res.data : [];
        setAllMembers(
          list.map((m) => ({
            id: m._id,
            code: m.Member_Id,
            name: m.Member_Nm,
            raw: m, // Store full member data to access financial details
            openingSaving: m.openingSaving || 0,
            loanDetails: m.loanDetails || {},
            fdDetails: m.fdDetails || {},
            openingYogdan: m.openingYogdan || 0,
            isExistingMember: m.isExistingMember || false,
          }))
        );
      })
      .catch((e) => {
        console.error("Failed to load members:", e);
        setAllMembers([]);
      });
  }, [activeGroup?.id]);

  // Load recoveries when group is loaded
  useEffect(() => {
    if (activeGroup) {
      loadRecoveries();
    }
  }, [activeGroup?.id]);

  // Load group banks when active group changes
  useEffect(() => {
    const groupId = activeGroup?.id;
    if (!groupId) {
      setGroupBanks([]);
      setSelectedBankId("");
      return;
    }
    getGroupBanks(groupId)
      .then((res) => {
        const banks = Array.isArray(res?.data) ? res.data : [];
        setGroupBanks(banks);
      })
      .catch((e) => {
        console.error("Error loading banks:", e);
        setGroupBanks([]);
      });
  }, [activeGroup?.id]);

  const loadRecoveries = async () => {
    if (!activeGroup?.id) return;

    try {
      setLoading(true);
      const today = new Date().toLocaleDateString("en-GB");
      const response = await getRecoveryByDate(activeGroup.id, today);

      if (response?.success && response?.data?.recoveries) {
        // Convert backend format (recoveries array) to frontend format (flat array)
        const memberRecoveries = response.data.recoveries.map(rec => ({
          ...rec,
          id: rec.memberId, // Use memberId as id for compatibility
        }));
        setRecoveries(memberRecoveries);
      } else {
        setRecoveries([]);
      }
    } catch (error) {
      console.error("Error loading recoveries:", error);
      setRecoveries([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle group selection (for admin)
  const handleSelectGroup = (group) => {
    setSelectedGroup(group);
    setCurrentStep(1);
    setRecoveries([]);
    setCurrentMemberIndex(0);
    resetForm();
  };

  // Get current member
  const currentMember = allMembers[currentMemberIndex];
  const currentMemberRecovery = recoveries.find(
    (r) => r.memberId === currentMember?.id
  );
  const currentMemberSummary = currentMember ? getDemandSummary(currentMember.id) : null;

  // Get recovery status for current member
  const currentMemberRecoveryStatus = currentMember ? memberRecoveryStatus[currentMember.id] : null;
  const isAlreadyRecovered = currentMemberRecoveryStatus?.recoveredToday || false;

  // Validation handler for amount fields (prevents entering more than due amount)
  const handleAmountChange = (fieldName, value) => {
    const numValue = parseFloat(value) || 0;
    // Get max allowed value from currentMemberSummary (total due)
    const maxValue = currentMemberSummary?.[fieldName]?.total || 0;

    // For saving field, allow any value (no max restriction)
    if (fieldName === 'saving') {
      setAmountBreakup({ ...amountBreakup, [fieldName]: value });
      setAutoCalculated(false);
      return;
    }

    // For other fields, restrict to max value (total due)
    if (value === '' || value === null || value === undefined) {
      setAmountBreakup({ ...amountBreakup, [fieldName]: value });
      setAutoCalculated(false);
    } else if (numValue <= maxValue) {
      setAmountBreakup({ ...amountBreakup, [fieldName]: value });
      setAutoCalculated(false);
    } else {
      // Show alert if exceeds max
      alert(`Amount cannot exceed the due amount of ₹${maxValue.toLocaleString()}`);
      // Set to max value
      setAmountBreakup({ ...amountBreakup, [fieldName]: maxValue.toString() });
      setAutoCalculated(false);
    }
  };

  // Check if all members have recovery (including absent without recovery)
  const allMembersProcessed = allMembers.every((member) => {
    const recovery = recoveries.find((r) => r.memberId === member.id);
    // Member is processed if they have recovery OR marked as absent without recovery
    return recovery !== undefined;
  });

  // Calculate totals
  const calculateTotals = () => {
    let totalCash = 0;
    let totalOnline = 0;
    let totalAmount = 0;

    recoveries.forEach((recovery) => {
      // Only count if member is present or absent with recovery by other
      if (recovery.attendance === "present" || (recovery.attendance === "absent" && recovery.recoveryByOther)) {
        const saving = parseFloat(recovery.amounts?.saving || 0);
        const loan = parseFloat(recovery.amounts?.loan || 0);
        const fd = parseFloat(recovery.amounts?.fd || 0);
        const interest = parseFloat(recovery.amounts?.interest || 0);
        const yogdan = parseFloat(recovery.amounts?.yogdan || 0);
        const memFeesSHG = parseFloat(recovery.amounts?.memFeesSHG || 0);
        const memFeesSamiti = parseFloat(recovery.amounts?.memFeesSamiti || 0);
        const memFeesGroup = parseFloat(recovery.amounts?.memFeesGroup || 0);
        const penalty = parseFloat(recovery.amounts?.penalty || 0);
        const other = (parseFloat(recovery.amounts?.other1 || 0) || 0) +
          (parseFloat(recovery.amounts?.other2 || 0) || 0) +
          (parseFloat(recovery.amounts?.other || 0) || 0);
        const chargesTotal = recovery.amounts?.charges ?
          Object.values(recovery.amounts.charges).reduce((sum, amount) => sum + (parseFloat(amount) || 0), 0) : 0;
        const memberTotal = saving + loan + fd + interest + yogdan + memFeesSHG + memFeesSamiti + memFeesGroup + penalty + other + chargesTotal;

        totalAmount += memberTotal;

        if (recovery.paymentMode?.cash) {
          totalCash += memberTotal;
        }
        if (recovery.paymentMode?.online) {
          totalOnline += memberTotal;
        }
      }
    });

    return { totalCash, totalOnline, totalAmount };
  };

  const totals = calculateTotals();

  // Reset form
  const resetForm = () => {
    setAttendance("present");
    setRecoveryByOther(false);
    setOtherMemberId("");
    setAmountBreakup({
      saving: "",
      loan: "",
      interest: "",
      yogdan: "",
      memFeesSHG: "",
      memFeesSamiti: "",
      memFeesGroup: "",
      penalty: "",
      other: "",
      fd: "",
      charges: {},
    });
    setTotalAmount("");
    setAutoCalculated(false);
    setFdTimePeriod("");
    setPaymentMode({ cash: false, online: false });
    setOnlineRef("");
    setSelectedBankId("");
    setScreenshot(null);
  };

  // Auto-calculate amounts from total
  const handleTotalAmountChange = (value) => {
    setTotalAmount(value);
    const total = parseFloat(value) || 0;

    if (total > 0) {
      // Get current member's demands
      const summary = currentMember ? getDemandSummary(currentMember.id) : null;
      const savingDue = parseFloat(summary?.saving?.total || 0) || 0;
      const loanDue = parseFloat(summary?.loan?.total || 0) || 0;
      const interestDue = parseFloat(summary?.interest?.total || 0) || 0;
      // Yogdan demand from backend (only from demandDetails, not frontend calculation)
      const yogdanDue = parseFloat(summary?.yogdan?.total || summary?.yogdan?.unpaid || 0) || 0;
      const membershipFeesDue = parseFloat(summary?.memFeesSHG?.curr || 0) || 0; // Current month membership fees due
      const membershipGroupDue = parseFloat(summary?.memFeesGroup?.curr || 0) || 0; // Current month membership group due

      // Priority order: 
      // 1. Yogdan (1% of loan amount - when loan is given) - FIRST PRIORITY
      // 1. Mem. Fees Group (Yearly)
      // 1. Mem. Fees SHG (Yearly)
      // 1. Mem. Fees Samiti (Yearly)
      // 2. Int on loan
      // 3. Saving
      // 4. Loan
      // 5. FD
      // Penalty, Other-1, Other-2 (if present)
      // If extra remains, add to Saving
      let remaining = total;
      const calculated = {
        saving: "",
        loan: "",
        interest: "",
        yogdan: "",
        memFeesSHG: "",
        memFeesSamiti: "",
        memFeesGroup: "",
        penalty: "",
        other: "",
        fd: "",
        charges: {},
      };

      // Get charges due
      const chargesDue = summary?.charges?.chargesDue || {};

      // Priority 1: Yogdan (1% of loan amount - when loan is given) - FIRST PRIORITY
      // Yogdan should be paid first when entering total amount
      // Only use backend demand details (from getDemandSummary), not frontend calculations
      if (yogdanDue > 0 && remaining > 0) {
        const yogdanAmount = Math.min(yogdanDue, remaining);
        calculated.yogdan = yogdanAmount.toFixed(2);
        remaining -= yogdanAmount;
      }

      // Priority 1: Mem. Fees Group (Yearly) - FIRST PRIORITY - if due
      if (membershipGroupDue > 0 && remaining > 0) {
        const memGroupAmount = Math.min(membershipGroupDue, remaining);
        calculated.memFeesGroup = memGroupAmount.toFixed(2);
        remaining -= memGroupAmount;
      }

      // Priority 1: Mem. Fees SHG (Yearly) - if due
      if (membershipFeesDue > 0 && remaining > 0) {
        const memFeesAmount = Math.min(membershipFeesDue, remaining);
        calculated.memFeesSHG = memFeesAmount.toFixed(2);
        remaining -= memFeesAmount;
      }

      // Priority 1: Mem. Fees Samiti (Yearly) - if due
      const memFeesSamitiDue = parseFloat(summary?.memFeesSamiti?.curr || 0) || 0;
      if (memFeesSamitiDue > 0 && remaining > 0) {
        const memFeesSamitiAmount = Math.min(memFeesSamitiDue, remaining);
        calculated.memFeesSamiti = memFeesSamitiAmount.toFixed(2);
        remaining -= memFeesSamitiAmount;
      }

      // Priority 1: Charges (if due)
      if (Object.keys(chargesDue).length > 0 && remaining > 0) {
        const calculatedCharges = {};
        Object.keys(chargesDue).forEach(chargeName => {
          const chargeDue = parseFloat(chargesDue[chargeName]) || 0;
          if (chargeDue > 0 && remaining > 0) {
            const chargeAmount = Math.min(chargeDue, remaining);
            calculatedCharges[chargeName] = chargeAmount.toFixed(2);
            remaining -= chargeAmount;
          }
        });
        calculated.charges = calculatedCharges;
      }

      // Priority 2: Int on loan (if due)
      if (interestDue > 0 && remaining > 0) {
        const interestAmount = Math.min(interestDue, remaining);
        calculated.interest = interestAmount.toFixed(2);
        remaining -= interestAmount;
      }

      // Priority 3: Saving (if due)
      if (savingDue > 0 && remaining > 0) {
        const savingAmount = Math.min(savingDue, remaining);
        calculated.saving = savingAmount.toFixed(2);
        remaining -= savingAmount;
      }

      // Priority 4: Loan (if due and not fully paid)
      // Check if loan is fully paid using loan totals from LoanMaster and RecoveryMaster
      const currentMemberLoanTotals = currentMember ? memberLoanTotals[currentMember.id] : null;
      const isLoanFullyPaid = currentMemberLoanTotals
        ? (currentMemberLoanTotals.remainingLoanAmount <= 0 || currentMemberLoanTotals.totalLoanRecovered >= currentMemberLoanTotals.totalLoanAmount)
        : false;

      if (loanDue > 0 && remaining > 0 && !isLoanFullyPaid) {
        const loanAmount = Math.min(loanDue, remaining);
        calculated.loan = loanAmount.toFixed(2);
        remaining -= loanAmount;
      }

      // Priority 5: FD (if due)
      const fdDue = parseFloat(summary?.fd?.total || 0) || 0;
      if (fdDue > 0 && remaining > 0) {
        const fdAmount = Math.min(fdDue, remaining);
        calculated.fd = fdAmount.toFixed(2);
        remaining -= fdAmount;
      }

      // Penalty (if present/due)
      const penaltyDue = parseFloat(summary?.penalty?.total || 0) || 0;
      if (penaltyDue > 0 && remaining > 0) {
        const penaltyAmount = Math.min(penaltyDue, remaining);
        calculated.penalty = penaltyAmount.toFixed(2);
        remaining -= penaltyAmount;
      }

      // Other-1 and Other-2 (if present)
      // Note: These are typically optional and don't have demands, so we skip them in auto-calculation

      // If there's remaining money after meeting all demands, add to Saving
      if (remaining > 0) {
        const currentSaving = parseFloat(calculated.saving) || 0;
        calculated.saving = (currentSaving + remaining).toFixed(2);
      }

      setAmountBreakup(calculated);
      setAutoCalculated(true);
    } else {
      // Clear all if total is 0 or empty
      setAmountBreakup({
        saving: "",
        loan: "",
        interest: "",
        yogdan: "",
        memFeesSHG: "",
        memFeesSamiti: "",
        memFeesGroup: "",
        penalty: "",
        other: "",
        fd: "",
        charges: {},
      });
      setAutoCalculated(false);
    }
  };

  // Handle attendance change
  const handleAttendanceChange = (value) => {
    setAttendance(value);
    if (value === "present") {
      setRecoveryByOther(false);
      setOtherMemberId("");
    }
  };

  // Toggle amount fields
  const [activeAmountFields, setActiveAmountFields] = useState({
    loan: false,
    fd: false,
    interest: false,
    yogdan: false,
    other: false,
  });

  const toggleAmountField = (field) => {
    setActiveAmountFields({
      ...activeAmountFields,
      [field]: !activeAmountFields[field],
    });
  };

  // Handle payment mode - only one selection allowed (cash OR online)
  const handlePaymentModeChange = (mode) => {
    if (mode === "cash") {
      setPaymentMode({ cash: true, online: false });
      setSelectedBankId(""); // Clear bank selection when switching to cash
      setOnlineRef(""); // Clear online ref
    } else if (mode === "online") {
      setPaymentMode({ cash: false, online: true });
    }
  };

  // Handle full loan recovery payment mode
  const handleFullLoanRecoveryPaymentMode = (mode) => {
    if (mode === "cash") {
      setFullLoanRecoveryPaymentMode({ cash: true, online: false });
      setFullLoanRecoveryBankId(""); // Clear bank selection when switching to cash
      setFullLoanRecoveryOnlineRef(""); // Clear online ref
    } else if (mode === "online") {
      setFullLoanRecoveryPaymentMode({ cash: false, online: true });
    }
  };

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshot(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle full loan recovery file upload
  const handleFullLoanRecoveryFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFullLoanRecoveryScreenshot(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };


  // Handle photo capture
  const handleCapturePhoto = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setGroupPhoto(reader.result);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  // Save current member recovery
  const handleSaveRecovery = async () => {
    // Check if already recovered
    if (isAlreadyRecovered) {
      alert("Demand for this member has already been recovered today.");
      return;
    }

    // Validate activeGroup exists
    if (!activeGroup || !activeGroup.id) {
      alert("Group information is missing. Please select a group.");
      return;
    }

    // If absent and no recovery by other, save as absent without recovery
    if (attendance === "absent" && !recoveryByOther) {
      try {
        setLoading(true);
        const today = new Date().toLocaleDateString("en-GB");
        await updateMemberRecovery(activeGroup.id, today, {
          memberId: currentMember.id,
          memberCode: currentMember.code,
          memberName: currentMember.name,
          attendance: "absent",
          recoveryByOther: false,
          otherMemberId: null,
          amounts: {
            saving: 0,
            loan: 0,
            fd: 0,
            interest: 0,
            yogdan: 0,
            memFeesSHG: 0,
            memFeesSamiti: 0,
            penalty: 0,
            other: 0,
          },
          paymentMode: { cash: false, online: false },
        });
        await loadRecoveries();

        // Move to next member or summary
        if (currentMemberIndex < allMembers.length - 1) {
          setCurrentMemberIndex(currentMemberIndex + 1);
          resetForm();
        } else {
          setCurrentStep(2);
        }
        return;
      } catch (error) {
        console.error("Error saving recovery:", error);
        alert(error?.response?.data?.message || error?.message || "Error saving record");
      } finally {
        setLoading(false);
      }
      return;
    }

    // For present members or absent with recovery by other
    if (!paymentMode.cash && !paymentMode.online) {
      alert("Please select payment mode");
      return;
    }

    if (paymentMode.online && !onlineRef.trim()) {
      alert("Please enter online payment reference number");
      return;
    }

    if (paymentMode.online && !selectedBankId) {
      alert("Please select a bank for online payment");
      return;
    }

    const saving = parseFloat(amountBreakup.saving) || 0;
    const loan = parseFloat(amountBreakup.loan) || 0;
    const fd = parseFloat(amountBreakup.fd) || 0;
    const interest = parseFloat(amountBreakup.interest) || 0;
    const yogdan = parseFloat(amountBreakup.yogdan) || 0;
    const memFeesSHG = parseFloat(amountBreakup.memFeesSHG) || 0;
    const memFeesSamiti = parseFloat(amountBreakup.memFeesSamiti) || 0;
    const memFeesGroup = parseFloat(amountBreakup.memFeesGroup) || 0;
    const penalty = parseFloat(amountBreakup.penalty) || 0;
    const other = parseFloat(amountBreakup.other) || 0;
    const chargesTotal = amountBreakup.charges ?
      Object.values(amountBreakup.charges).reduce((sum, amount) => sum + (parseFloat(amount) || 0), 0) : 0;
    const total = saving + loan + fd + interest + yogdan + memFeesSHG + memFeesSamiti + memFeesGroup + penalty + other + chargesTotal;

    if (total === 0) {
      alert("Please enter at least one amount");
      return;
    }

    try {
      // Get opening FD to determine if this is a new FD
      const openingFd = currentMember?.fdDetails?.amount || currentMember?.raw?.fdDetails?.amount || 0;
      const isNewFd = openingFd === 0 && fd > 0;

      // Get FD rate snapshot from group if creating new FD
      const fdRateSnapshot = isNewFd ? (activeGroup?.raw?.fd_rate || activeGroup?.fd_rate || null) : null;

      const today = new Date().toLocaleDateString("en-GB");

      const memberRecovery = {
        memberId: currentMember.id,
        memberCode: currentMember.code,
        memberName: currentMember.name,
        attendance,
        recoveryByOther,
        otherMemberId: recoveryByOther ? otherMemberId : null,
        amounts: {
          saving,
          loan,
          fd,
          interest,
          yogdan,
          memFeesSHG,
          memFeesSamiti,
          memFeesGroup,
          penalty,
          other,
          charges: amountBreakup.charges || {},
        },
        // Convert years to months for storage
        fd_time_period: isNewFd && fdTimePeriod ? Math.round(parseFloat(fdTimePeriod) * 12) : null,
        fd_rate_snapshot: fdRateSnapshot,
        paymentMode,
        onlineRef: paymentMode.online ? onlineRef : null,
        bankId: paymentMode.online ? selectedBankId : null,
        screenshot: screenshot || null,
      };

      console.log("[DEMAND_RECOVERY] Saving member recovery:", {
        memberId: memberRecovery.memberId,
        memberCode: memberRecovery.memberCode,
        memberName: memberRecovery.memberName,
        amounts: memberRecovery.amounts,
        total: memberRecovery.total,
        paymentMode: memberRecovery.paymentMode,
      });
      await updateMemberRecovery(activeGroup.id, today, memberRecovery);
      await loadRecoveries();

      // Move to next member or summary
      if (currentMemberIndex < allMembers.length - 1) {
        setCurrentMemberIndex(currentMemberIndex + 1);
        resetForm();
      } else {
        setCurrentStep(2);
      }
    } catch (error) {
      console.error("Error saving recovery:", error);
      alert("Error saving record");
    }
  };

  // Fetch loan totals when modal opens
  useEffect(() => {
    if (showFullLoanRecovery && activeGroup?.id && currentMember?.id) {
      setLoadingLoanTotals(true);
      getMemberLoanTotals(activeGroup.id, currentMember.id)
        .then((res) => {
          if (res?.success && res?.data) {
            setLoanTotals({
              totalLoanAmount: res.data.totalLoanAmount || 0,
              totalLoanRecovered: res.data.totalLoanRecovered || 0,
              remainingLoanAmount: res.data.remainingLoanAmount || 0,
            });
          }
        })
        .catch((err) => {
          console.error("Error loading loan totals:", err);
          setLoanTotals({ totalLoanAmount: 0, totalLoanRecovered: 0, remainingLoanAmount: 0 });
        })
        .finally(() => {
          setLoadingLoanTotals(false);
        });
    }
  }, [showFullLoanRecovery, activeGroup?.id, currentMember?.id]);

  // Handle full loan recovery submission
  const handleFullLoanRecovery = async () => {
    if (!activeGroup || !activeGroup.id) {
      alert("Group information is missing. Please select a group.");
      return;
    }

    if (!currentMember) {
      alert("Member information is missing.");
      return;
    }

    // Validate payment mode
    if (!fullLoanRecoveryPaymentMode.cash && !fullLoanRecoveryPaymentMode.online) {
      alert("Please select payment mode");
      return;
    }

    if (fullLoanRecoveryPaymentMode.online && !fullLoanRecoveryOnlineRef.trim()) {
      alert("Please enter online payment reference number");
      return;
    }

    if (fullLoanRecoveryPaymentMode.online && !fullLoanRecoveryBankId) {
      alert("Please select a bank for online payment");
      return;
    }

    // Use remaining loan amount from loan totals (calculated from LoanMaster and RecoveryMaster)
    const remainingLoanAmount = loanTotals.remainingLoanAmount || 0;
    if (remainingLoanAmount <= 0) {
      alert("No remaining loan amount to recover.");
      setShowFullLoanRecovery(false);
      return;
    }

    try {
      setLoading(true);
      const today = new Date().toLocaleDateString("en-GB");

      // Create recovery with full remaining loan amount
      const memberRecovery = {
        memberId: currentMember.id,
        memberCode: currentMember.code,
        memberName: currentMember.name,
        attendance: "present",
        recoveryByOther: false,
        otherMemberId: null,
        amounts: {
          saving: 0,
          loan: remainingLoanAmount, // Full remaining loan amount
          fd: 0,
          interest: 0,
          yogdan: 0,
          memFeesSHG: 0,
          memFeesSamiti: 0,
          memFeesGroup: 0,
          penalty: 0,
          other: 0,
          charges: {},
        },
        paymentMode: fullLoanRecoveryPaymentMode,
        onlineRef: fullLoanRecoveryPaymentMode.online ? fullLoanRecoveryOnlineRef : null,
        bankId: fullLoanRecoveryPaymentMode.online ? fullLoanRecoveryBankId : null,
        screenshot: fullLoanRecoveryScreenshot || null,
      };

      console.log("[FULL_LOAN_RECOVERY] Saving full loan recovery:", {
        memberId: memberRecovery.memberId,
        memberCode: memberRecovery.memberCode,
        loanAmount: remainingLoanAmount,
        paymentMode: memberRecovery.paymentMode,
      });

      await updateMemberRecovery(activeGroup.id, today, memberRecovery);
      await loadRecoveries();

      // Close modal and reset form
      setShowFullLoanRecovery(false);
      setFullLoanRecoveryPaymentMode({ cash: false, online: false });
      setFullLoanRecoveryBankId("");
      setFullLoanRecoveryOnlineRef("");
      setFullLoanRecoveryScreenshot(null);

      alert(`Full loan recovery of ₹${remainingLoanAmount.toLocaleString()} saved successfully!`);

      // Reload to refresh demand details
      const todayStr = new Date().toLocaleDateString("en-GB");
      getDemandDetails(activeGroup.id, currentMember.id, todayStr)
        .then((res) => {
          if (res?.success && res?.data) {
            setDemandSummaries(prev => ({
              ...prev,
              [currentMember.id]: res.data
            }));
          }
        })
        .catch((err) => {
          console.error("Error reloading demand details:", err);
        });
    } catch (error) {
      console.error("Error saving full loan recovery:", error);
      alert(error?.response?.data?.message || error?.message || "Error saving full loan recovery");
    } finally {
      setLoading(false);
    }
  };

  // Save group photo and finalize
  const handleFinalize = async () => {
    if (!groupPhoto) {
      alert("Please take group photo");
      return;
    }

    try {
      setLoading(true);
      const today = new Date().toLocaleDateString("en-GB");

      // Validate cash denominations if totalCash > 0
      if (totals.totalCash > 0) {
        const calculatedTotal = (parseFloat(cashDenominations.note200) || 0) * 200 +
          (parseFloat(cashDenominations.note500) || 0) * 500 +
          (parseFloat(cashDenominations.note100) || 0) * 100 +
          (parseFloat(cashDenominations.note50) || 0) * 50 +
          (parseFloat(cashDenominations.note20) || 0) * 20 +
          (parseFloat(cashDenominations.note10) || 0) * 10 +
          (parseFloat(cashDenominations.note5) || 0) * 5 +
          (parseFloat(cashDenominations.note2) || 0) * 2 +
          (parseFloat(cashDenominations.note1) || 0) * 1;

        // Round totalCash: if decimal >= 0.5, round up; otherwise round down
        const roundedTotalCash = totals.totalCash >= 0
          ? Math.floor(totals.totalCash) + (totals.totalCash % 1 >= 0.5 ? 1 : 0)
          : Math.ceil(totals.totalCash) - (Math.abs(totals.totalCash) % 1 >= 0.5 ? 1 : 0);
        const roundedCalculatedTotal = Math.round(calculatedTotal);

        // Allow 1 rupee difference for rounding
        if (Math.abs(roundedCalculatedTotal - roundedTotalCash) > 1) {
          alert(`Cash denominations sum (₹${roundedCalculatedTotal.toLocaleString()}) does not match Total Cash (₹${roundedTotalCash.toLocaleString()}). Please verify the note counts.`);
          setLoading(false);
          return;
        }
      }

      // Update group photo and cash denominations in recovery session
      await updateRecoveryPhoto(
        activeGroup.id,
        today,
        groupPhoto,
        totals.totalCash > 0 ? {
          note200: parseFloat(cashDenominations.note200) || 0,
          note500: parseFloat(cashDenominations.note500) || 0,
          note100: parseFloat(cashDenominations.note100) || 0,
          note50: parseFloat(cashDenominations.note50) || 0,
          note20: parseFloat(cashDenominations.note20) || 0,
          note10: parseFloat(cashDenominations.note10) || 0,
          note5: parseFloat(cashDenominations.note5) || 0,
          note2: parseFloat(cashDenominations.note2) || 0,
          note1: parseFloat(cashDenominations.note1) || 0,
        } : null
      );

      // For group panel, create approval request; for admin, recovery is already saved
      if (currentGroup) {
        // Group panel: create approval request for the recovery session
        await createApprovalRequest("recovery", {
          groupId: activeGroup.id,
          groupName: activeGroup.name,
          date: today,
          groupPhoto,
          totals,
          memberCount: allMembers.length,
        }, activeGroup.id, activeGroup.name);
        alert("Recovery data submitted for approval!");
      } else {
        // Admin: recovery data is already saved via updateMemberRecovery
        alert("Recovery data saved successfully!");
      }

      // Reset everything
      setRecoveries([]);
      setCurrentMemberIndex(0);
      setCurrentStep(1);
      setGroupPhoto(null);
      setCashDenominations({
        note200: "",
        note500: "",
        note100: "",
        note50: "",
        note20: "",
        note10: "",
        note5: "",
        note2: "",
        note1: "",
      });
      resetForm();
    } catch (error) {
      console.error("Error finalizing:", error);
      alert(error?.response?.data?.message || error?.message || "Error finalizing recovery");
    } finally {
      setLoading(false);
    }
  };

  // Navigate to member
  const goToMember = (index) => {
    setCurrentMemberIndex(index);
    resetForm();
    const memberRecovery = recoveries.find(
      (r) => r.memberId === allMembers[index].id
    );
    if (memberRecovery) {
      setAttendance(memberRecovery.attendance || "present");
      setRecoveryByOther(memberRecovery.recoveryByOther || false);
      setOtherMemberId(memberRecovery.otherMemberId || "");
      setAmountBreakup(memberRecovery.amounts || { saving: "", loan: "", fd: "", interest: "", yogdan: "", other: "", charges: {} });
      // Convert months to years for display (fd_time_period is stored in months)
      setFdTimePeriod(memberRecovery.fd_time_period ? String(memberRecovery.fd_time_period / 12) : "");
      setPaymentMode(memberRecovery.paymentMode || { cash: false, online: false });
      setOnlineRef(memberRecovery.onlineRef || "");
      setSelectedBankId(memberRecovery.bankId || "");
      if (memberRecovery.screenshot) {
        setScreenshot(memberRecovery.screenshot);
      }
    }
  };


  // Group panel: wait for dynamic group to load
  if (isGroupPanel && isGroupLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <p className="text-blue-600 font-semibold">Loading group information...</p>
        </div>
      </div>
    );
  }

  // Group panel: no active group configured/found
  if (isGroupPanel && !currentGroup) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
          <p className="text-yellow-800 font-semibold">No group found.</p>
          <p className="text-yellow-700 mt-2">
            Please create a group in the admin panel first (Create Group), then refresh this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <DollarSign size={32} />
              Recovery Management
            </h1>
            <p className="text-gray-600 mt-2">
              {activeGroup
                ? `Enter recovery for all members of ${activeGroup.name}`
                : isAdminMode
                  ? "Select a group to start recovery process"
                  : "Loading group information..."}
            </p>
          </div>
        </div>
      </div>

      {/* Step 0: Select Cluster & Group (Admin only - when currentGroup is null) */}
      {isAdminMode && currentStep === 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <Building2 size={24} className="text-blue-600" />
              {selectedCluster ? `Groups in ${selectedCluster.name}` : "Select Cluster"}
            </h2>
            {selectedCluster && (
              <button
                onClick={() => setSelectedCluster(null)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                ← Back to Clusters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupsLoading && (
              <div className="col-span-full text-center py-8 text-gray-500">
                <p>Loading...</p>
              </div>
            )}

            {/* Show Clusters */}
            {!groupsLoading && !selectedCluster && (() => {
              const clusterKeys = Array.from(new Set(groups.map(g => `${g.cluster_name || ""}|${g.cluster_code || ""}`)));
              return clusterKeys.map((clusterKey) => {
                const [name, code] = clusterKey.split('|');
                const clusterGroups = groups.filter(g => (g.cluster_name || "") === name && (g.cluster_code || "") === code);
                if (clusterGroups.length === 0) return null; // Skip clusters with no groups
                const displayName = (name || code) ? (name || "No Name") : "Unassigned";
                const displayCode = code || (name ? "" : "No Code");
                return (
                  <div
                    key={clusterKey}
                    onClick={() => setSelectedCluster({ name: name || "", code: code || "" })}
                    className="p-6 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <LayoutGrid className="text-blue-600" size={32} />
                      <div>
                        <p className="font-semibold text-gray-800 text-lg">{displayName}</p>
                        <p className="text-sm text-gray-600">Code: {displayCode}</p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      <p>Groups: {clusterGroups.length}</p>
                    </div>
                  </div>
                );
              }).filter(Boolean);
            })()}

            {/* Show Groups in Selected Cluster */}
            {!groupsLoading && selectedCluster && (() => {
              const clusterGroups = groups.filter(g => (g.cluster_name || "") === (selectedCluster.name || "") && (g.cluster_code || "") === (selectedCluster.code || ""));
              return clusterGroups.length > 0 ? (
                clusterGroups.map((group) => (
                  <div
                    key={group.id}
                    onClick={() => handleSelectGroup(group)}
                    className={`p-6 border-2 rounded-lg cursor-pointer transition-colors ${selectedGroup?.id === group.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-blue-500 hover:bg-blue-50"
                      }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <Building2 className="text-blue-600" size={32} />
                      <div>
                        <p className="font-semibold text-gray-800 text-lg">{group.name}</p>
                        <p className="text-sm text-gray-600">Code: {group.code || group.id}</p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      <p>Village: {group.village}</p>
                      <p className="mt-1">Members: {group.memberCount ?? 0}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-8 text-gray-500">
                  <p>No groups found in this cluster.</p>
                </div>
              );
            })()}

            {!groupsLoading && !selectedCluster && groups.length === 0 && (
              <div className="col-span-full text-center py-8 text-gray-500">
                <p>No clusters found.</p>
              </div>
            )}
            {!groupsLoading && selectedCluster && groups.filter(g => (g.cluster_name || "") === (selectedCluster.name || "") && (g.cluster_code || "") === (selectedCluster.code || "")).length === 0 && (
              <div className="col-span-full text-center py-8 text-gray-500">
                <p>No groups found in this cluster.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 1: Recovery Entry */}
      {currentStep === 1 && activeGroup && (
        <div className="space-y-6">
          {/* Progress Bar */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-4">
                  {isAdminMode && (
                    <button
                      onClick={() => {
                        if (window.confirm("Are you sure you want to go back? All unsaved data will be lost.")) {
                          setSelectedGroup(null);
                          setAllMembers([]);
                          setRecoveries([]);
                          setCurrentMemberIndex(0);
                          setCurrentStep(0);
                          resetForm();
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <ArrowLeft size={18} />
                      Back to Groups
                    </button>
                  )}
                  <h2 className="text-xl font-semibold text-gray-800">
                    {activeGroup.name} - Recovery Entry
                  </h2>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                Member {currentMemberIndex + 1} of {allMembers.length}
              </div>
            </div>

            {/* Progress */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-600 mb-2">
                <span>Progress</span>
                <span>{recoveries.length} / {allMembers.length} Processed</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-600 h-3 rounded-full transition-all"
                  style={{ width: `${(recoveries.length / allMembers.length) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Members List */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {allMembers.map((member, index) => {
                const memberRecovery = recoveries.find((r) => r.memberId === member.id);
                const isRecovered = memberRecovery && (memberRecovery.attendance === "present" || (memberRecovery.attendance === "absent" && memberRecovery.recoveryByOther));
                const isAbsent = memberRecovery && memberRecovery.attendance === "absent" && !memberRecovery.recoveryByOther;
                const isCurrent = index === currentMemberIndex;
                return (
                  <button
                    key={member.id}
                    onClick={() => goToMember(index)}
                    className={`p-3 rounded-lg text-sm font-medium transition-colors ${isCurrent
                      ? "bg-blue-600 text-white"
                      : isRecovered
                        ? "bg-green-100 text-green-800 border-2 border-green-500"
                        : isAbsent
                          ? "bg-red-100 text-red-800 border-2 border-red-500"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{member.code}</span>
                      {isRecovered && <Check size={16} />}
                      {isAbsent && <X size={16} />}
                    </div>
                    <div className="text-xs mt-1 truncate">{member.name}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current Member Recovery Form */}
          {currentMember && currentMemberSummary && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <User size={20} className="text-blue-600" />
                  {currentMember.name} ({currentMember.code})
                </h3>
                <div className="flex gap-2">
                  {/*   <button
                    onClick={() => {
                      setShowFullLoanRecovery(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm shadow-md"
                  >
                    <CreditCard size={16} />
                    Full Loan Recovery
                  </button>*/}
                  <button
                    onClick={() => {
                      // Get full member data from allMembers
                      const fullMember = allMembers.find(m => m.id === currentMember.id);
                      let memberData = null;

                      if (fullMember?.raw) {
                        // Use raw member data and ensure group is set
                        memberData = {
                          ...fullMember.raw,
                          group: activeGroup?.raw || activeGroup?.id || fullMember.raw.group,
                        };
                      } else {
                        // If raw data not available, construct member data
                        memberData = {
                          _id: currentMember.id,
                          id: currentMember.id,
                          Member_Id: currentMember.code,
                          Member_Nm: currentMember.name,
                          group: activeGroup?.raw || activeGroup?.id,
                        };
                      }

                      setSelectedMemberForFD(memberData);
                      setShowCreateFD(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm shadow-md"
                  >
                    <Plus size={16} />
                    Create FD
                  </button>
                </div>
              </div>

              {/* Demand Summary Table */}
              <div className="mb-6 overflow-x-auto">
                <h4 className="font-semibold text-gray-700 mb-3">Demand Summary</h4>
                <table className="w-full border-collapse border border-gray-300 text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 text-left font-semibold text-gray-700">Category</th>
                      <th className="border p-2 text-center font-semibold text-gray-700">Previous Demand</th>
                      <th className="border p-2 text-center font-semibold text-gray-700">Current Month Demand</th>
                      <th className="border p-2 text-center font-semibold text-gray-700">Total Demand</th>
                      <th className="border p-2 text-center font-semibold text-gray-700">Actual Received</th>
                      <th className="border p-2 text-center font-semibold text-gray-700">Unpaid Demand</th>
                      <th className="border p-2 text-center font-semibold text-gray-700">Opening Balance</th>
                      <th className="border p-2 text-center font-semibold text-gray-700">Closing Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const rows = [];
                      // Map category keys to display names
                      const categoryNames = {
                        saving: "Saving",
                        loan: "Loan",
                        interest: "Int on loan",
                        yogdan: "Yogdan",
                        memFeesSHG: "Mem. Fees SHG (Yearly)",
                        memFeesSamiti: "Mem. Fees Samiti (Yearly)",
                        memFeesGroup: "Mem. Fees Group (Yearly)",
                        penalty: "Penalty",
                        other: "Other",
                        fd: "FD",
                        charges: "Charges",
                      };

                      Object.entries(currentMemberSummary)
                        .filter(([key, data]) => {
                          // Always show: saving, loan, interest, fd
                          if (['saving', 'loan', 'interest', 'fd'].includes(key)) {
                            return true;
                          }
                          // Special handling for charges - show if has charges due
                          if (key === "charges" && data.chargesDue && Object.keys(data.chargesDue).length > 0) {
                            return true;
                          }
                          // Special handling for yogdan - show only if unpaid > 0 (not paid yet)
                          if (key === "yogdan") {
                            const hasYogdanUnpaid = data.unpaid > 0;
                            return hasYogdanUnpaid;
                          }
                          // Special handling for memFeesSHG - show if has remaining amount from API OR if has any amount due
                          if (key === "memFeesSHG") {
                            const hasRemainingFromAPI = (memberRevenueRemaining[currentMember?.id]?.membershipFeesSHG?.remainingAmount || 0) > 0;
                            const hasValue = data.prev > 0 || data.curr > 0 || data.total > 0 ||
                              data.actual > 0 || data.unpaid > 0 || data.opening > 0 || data.closing > 0;
                            return hasRemainingFromAPI || hasValue;
                          }
                          // Special handling for memFeesGroup - show if has remaining amount from API OR if has any amount due
                          if (key === "memFeesGroup") {
                            const hasRemainingFromAPI = (memberRevenueRemaining[currentMember?.id]?.membershipFeesGroup?.remainingAmount || 0) > 0;
                            const hasValue = data.prev > 0 || data.curr > 0 || data.total > 0 ||
                              data.actual > 0 || data.unpaid > 0 || data.opening > 0 || data.closing > 0;
                            return hasRemainingFromAPI || hasValue;
                          }
                          // Hide these categories if all values are 0: memFeesSamiti, penalty, other
                          const hasValue = data.prev > 0 || data.curr > 0 || data.total > 0 ||
                            data.actual > 0 || data.unpaid > 0 || data.opening > 0 || data.closing > 0;
                          return hasValue;
                        })
                        .forEach(([key, data]) => {
                          // Special handling for charges - show individual charges
                          if (key === "charges" && data.chargesDue && Object.keys(data.chargesDue).length > 0) {
                            Object.keys(data.chargesDue).forEach((chargeName) => {
                              rows.push(
                                <tr key={`charge-${chargeName}`} className="hover:bg-gray-50">
                                  <td className="border p-2 font-medium text-gray-800 pl-6">{chargeName}</td>
                                  <td className="border p-2 text-center text-gray-700">—</td>
                                  <td className="border p-2 text-center text-gray-700">{data.chargesDue[chargeName] === 0 ? "—" : `₹${Math.round(data.chargesDue[chargeName]).toLocaleString()}`}</td>
                                  <td className="border p-2 text-center text-gray-700">{data.chargesDue[chargeName] === 0 ? "—" : `₹${Math.round(data.chargesDue[chargeName]).toLocaleString()}`}</td>
                                  <td className="border p-2 text-center text-gray-700">{(data.actualCharges?.[chargeName] || 0) === 0 ? "—" : `₹${Math.round(data.actualCharges[chargeName]).toLocaleString()}`}</td>
                                  <td className="border p-2 text-center text-gray-700">{Math.max(0, (data.chargesDue[chargeName] || 0) - (data.actualCharges?.[chargeName] || 0)) === 0 ? "—" : `₹${Math.round(Math.max(0, (data.chargesDue[chargeName] || 0) - (data.actualCharges?.[chargeName] || 0))).toLocaleString()}`}</td>
                                  <td className="border p-2 text-center text-gray-700">—</td>
                                  <td className="border p-2 text-center text-gray-700">—</td>
                                </tr>
                              );
                            });
                          } else {
                            // For yogdan in receipt, show "due" (total) instead of "paid" (actual)
                            const displayValue = (key === "yogdan") ? data.total : data.actual;
                            rows.push(
                              <tr key={key} className="hover:bg-gray-50">
                                <td className="border p-2 font-medium text-gray-800">{categoryNames[key] || key}</td>
                                <td className="border p-2 text-center text-gray-700">{data.prev === 0 ? "—" : `₹${Math.round(data.prev).toLocaleString()}`}</td>
                                <td className="border p-2 text-center text-gray-700">{data.curr === 0 ? "—" : `₹${Math.round(data.curr).toLocaleString()}`}</td>
                                <td className="border p-2 text-center text-gray-700">{data.total === 0 ? "—" : `₹${Math.round(data.total).toLocaleString()}`}</td>
                                <td className="border p-2 text-center text-gray-700">{displayValue === 0 ? "—" : `₹${Math.round(displayValue).toLocaleString()}`}</td>
                                <td className="border p-2 text-center text-gray-700">{data.unpaid === 0 ? "—" : `₹${Math.round(data.unpaid).toLocaleString()}`}</td>
                                <td className="border p-2 text-center text-gray-700">{data.opening === 0 ? "—" : `₹${Math.round(data.opening).toLocaleString()}`}</td>
                                <td className="border p-2 text-center text-gray-700">{data.closing === 0 ? "—" : `₹${Math.round(data.closing).toLocaleString()}`}</td>
                              </tr>
                            );
                          }
                        });
                      return rows;
                    })()}
                    <tr className="bg-gray-50 font-semibold">
                      <td className="border p-2 text-gray-800">TOTAL</td>
                      <td className="border p-2 text-center text-gray-800">—</td>
                      <td className="border p-2 text-center text-gray-800">—</td>
                      <td className="border p-2 text-center text-gray-800">
                        ₹{Math.round(Object.values(currentMemberSummary).reduce((sum, d) => {
                          const val = typeof d.total === 'number' ? d.total : parseFloat(d.total) || 0;
                          return sum + val;
                        }, 0)).toLocaleString()}
                      </td>
                      <td className="border p-2 text-center text-gray-800">
                        ₹{Math.round(Object.values(currentMemberSummary).reduce((sum, d) => sum + d.actual, 0)).toLocaleString()}
                      </td>
                      <td className="border p-2 text-center text-gray-800">
                        ₹{Math.round(Object.values(currentMemberSummary).reduce((sum, d) => sum + d.unpaid, 0)).toLocaleString()}
                      </td>
                      <td className="border p-2 text-center text-gray-800">
                        ₹{Math.round(Object.values(currentMemberSummary).reduce((sum, d) => sum + d.opening, 0)).toLocaleString()}
                      </td>
                      <td className="border p-2 text-center text-gray-800">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Attendance */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Attendance *
                </label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => handleAttendanceChange("present")}
                    className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${attendance === "present"
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                  >
                    <CheckCircle size={20} />
                    Present
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAttendanceChange("absent")}
                    className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${attendance === "absent"
                      ? "bg-red-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                  >
                    <XCircle size={20} />
                    Absent
                  </button>
                </div>

                {attendance === "absent" && (
                  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Recovery brought by another member?
                    </label>
                    <div className="flex gap-4 mb-4">
                      <button
                        type="button"
                        onClick={() => setRecoveryByOther(true)}
                        className={`px-4 py-2 rounded-lg font-medium ${recoveryByOther
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700"
                          }`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRecoveryByOther(false);
                          setOtherMemberId("");
                        }}
                        className={`px-4 py-2 rounded-lg font-medium ${!recoveryByOther
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700"
                          }`}
                      >
                        No
                      </button>
                    </div>
                    {recoveryByOther && (
                      <Select
                        label="Select Member"
                        name="otherMemberId"
                        value={otherMemberId}
                        handleChange={(e) => setOtherMemberId(e.target.value)}
                        options={allMembers
                          .filter((m) => m.id !== currentMember.id)
                          .map((m) => `${m.code} - ${m.name}`)}
                        required
                      />
                    )}
                    {!recoveryByOther && (
                      <p className="text-sm text-red-600 mt-2">
                        Member will be marked as absent without recovery
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Show message if already recovered */}
              {isAlreadyRecovered && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="text-blue-600" size={20} />
                    <p className="text-sm text-blue-800 font-medium">
                      Demand for this member has already been recovered today.
                      {currentMemberRecoveryStatus?.recovery?.total && (
                        <span className="ml-2">
                          Amount: ₹{Math.round(currentMemberRecoveryStatus.recovery.total).toLocaleString()}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Amount Breakup - Only show if present or absent with recovery by other */}
              {(attendance === "present" || (attendance === "absent" && recoveryByOther)) && !isAlreadyRecovered && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Enter Amount
                  </label>
                  <div className="space-y-4">
                    {/* Total Amount Input for Auto-calculation */}
                    <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                      <Input
                        label="Total Amount (Auto-calculate)"
                        name="totalAmount"
                        type="number"
                        value={totalAmount}
                        handleChange={(e) => {
                          handleTotalAmountChange(e.target.value);
                        }}
                        placeholder="Enter total amount to auto-distribute"
                        step="1"
                        min="0"
                      />
                      {autoCalculated && (
                        <p className="text-xs text-blue-600 mt-2">
                          ✓ Amounts auto-calculated. You can edit individual amounts below.
                        </p>
                      )}
                    </div>

                    {/* Individual Amount Fields - Only show fields with values > 0 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(parseFloat(amountBreakup.saving) || 0) > 0 && (
                        <Input
                          label="Saving"
                          name="saving"
                          type="number"
                          value={amountBreakup.saving}
                          handleChange={(e) => {
                            setAmountBreakup({ ...amountBreakup, saving: e.target.value });
                            setAutoCalculated(false); // Mark as manually edited
                          }}
                          placeholder="Enter saving amount"
                          step="1"
                        />
                      )}
                      {(parseFloat(amountBreakup.loan) || 0) > 0 && (
                        <Input
                          label="Loan"
                          name="loan"
                          type="number"
                          value={amountBreakup.loan}
                          handleChange={(e) => {
                            handleAmountChange('loan', e.target.value);
                          }}
                          placeholder="Enter loan payment"
                          step="1"
                          max={currentMemberSummary?.loan?.total || undefined}
                        />
                      )}
                      {(parseFloat(amountBreakup.interest) || 0) > 0 && (
                        <Input
                          label="Interest on Loan"
                          name="interest"
                          type="number"
                          value={amountBreakup.interest}
                          handleChange={(e) => {
                            handleAmountChange('interest', e.target.value);
                          }}
                          placeholder="Enter interest payment"
                          step="1"
                          max={currentMemberSummary?.interest?.total || undefined}
                        />
                      )}
                      {((parseFloat(amountBreakup.yogdan) || 0) > 0 || (currentMemberSummary?.yogdan?.unpaid || 0) > 0) && (
                        <Input
                          label="Yogdan (when loan is given)"
                          name="yogdan"
                          type="number"
                          value={amountBreakup.yogdan}
                          handleChange={(e) => {
                            handleAmountChange('yogdan', e.target.value);
                          }}
                          placeholder="Enter yogdan amount"
                          step="1"
                          max={currentMemberSummary?.yogdan?.total || undefined}
                        />
                      )}
                      {(() => {
                        // Show memFeesSHG if user has entered amount OR if there's remaining amount from API
                        const hasMemFeesSHGAmount = (parseFloat(amountBreakup.memFeesSHG) || 0) > 0;
                        const hasMemFeesSHGRemaining = (currentMemberSummary?.memFeesSHG?.total || 0) > 0 ||
                          (currentMemberSummary?.memFeesSHG?.unpaid || 0) > 0 ||
                          (currentMemberSummary?.memFeesSHG?.curr || 0) > 0 ||
                          (memberRevenueRemaining[currentMember?.id]?.membershipFeesSHG?.remainingAmount || 0) > 0;
                        const shouldShowMemFeesSHG = hasMemFeesSHGAmount || hasMemFeesSHGRemaining;

                        return shouldShowMemFeesSHG && (
                          <Input
                            label="Member Fees SHG (Yearly)"
                            name="memFeesSHG"
                            type="number"
                            value={amountBreakup.memFeesSHG}
                            handleChange={(e) => {
                              handleAmountChange('memFeesSHG', e.target.value);
                            }}
                            placeholder="Enter SHG fees"
                            step="1"
                            max={currentMemberSummary?.memFeesSHG?.total || undefined}
                          />
                        );
                      })()}
                      {(parseFloat(amountBreakup.memFeesSamiti) || 0) > 0 && (
                        <Input
                          label="Member Fees Samiti (Yearly)"
                          name="memFeesSamiti"
                          type="number"
                          value={amountBreakup.memFeesSamiti}
                          handleChange={(e) => {
                            handleAmountChange('memFeesSamiti', e.target.value);
                          }}
                          placeholder="Enter Samiti fees"
                          step="1"
                          max={currentMemberSummary?.memFeesSamiti?.total || undefined}
                        />
                      )}
                      {(() => {
                        // Show memFeesGroup if user has entered amount OR if there's remaining amount from API
                        const hasMemFeesGroupAmount = (parseFloat(amountBreakup.memFeesGroup) || 0) > 0;
                        const hasMemFeesGroupRemaining = (currentMemberSummary?.memFeesGroup?.total || 0) > 0 ||
                          (currentMemberSummary?.memFeesGroup?.unpaid || 0) > 0 ||
                          (currentMemberSummary?.memFeesGroup?.curr || 0) > 0 ||
                          (memberRevenueRemaining[currentMember?.id]?.membershipFeesGroup?.remainingAmount || 0) > 0;
                        const shouldShowMemFeesGroup = hasMemFeesGroupAmount || hasMemFeesGroupRemaining;

                        return shouldShowMemFeesGroup && (
                          <Input
                            label="Membership Group (Yearly)"
                            name="memFeesGroup"
                            type="number"
                            value={amountBreakup.memFeesGroup}
                            handleChange={(e) => {
                              handleAmountChange('memFeesGroup', e.target.value);
                            }}
                            placeholder="Enter Membership Group fees"
                            step="1"
                            max={currentMemberSummary?.memFeesGroup?.total || undefined}
                          />
                        );
                      })()}
                      {(parseFloat(amountBreakup.penalty) || 0) > 0 && (
                        <Input
                          label="Penalty"
                          name="penalty"
                          type="number"
                          value={amountBreakup.penalty}
                          handleChange={(e) => {
                            handleAmountChange('penalty', e.target.value);
                          }}
                          placeholder="Enter penalty amount"
                          step="1"
                          max={currentMemberSummary?.penalty?.total || undefined}
                        />
                      )}
                      {(parseFloat(amountBreakup.other) || 0) > 0 && (
                        <Input
                          label="Other"
                          name="other"
                          type="number"
                          value={amountBreakup.other}
                          handleChange={(e) => {
                            handleAmountChange('other', e.target.value);
                          }}
                          placeholder="Enter other amount"
                          step="1"
                          max={currentMemberSummary?.other?.total || undefined}
                        />
                      )}
                      {/* Dynamic Charges Input Fields */}
                      {currentMemberSummary?.charges?.chargesDue && Object.keys(currentMemberSummary.charges.chargesDue).length > 0 && (
                        <>
                          {Object.keys(currentMemberSummary.charges.chargesDue).map((chargeName) => {
                            const chargeDue = currentMemberSummary.charges.chargesDue[chargeName] || 0;
                            const chargePaid = parseFloat(amountBreakup.charges?.[chargeName] || 0) || 0;
                            // Show if charge is due or has been paid
                            if (chargeDue > 0 || chargePaid > 0) {
                              return (
                                <Input
                                  key={chargeName}
                                  label={`${chargeName} (Due: ₹${chargeDue})`}
                                  name={`charge-${chargeName}`}
                                  type="number"
                                  value={amountBreakup.charges?.[chargeName] || ""}
                                  handleChange={(e) => {
                                    const numValue = parseFloat(e.target.value) || 0;
                                    if (e.target.value === '' || e.target.value === null || e.target.value === undefined) {
                                      setAmountBreakup({
                                        ...amountBreakup,
                                        charges: {
                                          ...amountBreakup.charges,
                                          [chargeName]: e.target.value,
                                        },
                                      });
                                      setAutoCalculated(false);
                                    } else if (numValue <= chargeDue) {
                                      setAmountBreakup({
                                        ...amountBreakup,
                                        charges: {
                                          ...amountBreakup.charges,
                                          [chargeName]: e.target.value,
                                        },
                                      });
                                      setAutoCalculated(false);
                                    } else {
                                      alert(`Amount cannot exceed the due amount of ₹${chargeDue.toLocaleString()}`);
                                      setAmountBreakup({
                                        ...amountBreakup,
                                        charges: {
                                          ...amountBreakup.charges,
                                          [chargeName]: chargeDue.toString(),
                                        },
                                      });
                                      setAutoCalculated(false);
                                    }
                                  }}
                                  placeholder={`Enter ${chargeName} amount`}
                                  step="1"
                                  max={chargeDue}
                                />
                              );
                            }
                            return null;
                          })}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Mode - Only show if present or absent with recovery by other */}
              {(attendance === "present" || (attendance === "absent" && recoveryByOther)) && !isAlreadyRecovered && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Payment Mode *
                  </label>
                  <div className="flex gap-4 mb-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="paymentMode"
                        checked={paymentMode.cash}
                        onChange={() => handlePaymentModeChange("cash")}
                        className="w-5 h-5 text-blue-600"
                      />
                      <span className="font-medium text-gray-700">Cash</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="paymentMode"
                        checked={paymentMode.online}
                        onChange={() => handlePaymentModeChange("online")}
                        className="w-5 h-5 text-blue-600"
                      />
                      <span className="font-medium text-gray-700">Online</span>
                    </label>
                  </div>

                  {paymentMode.online && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
                      <Select
                        label="Select Bank *"
                        name="selectedBankId"
                        value={selectedBankId}
                        handleChange={(e) => setSelectedBankId(e.target.value)}
                        options={groupBanks.length > 0
                          ? groupBanks.map((bank) => {
                            // Use available_balance if available, else fallback to current_balance or opening_balance
                            const balance = bank.available_balance !== undefined
                              ? bank.available_balance
                              : (bank.current_balance !== undefined
                                ? bank.current_balance
                                : (bank.opening_balance || 0));
                            const balanceFormatted = `₹${balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                            return {
                              value: bank._id || bank.id,
                              label: `${bank.bank_name} - ${bank.account_no}${bank.short_name ? ` (${bank.short_name})` : ""} [Available: ${balanceFormatted}]`
                            };
                          })
                          : [{ value: "", label: "No banks available" }]
                        }
                        required
                      />
                      {groupBanks.length === 0 && (
                        <p className="text-sm text-red-600 mt-1">
                          No banks found for this group. Please add a bank account first.
                        </p>
                      )}
                      <Input
                        label="Reference Number / Transaction ID *"
                        name="onlineRef"
                        value={onlineRef}
                        handleChange={(e) => setOnlineRef(e.target.value)}
                        placeholder="Enter reference number"
                        required
                      />
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Screenshot (Optional)
                        </label>
                        <label className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                          <Upload size={20} className="text-gray-600" />
                          <span className="text-sm text-gray-700">Choose File</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </label>
                        {screenshot && (
                          <img src={screenshot} alt="Screenshot" className="mt-2 max-w-xs rounded-lg" />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between gap-4">
                <button
                  onClick={() => {
                    if (currentMemberIndex > 0) {
                      setCurrentMemberIndex(currentMemberIndex - 1);
                      resetForm();
                    }
                  }}
                  disabled={currentMemberIndex === 0}
                  className="flex items-center gap-2 px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowLeft size={18} />
                  Previous
                </button>
                <button
                  onClick={handleSaveRecovery}
                  disabled={isAlreadyRecovered}
                  className={`flex items-center gap-2 px-8 py-2.5 font-semibold shadow-md ${isAlreadyRecovered
                    ? "bg-gray-400 text-white cursor-not-allowed opacity-60"
                    : "bg-green-600 text-white hover:bg-green-700"
                    }`}
                >
                  {isAlreadyRecovered ? (
                    <>
                      Recovered Today
                      <CheckCircle size={18} />
                    </>
                  ) : currentMemberIndex < allMembers.length - 1 ? (
                    <>
                      Save & Next
                      <ArrowRight size={18} />
                    </>
                  ) : (
                    <>
                      Save & Finish
                      <Check size={18} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Summary & Photo */}
      {currentStep === 2 && allMembersProcessed && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <CheckCircle className="text-green-600" size={28} />
                Recovery Summary
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => exportRecoveryToExcel(recoveries, activeGroup.name)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
                >
                  <Download size={18} />
                  Export Excel
                </button>
                <button
                  onClick={async () => {
                    try {
                      const today = new Date().toLocaleDateString("en-GB");
                      const blob = await exportRecoveryPDF(activeGroup.id, today);
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${activeGroup.name || 'Recovery'}_${today.replace(/\//g, '-')}.pdf`;
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(url);
                      document.body.removeChild(a);
                    } catch (error) {
                      console.error("Error exporting PDF:", error);
                      alert("Failed to export PDF. Please try again.");
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm"
                >
                  <FileText size={18} />
                  Export PDF
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="p-6 bg-green-50 rounded-lg border-l-4 border-green-500">
                <p className="text-sm text-gray-600 mb-2">Total Cash</p>
                <p className="text-3xl font-bold text-gray-800">₹{Math.round(totals.totalCash).toLocaleString()}</p>
              </div>
              <div className="p-6 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                <p className="text-sm text-gray-600 mb-2">Total Online</p>
                <p className="text-3xl font-bold text-gray-800">₹{Math.round(totals.totalOnline).toLocaleString()}</p>
              </div>
              <div className="p-6 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                <p className="text-sm text-gray-600 mb-2">Grand Total</p>
                <p className="text-3xl font-bold text-gray-800">₹{Math.round(totals.totalAmount).toLocaleString()}</p>
              </div>
            </div>

            {/* Cash Denomination Breakdown */}
            {totals.totalCash > 0 && (
              <div className="bg-gray-50 rounded-lg p-6 mb-6 border-2 border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Wallet size={20} className="text-green-600" />
                  Cash Denomination Breakdown
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ₹500 Notes (Count)
                    </label>
                    <Input
                      type="number"
                      value={cashDenominations.note500}
                      handleChange={(e) => {
                        const value = e.target.value;
                        setCashDenominations({ ...cashDenominations, note500: value });
                      }}
                      placeholder="0"
                      min="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Amount: ₹{((parseFloat(cashDenominations.note500) || 0) * 500).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ₹200 Notes (Count)
                    </label>
                    <Input
                      type="number"
                      value={cashDenominations.note200}
                      handleChange={(e) => {
                        const value = e.target.value;
                        setCashDenominations({ ...cashDenominations, note200: value });
                      }}
                      placeholder="0"
                      min="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Amount: ₹{((parseFloat(cashDenominations.note200) || 0) * 200).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ₹100 Notes (Count)
                    </label>
                    <Input
                      type="number"
                      value={cashDenominations.note100}
                      handleChange={(e) => {
                        const value = e.target.value;
                        setCashDenominations({ ...cashDenominations, note100: value });
                      }}
                      placeholder="0"
                      min="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Amount: ₹{((parseFloat(cashDenominations.note100) || 0) * 100).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ₹50 Notes (Count)
                    </label>
                    <Input
                      type="number"
                      value={cashDenominations.note50}
                      handleChange={(e) => {
                        const value = e.target.value;
                        setCashDenominations({ ...cashDenominations, note50: value });
                      }}
                      placeholder="0"
                      min="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Amount: ₹{((parseFloat(cashDenominations.note50) || 0) * 50).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ₹20 Notes (Count)
                    </label>
                    <Input
                      type="number"
                      value={cashDenominations.note20}
                      handleChange={(e) => {
                        const value = e.target.value;
                        setCashDenominations({ ...cashDenominations, note20: value });
                      }}
                      placeholder="0"
                      min="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Amount: ₹{((parseFloat(cashDenominations.note20) || 0) * 20).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ₹10 Notes (Count)
                    </label>
                    <Input
                      type="number"
                      value={cashDenominations.note10}
                      handleChange={(e) => {
                        const value = e.target.value;
                        setCashDenominations({ ...cashDenominations, note10: value });
                      }}
                      placeholder="0"
                      min="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Amount: ₹{((parseFloat(cashDenominations.note10) || 0) * 10).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ₹5 Notes (Count)
                    </label>
                    <Input
                      type="number"
                      value={cashDenominations.note5}
                      handleChange={(e) => {
                        const value = e.target.value;
                        setCashDenominations({ ...cashDenominations, note5: value });
                      }}
                      placeholder="0"
                      min="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Amount: ₹{((parseFloat(cashDenominations.note5) || 0) * 5).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ₹2 Coins/Notes (Count)
                    </label>
                    <Input
                      type="number"
                      value={cashDenominations.note2}
                      handleChange={(e) => {
                        const value = e.target.value;
                        setCashDenominations({ ...cashDenominations, note2: value });
                      }}
                      placeholder="0"
                      min="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Amount: ₹{((parseFloat(cashDenominations.note2) || 0) * 2).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ₹1 Coins/Notes (Count)
                    </label>
                    <Input
                      type="number"
                      value={cashDenominations.note1}
                      handleChange={(e) => {
                        const value = e.target.value;
                        setCashDenominations({ ...cashDenominations, note1: value });
                      }}
                      placeholder="0"
                      min="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Amount: ₹{((parseFloat(cashDenominations.note1) || 0) * 1).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="mt-4 p-4 bg-white rounded-lg border-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-700">Calculated Total:</span>
                    {(() => {
                      const calculatedTotal = (parseFloat(cashDenominations.note200) || 0) * 200 +
                        (parseFloat(cashDenominations.note500) || 0) * 500 +
                        (parseFloat(cashDenominations.note100) || 0) * 100 +
                        (parseFloat(cashDenominations.note50) || 0) * 50 +
                        (parseFloat(cashDenominations.note20) || 0) * 20 +
                        (parseFloat(cashDenominations.note10) || 0) * 10 +
                        (parseFloat(cashDenominations.note5) || 0) * 5 +
                        (parseFloat(cashDenominations.note2) || 0) * 2 +
                        (parseFloat(cashDenominations.note1) || 0) * 1;
                      const roundedTotalCash = totals.totalCash >= 0
                        ? Math.floor(totals.totalCash) + (totals.totalCash % 1 >= 0.5 ? 1 : 0)
                        : Math.ceil(totals.totalCash) - (Math.abs(totals.totalCash) % 1 >= 0.5 ? 1 : 0);
                      const roundedCalculatedTotal = Math.round(calculatedTotal);
                      const isValid = Math.abs(roundedCalculatedTotal - roundedTotalCash) <= 1;

                      return (
                        <>
                          <span className={`text-lg font-bold ${isValid ? "text-green-600" : "text-red-600"}`}>
                            ₹{roundedCalculatedTotal.toLocaleString()}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                  {(() => {
                    const calculatedTotal = (parseFloat(cashDenominations.note200) || 0) * 200 +
                      (parseFloat(cashDenominations.note500) || 0) * 500 +
                      (parseFloat(cashDenominations.note100) || 0) * 100 +
                      (parseFloat(cashDenominations.note50) || 0) * 50 +
                      (parseFloat(cashDenominations.note20) || 0) * 20 +
                      (parseFloat(cashDenominations.note10) || 0) * 10 +
                      (parseFloat(cashDenominations.note5) || 0) * 5 +
                      (parseFloat(cashDenominations.note2) || 0) * 2 +
                      (parseFloat(cashDenominations.note1) || 0) * 1;
                    const roundedTotalCash = totals.totalCash >= 0
                      ? Math.floor(totals.totalCash) + (totals.totalCash % 1 >= 0.5 ? 1 : 0)
                      : Math.ceil(totals.totalCash) - (Math.abs(totals.totalCash) % 1 >= 0.5 ? 1 : 0);
                    const roundedCalculatedTotal = Math.round(calculatedTotal);
                    const isValid = Math.abs(roundedCalculatedTotal - roundedTotalCash) <= 1;

                    return !isValid && (
                      <p className="text-sm text-red-600 mt-2">
                        ⚠️ Denominations total (₹{roundedCalculatedTotal.toLocaleString()}) does not match Total Cash (₹{roundedTotalCash.toLocaleString()}). Please verify.
                      </p>
                    );
                  })()}
                </div>
              </div>
            )}

            <div className="mb-6">
              <h3 className="font-semibold text-gray-800 mb-3">Members Recovery Status ({recoveries.length})</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {recoveries.map((recovery) => {
                  const member = allMembers.find((m) => m.id === recovery.memberId);
                  const memberPhoto = member?.raw?.Member_Photo || member?.Member_Photo;
                  const isRecovered = recovery.attendance === "present" || (recovery.attendance === "absent" && recovery.recoveryByOther);
                  const amount = isRecovered
                    ? (recovery.amounts?.saving || 0) +
                    (recovery.amounts?.loan || 0) +
                    (recovery.amounts?.fd || 0) +
                    (recovery.amounts?.interest || 0) +
                    (recovery.amounts?.yogdan || 0) +
                    (recovery.amounts?.other || 0) +
                    (recovery.amounts?.charges ? Object.values(recovery.amounts.charges).reduce((sum, amount) => sum + (parseFloat(amount) || 0), 0) : 0)
                    : 0;
                  return (
                    <div
                      key={recovery.id}
                      className={`p-4 rounded-lg border-2 flex flex-col items-center ${isRecovered
                        ? "bg-green-50 border-green-200"
                        : "bg-red-50 border-red-200"
                        }`}
                    >
                      {/* Member Photo */}
                      {memberPhoto ? (
                        <div className="mb-3 w-20 h-20 rounded-full overflow-hidden border-2 border-gray-300 flex-shrink-0">
                          <img
                            src={getImageUrl(memberPhoto)}
                            alt={`${member?.name || "Member"} Photo`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = "none";
                              e.target.nextSibling?.classList.remove("hidden");
                            }}
                          />
                          <div className="hidden w-full h-full bg-gray-200 flex items-center justify-center">
                            <User size={32} className="text-gray-400" />
                          </div>
                        </div>
                      ) : (
                        <div className="mb-3 w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-300">
                          <User size={32} className="text-gray-400" />
                        </div>
                      )}
                      <p className="font-medium text-gray-800 text-center">{member?.name}</p>
                      <p className="text-sm text-gray-600 text-center">{member?.code}</p>
                      <p className={`text-sm font-semibold mt-1 ${isRecovered ? "text-green-700" : "text-red-700"
                        }`}>
                        {isRecovered ? `₹${amount.toLocaleString()}` : "Absent - No Recovery"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Group Photo */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Camera size={24} className="text-blue-600" />
              Group Photo *
            </h2>
            <p className="text-gray-600 mb-4">
              Please take a group photo with all members
            </p>
            <div className="flex flex-col items-center gap-4">
              {groupPhoto ? (
                <div className="relative">
                  <img
                    src={groupPhoto}
                    alt="Group Photo"
                    className="max-w-full h-auto rounded-lg border-2 border-gray-300"
                  />
                  <button
                    onClick={() => setGroupPhoto(null)}
                    className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full hover:bg-red-700"
                  >
                    <X size={20} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleCapturePhoto}
                  className="flex flex-col items-center gap-3 p-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <Camera size={48} className="text-gray-400" />
                  <span className="font-medium text-gray-700">Click to Take Photo</span>
                </button>
              )}
            </div>
          </div>

          {/* Finalize Button */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <button
              onClick={handleFinalize}
              disabled={!groupPhoto}
              className="w-full px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg shadow-md"
            >
              Finalize & Save All
            </button>
          </div>
        </div>
      )}

      {/* Create FD Modal */}
      {showCreateFD && selectedMemberForFD && (
        <CreateFD
          member={selectedMemberForFD}
          onClose={() => {
            setShowCreateFD(false);
            setSelectedMemberForFD(null);
          }}
          onSuccess={() => {
            // Reload members to get updated FD data
            if (activeGroup?.id) {
              getMembersByGroup(activeGroup.id)
                .then((res) => {
                  const list = Array.isArray(res?.data) ? res.data : [];
                  setAllMembers(
                    list.map((m) => ({
                      id: m._id,
                      code: m.Member_Id,
                      name: m.Member_Nm,
                      raw: m,
                      openingSaving: m.openingSaving || 0,
                      loanDetails: m.loanDetails || {},
                      fdDetails: m.fdDetails || {},
                      openingYogdan: m.openingYogdan || 0,
                      isExistingMember: m.isExistingMember || false,
                    }))
                  );
                })
                .catch((e) => {
                  console.error("Failed to reload members:", e);
                });
            }
          }}
        />
      )}

      {/* Full Loan Recovery Modal */}
      {/* {showFullLoanRecovery && currentMember && currentMemberSummary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <CreditCard size={28} className="text-blue-600" />
                Full Loan Recovery
              </h2>
              <button
                onClick={() => {
                  setShowFullLoanRecovery(false);
                  setFullLoanRecoveryPaymentMode({ cash: false, online: false });
                  setFullLoanRecoveryBankId("");
                  setFullLoanRecoveryOnlineRef("");
                  setFullLoanRecoveryScreenshot(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Member Info 
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-lg font-semibold text-gray-800">
                  {currentMember.name} ({currentMember.code})
                </p>
              </div>

              {/* Loan Details Summary 
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Loan Details</h3>
                {loadingLoanTotals ? (
                  <div className="text-center py-4">
                    <p className="text-gray-600">Loading loan totals...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <p className="text-sm text-gray-600 mb-1">Total Loan Amount</p>
                      <p className="text-2xl font-bold text-gray-800">
                        ₹{Math.round(loanTotals.totalLoanAmount || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        From LoanMaster (all approved loans)
                      </p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <p className="text-sm text-gray-600 mb-1">Recovered Amount</p>
                      <p className="text-2xl font-bold text-green-600">
                        ₹{Math.round(loanTotals.totalLoanRecovered || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">From RecoveryMaster (all recoveries)</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <p className="text-sm text-gray-600 mb-1">Remaining Amount</p>
                      <p className="text-2xl font-bold text-red-600">
                        ₹{Math.round(loanTotals.remainingLoanAmount || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">To be recovered</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Mode 
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Payment Mode *
                </label>
                <div className="flex gap-4 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="fullLoanRecoveryPaymentMode"
                      checked={fullLoanRecoveryPaymentMode.cash}
                      onChange={() => handleFullLoanRecoveryPaymentMode("cash")}
                      className="w-5 h-5 text-blue-600"
                    />
                    <Wallet size={20} className="text-gray-600" />
                    <span className="font-medium text-gray-700">Cash</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="fullLoanRecoveryPaymentMode"
                      checked={fullLoanRecoveryPaymentMode.online}
                      onChange={() => handleFullLoanRecoveryPaymentMode("online")}
                      className="w-5 h-5 text-blue-600"
                    />
                    <CreditCard size={20} className="text-gray-600" />
                    <span className="font-medium text-gray-700">Online</span>
                  </label>
                </div>

                {fullLoanRecoveryPaymentMode.online && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
                    <Select
                      label="Select Bank *"
                      name="fullLoanRecoveryBankId"
                      value={fullLoanRecoveryBankId}
                      handleChange={(e) => setFullLoanRecoveryBankId(e.target.value)}
                      options={groupBanks.length > 0
                        ? groupBanks.map((bank) => {
                          const balance = bank.available_balance !== undefined
                            ? bank.available_balance
                            : (bank.current_balance !== undefined
                              ? bank.current_balance
                              : (bank.opening_balance || 0));
                          const balanceFormatted = `₹${balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                          return {
                            value: bank._id || bank.id,
                            label: `${bank.bank_name} - ${bank.account_no}${bank.short_name ? ` (${bank.short_name})` : ""} [Available: ${balanceFormatted}]`
                          };
                        })
                        : [{ value: "", label: "No banks available" }]
                      }
                      required
                    />
                    {groupBanks.length === 0 && (
                      <p className="text-sm text-red-600 mt-1">
                        No banks found for this group. Please add a bank account first.
                      </p>
                    )}
                    <Input
                      label="Reference Number / Transaction ID *"
                      name="fullLoanRecoveryOnlineRef"
                      value={fullLoanRecoveryOnlineRef}
                      handleChange={(e) => setFullLoanRecoveryOnlineRef(e.target.value)}
                      placeholder="Enter reference number"
                      required
                    />
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Screenshot (Optional)
                      </label>
                      <label className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                        <Upload size={20} className="text-gray-600" />
                        <span className="text-sm text-gray-700">Choose File</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFullLoanRecoveryFileUpload}
                          className="hidden"
                        />
                      </label>
                      {fullLoanRecoveryScreenshot && (
                        <img src={fullLoanRecoveryScreenshot} alt="Screenshot" className="mt-2 max-w-xs rounded-lg" />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons 
              <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowFullLoanRecovery(false);
                    setFullLoanRecoveryPaymentMode({ cash: false, online: false });
                    setFullLoanRecoveryBankId("");
                    setFullLoanRecoveryOnlineRef("");
                    setFullLoanRecoveryScreenshot(null);
                  }}
                  className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleFullLoanRecovery}
                  disabled={loading}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      Recover Full Loan
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      */}
    </div>
  );
}
