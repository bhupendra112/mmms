import React, { useEffect, useMemo, useState } from "react";
import { DollarSign, RefreshCw, CloudOff } from "lucide-react";
import { exportRecoveryToExcel } from "../../utils/exportUtils";
import { useGroup } from "../../contexts/GroupContext";
import { useOffline } from "../../contexts/OfflineContext";
import { createApprovalRequest, getPendingApprovals } from "../../services/approvalDB";
import * as recoveryOffline from "../../services/recoveryServiceOffline";
import * as recoveryOnline from "../../services/recoveryService";
import { getLoans as getLoansOffline } from "../../services/loanServiceOffline";
import { getGroups as getGroupsOffline, getGroupBanks as getGroupBanksOffline } from "../../services/groupServiceOffline";
import { getMembersByGroup as getMembersByGroupOffline } from "../../services/memberServiceOffline";
import { getGroups, getGroupBanks } from "../../services/groupService";
import { getMembersByGroup } from "../../services/memberService";
import { getLoans } from "../../services/loanService";
import {
  isMeetingDay,
  getNextMeetingDate,
} from "../../utils/meetingDateUtils";
import { getDemandSummary as getDemandSummaryUtil } from "../../utils/recoveryUtils";

import CreateFD from "../../components/fd/CreateFD";
import GroupClusterSelector from "../../components/recovery/GroupClusterSelector";
import RecoveryProgressBar from "../../components/recovery/RecoveryProgressBar";
import MembersList from "../../components/recovery/MembersList";
import MemberRecoveryForm from "../../components/recovery/MemberRecoveryForm";
import RecoverySummaryStep from "../../components/recovery/RecoverySummaryStep";
import FullLoanRecoveryModal from "../../components/recovery/FullLoanRecoveryModal";

export default function DemandRecovery() {
  const { currentGroup, isGroupPanel, isGroupLoading } = useGroup();
  const { isOnline, triggerRefresh, lastRefreshedAt } = useOffline();
  const isAdminMode = !isGroupPanel;
  // Admin always uses direct backend; group panel uses offline-first service
  const recovery = isAdminMode ? recoveryOnline : recoveryOffline;

  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState(null); // { name, code }
  const [allMembers, setAllMembers] = useState([]);
  const [recoveries, setRecoveries] = useState([]);
  const [currentMemberIndex, setCurrentMemberIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  // Start at step 1 if group panel, step 0 if admin
  const [currentStep, setCurrentStep] = useState(() => (isAdminMode ? 0 : 1)); // 0: Select Group, 1: Entry, 2: Summary
  const [selectedGroup, setSelectedGroup] = useState(null);

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
    charges: {},
  });
  const [totalAmount, setTotalAmount] = useState("");
  const [autoCalculated, setAutoCalculated] = useState(false);
  const [fdTimePeriod, setFdTimePeriod] = useState("");

  const [paymentMode, setPaymentMode] = useState({ cash: false, online: false });
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
  const [fullLoanRecoveryPaymentMode, setFullLoanRecoveryPaymentMode] = useState({
    cash: false,
    online: false,
  });
  const [fullLoanRecoveryBankId, setFullLoanRecoveryBankId] = useState("");
  const [fullLoanRecoveryOnlineRef, setFullLoanRecoveryOnlineRef] = useState("");
  const [fullLoanRecoveryScreenshot, setFullLoanRecoveryScreenshot] = useState(null);

  const [refreshInProgress, setRefreshInProgress] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState(null);

  const [loanTotals, setLoanTotals] = useState({
    totalLoanAmount: 0,
    totalLoanRecovered: 0,
    remainingLoanAmount: 0,
  });
  const [loadingLoanTotals, setLoadingLoanTotals] = useState(false);

  const [memberLoanTotals, setMemberLoanTotals] = useState({});
  const [loanDetails, setLoanDetails] = useState({});
  const [memberRecoveryStatus, setMemberRecoveryStatus] = useState({});
  const [showLoanBreakdown, setShowLoanBreakdown] = useState({});

  // Demand cache
  const [previousRecoveryData, setPreviousRecoveryData] = useState({});
  const [activeLoans, setActiveLoans] = useState({});
  const [demandSummaries, setDemandSummaries] = useState({});

  // Determine active group
  const activeGroup = currentGroup || selectedGroup;

  // Meeting helpers (not used in UI here, but keeping logic)
  const todayDate = useMemo(() => new Date(), []);
  const isTodayMeetingDay = activeGroup ? isMeetingDay(todayDate, activeGroup) : false;
  const nextMeetingDate = activeGroup ? getNextMeetingDate(activeGroup) : null;

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

  // Responsive-safe wrapper demand summary (FIX: always pass required args)
  const getMemberDemandSummary = (memberId) => {
    const summary = getDemandSummaryUtil(memberId, recoveries, demandSummaries);
    return summary;
  };

  // Admin mode: load groups list
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
  }, [isAdminMode, lastRefreshedAt]);

  // Load members when active group changes (admin: memberService, group: memberServiceOffline)
  useEffect(() => {
    if (!activeGroup?.id) {
      setAllMembers([]);
      return;
    }
    const fetchMembers = isAdminMode ? getMembersByGroup : getMembersByGroupOffline;
    fetchMembers(activeGroup.id)
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
        console.error("Failed to load members:", e);
        setAllMembers([]);
      });
  }, [activeGroup?.id, isAdminMode, lastRefreshedAt]);

  // Load active loans (admin: loanService, group: loanServiceOffline)
  useEffect(() => {
    if (!activeGroup?.id) return;

    const fetchLoans = isAdminMode ? getLoans : getLoansOffline;
    fetchLoans(activeGroup.id)
      .then((res) => {
        const loans = Array.isArray(res?.data) ? res.data : [];
        const loansByMember = {};
        loans.forEach((loan) => {
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
  }, [activeGroup?.id, isAdminMode, lastRefreshedAt]);

  // Load group banks (admin: groupService, group: groupServiceOffline)
  useEffect(() => {
    const groupId = activeGroup?.id;
    if (!groupId) {
      setGroupBanks([]);
      setSelectedBankId("");
      return;
    }
    const fetchBanks = isAdminMode ? getGroupBanks : getGroupBanksOffline;
    fetchBanks(groupId)
      .then((res) => {
        const banks = Array.isArray(res?.data) ? res.data : [];
        setGroupBanks(banks);
      })
      .catch((e) => {
        console.error("Error loading banks:", e);
        setGroupBanks([]);
      });
  }, [activeGroup?.id, isAdminMode, lastRefreshedAt]);

  const loadRecoveries = async () => {
    if (!activeGroup?.id) return;
    try {
      setLoading(true);
      const today = new Date().toLocaleDateString("en-GB");
      const response = await recovery.getRecoveryByDate(activeGroup.id, today);

      if (response?.success && response?.data?.recoveries) {
        const memberRecoveries = response.data.recoveries.map((rec) => ({
          ...rec,
          id: rec.memberId,
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

  // Load recoveries when group changes
  useEffect(() => {
    if (activeGroup?.id) loadRecoveries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroup?.id, lastRefreshedAt]);

  // Current member derived
  const currentMember = allMembers[currentMemberIndex];
  const currentMemberSummary = currentMember ? getMemberDemandSummary(currentMember.id) : null;

  // Check recovery status + demand details + loan totals when member changes
  useEffect(() => {
    if (!activeGroup?.id || !allMembers.length || currentMemberIndex < 0) return;
    const member = allMembers[currentMemberIndex];
    if (!member?.id) return;

    const today = new Date().toLocaleDateString("en-GB");

    recovery.getMemberRecoveryStatus(member.id, activeGroup.id, today)
      .then((res) => {
        if (res?.success) {
          setMemberRecoveryStatus((prev) => ({ ...prev, [member.id]: res.data }));
        }
      })
      .catch((err) => {
        console.error("Error loading recovery status:", err);
        setMemberRecoveryStatus((prev) => ({
          ...prev,
          [member.id]: { recoveredToday: false, recovery: null },
        }));
      });

    recovery.getPreviousRecoveryData(activeGroup.id, member.id, today)
      .then((res) => {
        if (res?.success) {
          setPreviousRecoveryData((prev) => ({ ...prev, [member.id]: res.data }));
        }
      })
      .catch((err) => console.error("Error loading previous recovery data:", err));

    recovery.getDemandDetails(activeGroup.id, member.id, today)
      .then((res) => {
        console.log("[DEBUG DemandRecovery] getDemandDetails response", { memberId: member.id, success: res?.success, hasData: !!res?.data });
        if (res?.success && res?.data) {
          // FIX: Store res.data.data (the actual demandDetails) instead of res.data (the wrapper)
          const demandDetails = res.data.data || res.data;
          console.log("[DEBUG DemandRecovery] demandDetails for member", member.id, "interest", demandDetails?.interest);
          setDemandSummaries((prev) => ({ ...prev, [member.id]: demandDetails }));
        }
      })
      .catch((err) => {
        console.error("Error loading demand details:", err);
      });

    recovery.getMemberLoanTotals(activeGroup.id, member.id)
      .then((res) => {
        if (res?.success && res?.data) {
          setMemberLoanTotals((prev) => ({
            ...prev,
            [member.id]: {
              totalLoanAmount: res.data.totalLoanAmount ?? 0,
              totalLoanRecovered: res.data.totalLoanRecovered ?? 0,
              remainingLoanAmount: res.data.remainingLoanAmount ?? 0,
              openingYogdan: res.data.openingYogdan ?? 0,
              totalYogdanRecovered: res.data.totalYogdanRecovered ?? 0,
              remainingYogdanAmount: res.data.remainingYogdanAmount ?? 0,
              openingOverdueInterest: res.data.openingOverdueInterest ?? 0,
              totalOverdueInterestRecovered: res.data.totalOverdueInterestRecovered ?? 0,
              remainingOverdueInterestAmount: res.data.remainingOverdueInterestAmount ?? 0,
            },
          }));

          if (Array.isArray(res.data.loans)) {
            setLoanDetails((prev) => ({ ...prev, [member.id]: res.data.loans }));
          }
        }
      })
      .catch((err) => console.error("Error loading loan totals:", err));
  }, [activeGroup?.id, currentMemberIndex, allMembers]);

  // Recovery status: same as admin - once recovered for this day, cannot recover again (from API status + today's recoveries list)
  const currentMemberRecoveryStatus = currentMember ? memberRecoveryStatus[currentMember.id] : null;
  const hasRecoveryInSession = currentMember && recoveries.some(
    (r) => (r.memberId === currentMember.id || r.memberId === currentMember.id?.toString()) &&
      (r.attendance === "present" || (r.attendance === "absent" && r.recoveryByOther))
  );
  const isAlreadyRecovered = currentMemberRecoveryStatus?.recoveredToday || hasRecoveryInSession || false;

  // Admin group selection
  const handleSelectGroup = (group) => {
    setSelectedGroup(group);
    setCurrentStep(1);
    setRecoveries([]);
    setCurrentMemberIndex(0);
    resetForm();
  };

  // Amount change validation
  const handleAmountChange = (fieldName, value) => {
    const numValue = parseFloat(value) || 0;

    let maxValue = 0;
    if (fieldName === "loan" && currentMember) {
      const currentLoanTotals = memberLoanTotals[currentMember.id];
      maxValue = currentLoanTotals?.remainingLoanAmount ?? 0;
    } else {
      maxValue = currentMemberSummary?.[fieldName]?.total || 0;
    }

    if (fieldName === "saving") {
      setAmountBreakup({ ...amountBreakup, [fieldName]: value });
      setAutoCalculated(false);
      return;
    }

    if (value === "" || value == null) {
      setAmountBreakup({ ...amountBreakup, [fieldName]: value });
      setAutoCalculated(false);
    } else if (numValue <= maxValue) {
      setAmountBreakup({ ...amountBreakup, [fieldName]: value });
      setAutoCalculated(false);
    } else {
      alert(`Amount cannot exceed the due amount of ₹${maxValue.toLocaleString()}`);
      setAmountBreakup({ ...amountBreakup, [fieldName]: String(maxValue) });
      setAutoCalculated(false);
    }
  };

  // FIX: this was calling getDemandSummary incorrectly earlier.
  const handleTotalAmountChange = (value) => {
    setTotalAmount(value);
    const total = parseFloat(value) || 0;

    if (!(total > 0) || !currentMember) {
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
      return;
    }

    const summary = getMemberDemandSummary(currentMember.id);

    const savingDue = parseFloat(summary?.saving?.total ?? 0) || 0;
    const loanDue = parseFloat(summary?.loan?.total ?? 0) || 0;
    const loanCurr = parseFloat(summary?.loan?.curr ?? 0) || 0;
    const loanUnpaid = parseFloat(summary?.loan?.unpaid ?? 0) || 0;
    const interestDue = parseFloat(summary?.interest?.total ?? 0) || 0;
    const yogdanDue = parseFloat(summary?.yogdan?.total ?? summary?.yogdan?.unpaid ?? 0) || 0;

    const membershipFeesDue = parseFloat(summary?.memFeesSHG?.curr ?? 0) || 0;
    const membershipGroupDue = parseFloat(summary?.memFeesGroup?.curr ?? 0) || 0;
    const memFeesSamitiDue = parseFloat(summary?.memFeesSamiti?.curr ?? 0) || 0;

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

    const chargesDue = summary?.charges?.chargesDue || {};

    // Priority: Yogdan -> MemFeesGroup -> MemFeesSHG -> MemFeesSamiti -> Charges -> Interest -> Loan -> Saving -> FD -> Penalty
    // Loan comes before Saving to ensure loan repayment is prioritized
    if (yogdanDue > 0 && remaining > 0) {
      const v = Math.min(yogdanDue, remaining);
      calculated.yogdan = v.toFixed(2);
      remaining -= v;
    }

    if (membershipGroupDue > 0 && remaining > 0) {
      const v = Math.min(membershipGroupDue, remaining);
      calculated.memFeesGroup = v.toFixed(2);
      remaining -= v;
    }

    if (membershipFeesDue > 0 && remaining > 0) {
      const v = Math.min(membershipFeesDue, remaining);
      calculated.memFeesSHG = v.toFixed(2);
      remaining -= v;
    }

    if (memFeesSamitiDue > 0 && remaining > 0) {
      const v = Math.min(memFeesSamitiDue, remaining);
      calculated.memFeesSamiti = v.toFixed(2);
      remaining -= v;
    }

    if (Object.keys(chargesDue).length > 0 && remaining > 0) {
      const calculatedCharges = {};
      Object.keys(chargesDue).forEach((chargeName) => {
        const due = parseFloat(chargesDue[chargeName] ?? 0) || 0;
        if (due > 0 && remaining > 0) {
          const v = Math.min(due, remaining);
          calculatedCharges[chargeName] = v.toFixed(2);
          remaining -= v;
        }
      });
      calculated.charges = calculatedCharges;
    }

    if (interestDue > 0 && remaining > 0) {
      const v = Math.min(interestDue, remaining);
      calculated.interest = v.toFixed(2);
      remaining -= v;
    }

    // Calculate loan BEFORE saving to prioritize loan repayment
    const currentLoanTotals = memberLoanTotals[currentMember.id];
    const remainingLoanAmount = currentLoanTotals?.remainingLoanAmount ?? 0;
    // Only consider loan fully paid if we have loan totals AND remaining amount is 0 or fully recovered
    const isLoanFullyPaid = currentLoanTotals
      ? (remainingLoanAmount <= 0 ||
        currentLoanTotals.totalLoanRecovered >= currentLoanTotals.totalLoanAmount)
      : false;

    // Calculate effective loan due with multiple fallbacks:
    // 1. Use remainingLoanAmount from memberLoanTotals (most accurate - actual remaining loan)
    // 2. Fallback to loanDue from summary (total demand)
    // 3. Fallback to loanUnpaid from summary (unpaid demand)
    // 4. Fallback to loanCurr from summary (current demand)
    // This ensures loan is calculated even if one source is 0 or not loaded yet
    let effectiveLoanDue = 0;

    // Get the maximum loan amount from summary (use the highest available)
    const maxLoanFromSummary = Math.max(loanDue, loanUnpaid, loanCurr);

    if (remainingLoanAmount > 0) {
      // If we have remaining loan amount, use it (capped by maxLoanFromSummary if it's smaller and > 0)
      // This ensures we don't exceed the actual remaining loan, but use summary data if it's more restrictive
      effectiveLoanDue = maxLoanFromSummary > 0
        ? Math.min(maxLoanFromSummary, remainingLoanAmount)
        : remainingLoanAmount;
    } else if (maxLoanFromSummary > 0) {
      // Fallback to summary data if no remainingLoanAmount available or it's 0
      effectiveLoanDue = maxLoanFromSummary;
    }

    // Calculate loan if we have effective loan due and remaining amount
    // Only skip if loan is explicitly marked as fully paid from loan totals AND we don't have summary data
    // If we have loan due from summary, always allow calculation (summary is more up-to-date)
    const hasLoanFromSummary = loanDue > 0 || loanUnpaid > 0 || loanCurr > 0;

    // Always calculate if we have effective loan due and remaining, unless:
    // - Loan is fully paid from loan totals AND we don't have summary data suggesting otherwise
    if (effectiveLoanDue > 0 && remaining > 0) {
      if (!isLoanFullyPaid || hasLoanFromSummary) {
        const v = Math.min(effectiveLoanDue, remaining);
        calculated.loan = v.toFixed(2);
        remaining -= v;
      }
    }

    // Calculate saving AFTER loan to ensure loan gets priority
    if (savingDue > 0 && remaining > 0) {
      const v = Math.min(savingDue, remaining);
      calculated.saving = v.toFixed(2);
      remaining -= v;
    }

    const fdDue = parseFloat(summary?.fd?.total ?? 0) || 0;
    if (fdDue > 0 && remaining > 0) {
      const v = Math.min(fdDue, remaining);
      calculated.fd = v.toFixed(2);
      remaining -= v;
    }

    const penaltyDue = parseFloat(summary?.penalty?.total ?? 0) || 0;
    if (penaltyDue > 0 && remaining > 0) {
      const v = Math.min(penaltyDue, remaining);
      calculated.penalty = v.toFixed(2);
      remaining -= v;
    }

    if (remaining > 0) {
      const cur = parseFloat(calculated.saving ?? 0) || 0;
      calculated.saving = (cur + remaining).toFixed(2);
    }

    setAmountBreakup(calculated);
    setAutoCalculated(true);
  };

  const handleAttendanceChange = (value) => {
    setAttendance(value);
    if (value === "present") {
      setRecoveryByOther(false);
      setOtherMemberId("");
    }
  };

  // Payment mode (single select)
  const handlePaymentModeChange = (mode) => {
    if (mode === "cash") {
      setPaymentMode({ cash: true, online: false });
      setSelectedBankId("");
      setOnlineRef("");
    } else {
      setPaymentMode({ cash: false, online: true });
    }
  };

  const handleFullLoanRecoveryPaymentMode = (mode) => {
    if (mode === "cash") {
      setFullLoanRecoveryPaymentMode({ cash: true, online: false });
      setFullLoanRecoveryBankId("");
      setFullLoanRecoveryOnlineRef("");
    } else {
      setFullLoanRecoveryPaymentMode({ cash: false, online: true });
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setScreenshot(reader.result);
    reader.readAsDataURL(file);
  };

  const handleFullLoanRecoveryFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setFullLoanRecoveryScreenshot(reader.result);
    reader.readAsDataURL(file);
  };

  const handleCapturePhoto = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onloadend = () => setGroupPhoto(reader.result);
      reader.readAsDataURL(file);
    };
    input.click();
  };

  // Totals (FIX: do not shadow imported calculateTotals; keep local name)
  const totals = useMemo(() => {
    let totalCash = 0;
    let totalOnline = 0;
    let totalAmountSum = 0;

    recoveries.forEach((recovery) => {
      if (recovery.attendance === "present" || (recovery.attendance === "absent" && recovery.recoveryByOther)) {
        const saving = parseFloat(recovery.amounts?.saving ?? 0) || 0;
        const loan = parseFloat(recovery.amounts?.loan ?? 0) || 0;
        const fd = parseFloat(recovery.amounts?.fd ?? 0) || 0;
        const interest = parseFloat(recovery.amounts?.interest ?? 0) || 0;
        const yogdan = parseFloat(recovery.amounts?.yogdan ?? 0) || 0;
        const memFeesSHG = parseFloat(recovery.amounts?.memFeesSHG ?? 0) || 0;
        const memFeesSamiti = parseFloat(recovery.amounts?.memFeesSamiti ?? 0) || 0;
        const memFeesGroup = parseFloat(recovery.amounts?.memFeesGroup ?? 0) || 0;
        const penalty = parseFloat(recovery.amounts?.penalty ?? 0) || 0;

        const other =
          (parseFloat(recovery.amounts?.other1 ?? 0) || 0) +
          (parseFloat(recovery.amounts?.other2 ?? 0) || 0) +
          (parseFloat(recovery.amounts?.other ?? 0) || 0);

        const chargesTotal = recovery.amounts?.charges
          ? Object.values(recovery.amounts.charges).reduce(
            (sum, amount) => sum + (parseFloat(amount ?? 0) || 0),
            0
          )
          : 0;

        const memberTotal =
          saving +
          loan +
          fd +
          interest +
          yogdan +
          memFeesSHG +
          memFeesSamiti +
          memFeesGroup +
          penalty +
          other +
          chargesTotal;

        totalAmountSum += memberTotal;

        if (recovery.paymentMode?.cash) totalCash += memberTotal;
        if (recovery.paymentMode?.online) totalOnline += memberTotal;
      }
    });

    return { totalCash, totalOnline, totalAmount: totalAmountSum };
  }, [recoveries]);

  const allMembersProcessed = useMemo(() => {
    return allMembers.every((m) => recoveries.some((r) => r.memberId === m.id));
  }, [allMembers, recoveries]);

  const goToMember = (index) => {
    setCurrentMemberIndex(index);
    resetForm();

    const memberRecovery = recoveries.find((r) => r.memberId === allMembers[index]?.id);
    if (memberRecovery) {
      setAttendance(memberRecovery.attendance || "present");
      setRecoveryByOther(Boolean(memberRecovery.recoveryByOther));
      setOtherMemberId(memberRecovery.otherMemberId || "");
      setAmountBreakup(memberRecovery.amounts || { saving: "", loan: "", fd: "", interest: "", yogdan: "", other: "", charges: {} });
      setFdTimePeriod(memberRecovery.fd_time_period ? String(memberRecovery.fd_time_period / 12) : "");
      setPaymentMode(memberRecovery.paymentMode || { cash: false, online: false });
      setOnlineRef(memberRecovery.onlineRef || "");
      setSelectedBankId(memberRecovery.bankId || "");
      if (memberRecovery.screenshot) setScreenshot(memberRecovery.screenshot);
    }
  };

  const handleSaveRecovery = async () => {
    if (isAlreadyRecovered) {
      alert("Demand for this member has already been recovered today.");
      return;
    }

    if (!activeGroup?.id) {
      alert("Group information is missing. Please select a group.");
      return;
    }

    if (!currentMember?.id) {
      alert("Member information is missing.");
      return;
    }

    // Absent (no recovery)
    if (attendance === "absent" && !recoveryByOther) {
      try {
        setLoading(true);
        const today = new Date().toLocaleDateString("en-GB");

        await recovery.updateMemberRecovery(activeGroup.id, today, {
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
            memFeesGroup: 0,
            penalty: 0,
            other: 0,
            charges: {},
          },
          paymentMode: { cash: false, online: false },
        });

        await loadRecoveries();

        if (currentMemberIndex < allMembers.length - 1) {
          setCurrentMemberIndex((i) => i + 1);
          resetForm();
        } else {
          setCurrentStep(2);
        }
      } catch (error) {
        console.error("Error saving recovery:", error);
        alert(error?.response?.data?.message || error?.message || "Error saving record");
      } finally {
        setLoading(false);
      }
      return;
    }

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

    const saving = parseFloat(amountBreakup.saving ?? 0) || 0;
    const loan = parseFloat(amountBreakup.loan ?? 0) || 0;
    const fd = parseFloat(amountBreakup.fd ?? 0) || 0;
    const interest = parseFloat(amountBreakup.interest ?? 0) || 0;
    const yogdan = parseFloat(amountBreakup.yogdan ?? 0) || 0;
    const memFeesSHG = parseFloat(amountBreakup.memFeesSHG ?? 0) || 0;
    const memFeesSamiti = parseFloat(amountBreakup.memFeesSamiti ?? 0) || 0;
    const memFeesGroup = parseFloat(amountBreakup.memFeesGroup ?? 0) || 0;
    const penalty = parseFloat(amountBreakup.penalty ?? 0) || 0;
    const other = parseFloat(amountBreakup.other ?? 0) || 0;

    const chargesTotal = amountBreakup.charges
      ? Object.values(amountBreakup.charges).reduce((sum, amount) => sum + (parseFloat(amount ?? 0) || 0), 0)
      : 0;

    const total = saving + loan + fd + interest + yogdan + memFeesSHG + memFeesSamiti + memFeesGroup + penalty + other + chargesTotal;

    if (total === 0) {
      alert("Please enter at least one amount");
      return;
    }

    try {
      setLoading(true);
      const today = new Date().toLocaleDateString("en-GB");

      const openingFd = currentMember?.fdDetails?.amount || currentMember?.raw?.fdDetails?.amount || 0;
      const isNewFd = openingFd === 0 && fd > 0;
      const fdRateSnapshot = isNewFd ? (activeGroup?.raw?.fd_rate || activeGroup?.fd_rate || null) : null;

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
        fd_time_period: isNewFd && fdTimePeriod ? Math.round(parseFloat(fdTimePeriod) * 12) : null,
        fd_rate_snapshot: fdRateSnapshot,
        paymentMode,
        onlineRef: paymentMode.online ? onlineRef : null,
        bankId: paymentMode.online ? selectedBankId : null,
        screenshot: screenshot || null,
      };

      await recovery.updateMemberRecovery(activeGroup.id, today, memberRecovery);
      await loadRecoveries();

      if (currentMemberIndex < allMembers.length - 1) {
        setCurrentMemberIndex((i) => i + 1);
        resetForm();
      } else {
        setCurrentStep(2);
      }
    } catch (error) {
      console.error("Error saving recovery:", error);
      alert(error?.response?.data?.message || error?.message || "Error saving record");
    } finally {
      setLoading(false);
    }
  };

  // Fetch loan totals when modal opens
  useEffect(() => {
    if (!showFullLoanRecovery || !activeGroup?.id || !currentMember?.id) return;

    setLoadingLoanTotals(true);
    recovery.getMemberLoanTotals(activeGroup.id, currentMember.id)
      .then((res) => {
        if (res?.success && res?.data) {
          setLoanTotals({
            totalLoanAmount: res.data.totalLoanAmount ?? 0,
            totalLoanRecovered: res.data.totalLoanRecovered ?? 0,
            remainingLoanAmount: res.data.remainingLoanAmount ?? 0,
          });

          setMemberLoanTotals((prev) => ({
            ...prev,
            [currentMember.id]: {
              ...prev[currentMember.id],
              totalLoanAmount: res.data.totalLoanAmount ?? 0,
              totalLoanRecovered: res.data.totalLoanRecovered ?? 0,
              remainingLoanAmount: res.data.remainingLoanAmount ?? 0,
            },
          }));

          if (Array.isArray(res.data.loans)) {
            setLoanDetails((prev) => ({ ...prev, [currentMember.id]: res.data.loans }));
          }
        }
      })
      .catch((err) => {
        console.error("Error loading loan totals:", err);
        setLoanTotals({ totalLoanAmount: 0, totalLoanRecovered: 0, remainingLoanAmount: 0 });
      })
      .finally(() => setLoadingLoanTotals(false));
  }, [showFullLoanRecovery, activeGroup?.id, currentMember?.id]);

  const handleFullLoanRecovery = async () => {
    if (!activeGroup?.id) {
      alert("Group information is missing. Please select a group.");
      return;
    }
    if (!currentMember?.id) {
      alert("Member information is missing.");
      return;
    }

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

    const currentLoanTotals = memberLoanTotals[currentMember.id];
    const remainingLoanAmount =
      currentLoanTotals?.remainingLoanAmount ?? loanTotals.remainingLoanAmount ?? 0;

    if (remainingLoanAmount <= 0) {
      alert("No remaining loan amount to recover.");
      setShowFullLoanRecovery(false);
      return;
    }

    try {
      setLoading(true);
      const today = new Date().toLocaleDateString("en-GB");

      const memberRecovery = {
        memberId: currentMember.id,
        memberCode: currentMember.code,
        memberName: currentMember.name,
        attendance: "present",
        recoveryByOther: false,
        otherMemberId: null,
        amounts: {
          saving: 0,
          loan: remainingLoanAmount,
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

      await recovery.updateMemberRecovery(activeGroup.id, today, memberRecovery);
      await loadRecoveries();

      setShowFullLoanRecovery(false);
      setFullLoanRecoveryPaymentMode({ cash: false, online: false });
      setFullLoanRecoveryBankId("");
      setFullLoanRecoveryOnlineRef("");
      setFullLoanRecoveryScreenshot(null);

      alert(`Full loan recovery of ₹${remainingLoanAmount.toLocaleString()} saved successfully!`);

      // refresh demand details
      recovery.getDemandDetails(activeGroup.id, currentMember.id, today)
        .then((res) => {
          console.log("[DEBUG DemandRecovery] getDemandDetails refresh after full loan", { memberId: currentMember.id, success: res?.success, hasData: !!res?.data });
          if (res?.success && res?.data) {
            // FIX: Store res.data.data (the actual demandDetails) instead of res.data (the wrapper)
            const demandDetails = res.data.data || res.data;
            console.log("[DEBUG DemandRecovery] refreshed demandDetails interest", demandDetails?.interest);
            setDemandSummaries((prev) => ({ ...prev, [currentMember.id]: demandDetails }));
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

  const handleGetFreshData = async () => {
    if (!isOnline) {
      setRefreshMessage({ type: "error", text: "You are offline. Connect to the internet to fetch fresh data." });
      setTimeout(() => setRefreshMessage(null), 4000);
      return;
    }
    setRefreshMessage(null);
    setRefreshInProgress(true);
    try {
      await triggerRefresh();
      setRefreshMessage({ type: "success", text: "Full fresh data loaded (groups, members, loans, FDs, payments, recoveries, expenses)." });
      setTimeout(() => setRefreshMessage(null), 4000);
    } catch (err) {
      setRefreshMessage({ type: "error", text: err?.message || "Failed to fetch fresh data." });
      setTimeout(() => setRefreshMessage(null), 5000);
    } finally {
      setRefreshInProgress(false);
    }
  };

  const handleFinalize = async () => {
    if (!groupPhoto) {
      alert("Please take group photo");
      return;
    }

    try {
      setLoading(true);
      const today = new Date().toLocaleDateString("en-GB");

      // Cash denomination validation
      if (totals.totalCash > 0) {
        const calculatedTotal =
          (parseFloat(cashDenominations.note200) || 0) * 200 +
          (parseFloat(cashDenominations.note500) || 0) * 500 +
          (parseFloat(cashDenominations.note100) || 0) * 100 +
          (parseFloat(cashDenominations.note50) || 0) * 50 +
          (parseFloat(cashDenominations.note20) || 0) * 20 +
          (parseFloat(cashDenominations.note10) || 0) * 10 +
          (parseFloat(cashDenominations.note5) || 0) * 5 +
          (parseFloat(cashDenominations.note2) || 0) * 2 +
          (parseFloat(cashDenominations.note1) || 0) * 1;

        const roundedTotalCash =
          totals.totalCash >= 0
            ? Math.floor(totals.totalCash) + (totals.totalCash % 1 >= 0.5 ? 1 : 0)
            : Math.ceil(totals.totalCash) - (Math.abs(totals.totalCash) % 1 >= 0.5 ? 1 : 0);

        const roundedCalculatedTotal = Math.round(calculatedTotal);

        if (Math.abs(roundedCalculatedTotal - roundedTotalCash) > 1) {
          alert(
            `Cash denominations sum (₹${roundedCalculatedTotal.toLocaleString()}) does not match Total Cash (₹${roundedTotalCash.toLocaleString()}). Please verify the note counts.`
          );
          return;
        }
      }

      await recovery.updateRecoveryPhoto(
        activeGroup.id,
        today,
        groupPhoto,
        totals.totalCash > 0
          ? {
            note200: parseFloat(cashDenominations.note200) || 0,
            note500: parseFloat(cashDenominations.note500) || 0,
            note100: parseFloat(cashDenominations.note100) || 0,
            note50: parseFloat(cashDenominations.note50) || 0,
            note20: parseFloat(cashDenominations.note20) || 0,
            note10: parseFloat(cashDenominations.note10) || 0,
            note5: parseFloat(cashDenominations.note5) || 0,
            note2: parseFloat(cashDenominations.note2) || 0,
            note1: parseFloat(cashDenominations.note1) || 0,
          }
          : null
      );

      if (currentGroup) {
        // Prevent duplicate recovery approval for same day (same as admin: one approval per session)
        const pending = await getPendingApprovals(activeGroup.id);
        const existingRecoveryForToday = pending.some(
          (a) => a.type === "recovery" && a.data?.date === today
        );
        if (existingRecoveryForToday) {
          alert("Recovery for this date has already been submitted for approval.");
          setLoading(false);
          return;
        }
        await createApprovalRequest(
          "recovery",
          {
            groupId: activeGroup.id,
            groupName: activeGroup.name,
            date: today,
            groupPhoto,
            totals,
            memberCount: allMembers.length,
          },
          activeGroup.id,
          activeGroup.name
        );
        alert("Recovery data submitted for approval!");
      } else {
        alert("Recovery data saved successfully!");
      }

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

  // ======= RESPONSIVE LAYOUT SAFETY (NO UI CHANGES INSIDE CHILD COMPONENTS) =======
  // - Use max-width container for desktop
  // - Step 1 uses responsive grid: list left (desktop), form right; stacked on mobile
  // - Sticky progress bar on large screens for better UX
  // - Prevent horizontal overflow
  // ============================================================================

  if (isGroupPanel && isGroupLoading) {
    return (
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 sm:p-8 text-center">
          <p className="text-blue-600 font-semibold text-sm sm:text-base">Loading group information...</p>
        </div>
      </div>
    );
  }

  if (isGroupPanel && !currentGroup) {
    return (
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 sm:p-8 text-center">
          <p className="text-yellow-800 font-semibold text-sm sm:text-base">No group found.</p>
          <p className="text-yellow-700 mt-2 text-xs sm:text-sm md:text-base">
            Please create a group in the admin panel first (Create Group), then refresh this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-hidden">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-5 md:py-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
            <div className="flex flex-col gap-2 sm:gap-3">
              <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2 sm:gap-3">
                <DollarSign className="shrink-0 w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
                <span className="truncate">Recovery Management</span>
              </h1>

              <p className="text-xs sm:text-sm md:text-base text-gray-600 break-words">
                {activeGroup
                  ? `Enter recovery for all members of ${activeGroup.name}`
                  : isAdminMode
                    ? "Select a group to start recovery process"
                    : "Loading group information..."}
              </p>
            </div>

            {/* Get Fresh Data Button */}
            {isOnline ? (
              <button
                type="button"
                onClick={handleGetFreshData}
                disabled={refreshInProgress || !activeGroup?.id}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                title="Fetch latest data from backend (groups, members, loans, FDs, payments, recoveries, expenses)"
              >
                <RefreshCw className={`w-4 h-4 shrink-0 ${refreshInProgress ? "animate-spin" : ""}`} />
                {refreshInProgress ? "Fetching…" : "Get full fresh data"}
              </button>
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-500 text-sm shrink-0">
                <CloudOff className="w-4 h-4" />
                <span className="hidden sm:inline">Offline – connect to get full fresh data</span>
                <span className="sm:hidden">Offline</span>
              </div>
            )}
          </div>
        </div>

        {/* Refresh Message */}
        {refreshMessage && (
          <div
            className={`mb-4 px-4 py-3 rounded-lg text-sm ${refreshMessage.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
              }`}
          >
            {refreshMessage.text}
          </div>
        )}

        {/* Step 0: Select Cluster & Group (Admin only) */}
        {isAdminMode && currentStep === 0 && (
          <div className="w-full">
            <GroupClusterSelector
              groups={groups}
              groupsLoading={groupsLoading}
              selectedCluster={selectedCluster}
              selectedGroup={selectedGroup}
              onSelectCluster={setSelectedCluster}
              onBackToClusters={() => setSelectedCluster(null)}
              onSelectGroup={handleSelectGroup}
            />
          </div>
        )}

        {/* Step 1: Recovery Entry */}
        {currentStep === 1 && activeGroup && (
          <div className="space-y-4 sm:space-y-5 md:space-y-6">
            {/* Progress Bar: make it sticky on md+ for better UX */}
            <div className="md:sticky md:top-3 z-10">
              <RecoveryProgressBar
                activeGroup={activeGroup}
                isAdminMode={isAdminMode}
                currentMemberIndex={currentMemberIndex}
                allMembers={allMembers}
                recoveries={recoveries}
                onBack={() => {
                  if (window.confirm("Are you sure you want to go back? All unsaved data will be lost.")) {
                    setSelectedGroup(null);
                    setAllMembers([]);
                    setRecoveries([]);
                    setCurrentMemberIndex(0);
                    setCurrentStep(0);
                    resetForm();
                  }
                }}
              />
            </div>

            {/* Responsive grid: Members list left on desktop, form right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 md:gap-6">
              {/* Members List */}
              <div className="lg:col-span-4">
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="max-h-[40vh] lg:max-h-[calc(100vh-220px)] overflow-auto">
                    <MembersList
                      allMembers={allMembers}
                      recoveries={recoveries}
                      currentMemberIndex={currentMemberIndex}
                      onMemberClick={goToMember}
                    />
                  </div>
                </div>
              </div>

              {/* Current Member Form */}
              <div className="lg:col-span-8 min-w-0">
                {currentMember && currentMemberSummary ? (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="p-2 sm:p-3 md:p-4">
                      <MemberRecoveryForm
                        currentMember={currentMember}
                        currentMemberSummary={currentMemberSummary}
                        isAlreadyRecovered={isAlreadyRecovered}
                        currentMemberRecoveryStatus={currentMemberRecoveryStatus}
                        attendance={attendance}
                        recoveryByOther={recoveryByOther}
                        otherMemberId={otherMemberId}
                        allMembers={allMembers}
                        amountBreakup={amountBreakup}
                        totalAmount={totalAmount}
                        autoCalculated={autoCalculated}
                        paymentMode={paymentMode}
                        selectedBankId={selectedBankId}
                        onlineRef={onlineRef}
                        screenshot={screenshot}
                        groupBanks={groupBanks}
                        memberLoanTotals={memberLoanTotals}
                        loanDetails={loanDetails}
                        showLoanBreakdown={showLoanBreakdown}
                        currentMemberIndex={currentMemberIndex}
                        allMembersLength={allMembers.length}
                        onFullLoanRecoveryClick={() => setShowFullLoanRecovery(true)}
                        onCreateFDClick={() => {
                          const fullMember = allMembers.find((m) => m.id === currentMember.id);
                          const memberData = fullMember?.raw
                            ? { ...fullMember.raw, group: activeGroup?.raw || activeGroup?.id || fullMember.raw.group }
                            : {
                              _id: currentMember.id,
                              id: currentMember.id,
                              Member_Id: currentMember.code,
                              Member_Nm: currentMember.name,
                              group: activeGroup?.raw || activeGroup?.id,
                            };

                          setSelectedMemberForFD(memberData);
                          setShowCreateFD(true);
                        }}
                        onToggleLoanBreakdown={(memberId) =>
                          setShowLoanBreakdown((prev) => ({ ...prev, [memberId]: !prev[memberId] }))
                        }
                        onAttendanceChange={handleAttendanceChange}
                        onRecoveryByOtherChange={setRecoveryByOther}
                        onOtherMemberIdChange={setOtherMemberId}
                        onTotalAmountChange={handleTotalAmountChange}
                        onAmountChange={handleAmountChange}
                        onAmountBreakupChange={setAmountBreakup}
                        onSetAutoCalculated={setAutoCalculated}
                        onPaymentModeChange={handlePaymentModeChange}
                        onBankIdChange={setSelectedBankId}
                        onOnlineRefChange={setOnlineRef}
                        onFileUpload={handleFileUpload}
                        onPrevious={() => {
                          if (currentMemberIndex > 0) {
                            setCurrentMemberIndex((i) => i - 1);
                            resetForm();
                          }
                        }}
                        onSaveRecovery={handleSaveRecovery}
                        onResetForm={resetForm}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 sm:p-6 text-center">
                    <p className="text-gray-700 text-sm sm:text-base">Loading member summary...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Summary & Photo */}
        {currentStep === 2 && allMembersProcessed && (
          <div className="w-full">
            <RecoverySummaryStep
              recoveries={recoveries}
              allMembers={allMembers}
              totals={totals}
              cashDenominations={cashDenominations}
              groupPhoto={groupPhoto}
              activeGroup={activeGroup}
              onExportExcel={() => exportRecoveryToExcel(recoveries, activeGroup.name)}
              onExportPDF={async () => {
                try {
                  const today = new Date().toLocaleDateString("en-GB");
                  const blob = await recovery.exportRecoveryPDF(activeGroup.id, today);
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${activeGroup.name || "Recovery"}_${today.replace(/\//g, "-")}.pdf`;
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(a);
                } catch (error) {
                  console.error("Error exporting PDF:", error);
                  alert("Failed to export PDF. Please try again.");
                }
              }}
              onCapturePhoto={handleCapturePhoto}
              onRemovePhoto={() => setGroupPhoto(null)}
              onCashDenominationsChange={setCashDenominations}
              onFinalize={handleFinalize}
            />
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
              if (!activeGroup?.id) return;
              const fetchMembers = isAdminMode ? getMembersByGroup : getMembersByGroupOffline;
              fetchMembers(activeGroup.id)
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
                .catch((e) => console.error("Failed to reload members:", e));
            }}
          />
        )}

        {/* Full Loan Recovery Modal */}
        <FullLoanRecoveryModal
          show={showFullLoanRecovery}
          currentMember={currentMember}
          loanTotals={loanTotals}
          loadingLoanTotals={loadingLoanTotals}
          loading={loading}
          fullLoanRecoveryPaymentMode={fullLoanRecoveryPaymentMode}
          fullLoanRecoveryBankId={fullLoanRecoveryBankId}
          fullLoanRecoveryOnlineRef={fullLoanRecoveryOnlineRef}
          fullLoanRecoveryScreenshot={fullLoanRecoveryScreenshot}
          groupBanks={groupBanks}
          onClose={() => {
            setShowFullLoanRecovery(false);
            setFullLoanRecoveryPaymentMode({ cash: false, online: false });
            setFullLoanRecoveryBankId("");
            setFullLoanRecoveryOnlineRef("");
            setFullLoanRecoveryScreenshot(null);
          }}
          onPaymentModeChange={handleFullLoanRecoveryPaymentMode}
          onBankIdChange={setFullLoanRecoveryBankId}
          onOnlineRefChange={setFullLoanRecoveryOnlineRef}
          onFileUpload={handleFullLoanRecoveryFileUpload}
          onSubmit={handleFullLoanRecovery}
        />
      </div>
    </div>
  );
}
