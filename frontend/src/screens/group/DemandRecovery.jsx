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
import PostFinalizeRecoveryModal from "../../components/recovery/PostFinalizeRecoveryModal";
import FullLoanRecoveryModal from "../../components/recovery/FullLoanRecoveryModal";

/** Default payment mode for meetings (most groups use cash) */
const DEFAULT_PAYMENT_MODE_CASH = { cash: true, online: false };

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
  const [fdTimePeriod, setFdTimePeriod] = useState("");

  const [paymentMode, setPaymentMode] = useState(DEFAULT_PAYMENT_MODE_CASH);
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
  const [fullLoanRecoveryPaymentMode, setFullLoanRecoveryPaymentMode] = useState(DEFAULT_PAYMENT_MODE_CASH);
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

  // Add penalty for member (decide penalty; then recover in form below) – shown only when user clicks "Add penalty"
  const [showAddPenalty, setShowAddPenalty] = useState(false);
  const [penaltyAmountToAdd, setPenaltyAmountToAdd] = useState("");
  const [penaltyNotesToAdd, setPenaltyNotesToAdd] = useState("");
  const [addPenaltyLoading, setAddPenaltyLoading] = useState(false);
  const [addPenaltyError, setAddPenaltyError] = useState(null);

  /** When true (after summary → "Edit member recoveries"), saving updates existing rows instead of being blocked as "already recovered". */
  const [recoveryEditMode, setRecoveryEditMode] = useState(false);

  /** After successful Finalize — show export/print/edit before clearing session state */
  const [showPostFinalizeModal, setShowPostFinalizeModal] = useState(false);
  const [postFinalizeMessage, setPostFinalizeMessage] = useState("");

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
    setFdTimePeriod("");
    setPaymentMode(DEFAULT_PAYMENT_MODE_CASH);
    setOnlineRef("");
    setSelectedBankId("");
    setScreenshot(null);
    setPenaltyAmountToAdd("");
    setPenaltyNotesToAdd("");
    setAddPenaltyError(null);
    setShowAddPenalty(false);
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
        // API returns { success, message, data: members }; support both res.data and res.data.data
        const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res?.data?.data) ? res.data.data : []);
        const mapped = list.map((m) => {
          const fh = (m?.F_H_Name ?? m?.F_H_FatherName ?? "").toString().trim();
          return {
            id: m._id,
            code: m.Member_Id,
            name: m.Member_Nm,
            fatherOrHusbandName: fh,
            raw: { ...m, F_H_Name: m?.F_H_Name ?? "", F_H_FatherName: m?.F_H_FatherName ?? "" },
            openingSaving: m.openingSaving || 0,
            loanDetails: m.loanDetails || {},
            fdDetails: m.fdDetails || {},
            openingYogdan: m.openingYogdan || 0,
            isExistingMember: m.isExistingMember || false,
          };
        });
        mapped.sort((a, b) =>
          String(a.code ?? "").localeCompare(String(b.code ?? ""), undefined, { numeric: true })
        );
        setAllMembers(mapped);
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
        if (res?.success && res?.data) {
          const demandDetails = res.data.data || res.data;
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
  const isAlreadyRecovered =
    !recoveryEditMode &&
    (currentMemberRecoveryStatus?.recoveredToday || hasRecoveryInSession || false);

  // Admin group selection
  const handleSelectGroup = (group) => {
    setSelectedGroup(group);
    setCurrentStep(1);
    setRecoveries([]);
    setCurrentMemberIndex(0);
    setRecoveryEditMode(false);
    resetForm();
  };

  // Add penalty demand for current member (decide penalty; then recover via form below)
  const handleAddPenalty = async () => {
    const amount = parseFloat(penaltyAmountToAdd);
    if (!(amount > 0)) {
      setAddPenaltyError("Enter a valid penalty amount.");
      return;
    }
    if (!activeGroup?.id || !currentMember?.id) {
      setAddPenaltyError("Group or member missing.");
      return;
    }
    setAddPenaltyError(null);
    setAddPenaltyLoading(true);
    try {
      await recoveryOnline.addPenaltyDemand(activeGroup.id, currentMember.id, amount, penaltyNotesToAdd.trim() || "");
      setPenaltyAmountToAdd("");
      setPenaltyNotesToAdd("");
      const today = new Date().toLocaleDateString("en-GB");
      const res = await recovery.getDemandDetails(activeGroup.id, currentMember.id, today);
      if (res?.success && res?.data) {
        const demandDetails = res.data.data || res.data;
        setDemandSummaries((prev) => ({ ...prev, [currentMember.id]: demandDetails }));
      }
    } catch (err) {
      setAddPenaltyError(err?.response?.data?.message || err?.message || "Failed to add penalty.");
    } finally {
      setAddPenaltyLoading(false);
    }
  };

  // Fixed integer for caps / display
  const roundAmount = (n) => Math.round(Number(n) || 0);

  /** Max recoverable for a demand line: prefer remaining unpaid, else total demand. */
  const scalarDemandCapFromSummary = (s) => {
    if (!s) return 0;
    const unpaidRaw = s.unpaid;
    if (unpaidRaw !== undefined && unpaidRaw !== null && unpaidRaw !== "") {
      return Math.max(0, roundAmount(parseFloat(unpaidRaw) || 0));
    }
    return Math.max(0, roundAmount(parseFloat(s.total) || 0));
  };

  /** Manual entry: loan capped by remaining principal; interest / FD / mem fees capped by demand. */
  const handleAmountChange = (fieldName, value) => {
    const numValue = parseFloat(value) || 0;

    let loanMaxValue = 0;
    if (fieldName === "loan" && currentMember) {
      const currentLoanTotals = memberLoanTotals[currentMember.id];
      const remainingLoan = currentLoanTotals?.remainingLoanAmount ?? 0;
      loanMaxValue = Math.max(0, parseFloat(remainingLoan) || 0);
    }

    const nextBreakup =
      fieldName === "charges" && typeof value === "object"
        ? { ...amountBreakup, charges: value || {} }
        : { ...amountBreakup, [fieldName]: value };

    if (
      !recoveryEditMode &&
      fieldName === "loan" &&
      value !== "" &&
      value != null &&
      loanMaxValue > 0 &&
      numValue > loanMaxValue
    ) {
      alert(`Loan amount cannot exceed the remaining loan amount of ₹${loanMaxValue.toLocaleString()}`);
      setAmountBreakup({ ...nextBreakup, [fieldName]: String(roundAmount(loanMaxValue)) });
      return;
    }

    const demandCappedFields = ["interest", "fd", "memFeesSHG", "memFeesGroup"];
    if (
      demandCappedFields.includes(fieldName) &&
      value !== "" &&
      value != null
    ) {
      const cap = scalarDemandCapFromSummary(currentMemberSummary?.[fieldName]);
      if (numValue > cap) {
        alert(
          `Amount cannot exceed demand of ₹${cap.toLocaleString()}`
        );
        setAmountBreakup({ ...nextBreakup, [fieldName]: cap > 0 ? String(Math.round(cap)) : "" });
        return;
      }
    }

    setAmountBreakup(nextBreakup);
  };

  /** Total amount is manual reference only — does not auto-distribute into breakup fields. */
  const handleTotalAmountChange = (value) => {
    setTotalAmount(value);
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

  const sumRecoveryAmounts = (a) => {
    if (!a) return 0;
    const saving = parseFloat(a.saving ?? 0) || 0;
    const loan = parseFloat(a.loan ?? 0) || 0;
    const fd = parseFloat(a.fd ?? 0) || 0;
    const interest = parseFloat(a.interest ?? 0) || 0;
    const yogdan = parseFloat(a.yogdan ?? 0) || 0;
    const memFeesSHG = parseFloat(a.memFeesSHG ?? 0) || 0;
    const memFeesSamiti = parseFloat(a.memFeesSamiti ?? 0) || 0;
    const memFeesGroup = parseFloat(a.memFeesGroup ?? 0) || 0;
    const penalty = parseFloat(a.penalty ?? 0) || 0;
    const other =
      (parseFloat(a.other1 ?? 0) || 0) +
      (parseFloat(a.other2 ?? 0) || 0) +
      (parseFloat(a.other ?? 0) || 0);
    const chargesTotal = a.charges
      ? Object.values(a.charges).reduce((sum, amt) => sum + (parseFloat(amt ?? 0) || 0), 0)
      : 0;
    return (
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
      chargesTotal
    );
  };

  const goToMember = (index) => {
    setCurrentMemberIndex(index);
    resetForm();

    const memberRecovery = recoveries.find((r) => r.memberId === allMembers[index]?.id);
    if (memberRecovery) {
      setAttendance(memberRecovery.attendance || "present");
      setRecoveryByOther(Boolean(memberRecovery.recoveryByOther));
      setOtherMemberId(memberRecovery.otherMemberId || "");
      const am = memberRecovery.amounts || {};
      const toStr = (v) => (v === undefined || v === null || v === "" ? "" : String(v));
      setAmountBreakup({
        saving: toStr(am.saving),
        loan: toStr(am.loan),
        interest: toStr(am.interest),
        yogdan: toStr(am.yogdan),
        memFeesSHG: toStr(am.memFeesSHG),
        memFeesSamiti: toStr(am.memFeesSamiti),
        memFeesGroup: toStr(am.memFeesGroup),
        penalty: toStr(am.penalty),
        other: toStr(am.other ?? am.other1 ?? am.other2),
        fd: toStr(am.fd),
        charges: typeof am.charges === "object" && am.charges !== null && !Array.isArray(am.charges) ? am.charges : {},
      });
      const sum = sumRecoveryAmounts(memberRecovery.amounts);
      setTotalAmount(sum > 0 ? String(Math.round(sum)) : "");
      setFdTimePeriod(memberRecovery.fd_time_period ? String(memberRecovery.fd_time_period / 12) : "");
      setPaymentMode(memberRecovery.paymentMode || DEFAULT_PAYMENT_MODE_CASH);
      setOnlineRef(memberRecovery.onlineRef || "");
      setSelectedBankId(memberRecovery.bankId ? String(memberRecovery.bankId) : "");
      if (memberRecovery.screenshot) setScreenshot(memberRecovery.screenshot);
    }
  };

  const handleEditMembersFromSummary = () => {
    setRecoveryEditMode(true);
    setCurrentStep(1);
    goToMember(0);
  };

  const handleExportRecoveryExcel = () => {
    if (!activeGroup?.name) return;
    exportRecoveryToExcel(recoveries, activeGroup.name);
  };

  const handleExportRecoveryPDF = async () => {
    if (!activeGroup?.id) return;
    try {
      const today = new Date().toLocaleDateString("en-GB");
      const result = await recovery.exportRecoveryPDF(activeGroup.id, today);
      if (!(result instanceof Blob)) {
        const msg =
          result && typeof result === "object" && typeof result.message === "string"
            ? result.message
            : "PDF export requires an online connection.";
        alert(msg);
        return;
      }
      const url = window.URL.createObjectURL(result);
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
  };

  const handlePrintRecoveryPDF = async () => {
    if (!activeGroup?.id) return;
    try {
      const today = new Date().toLocaleDateString("en-GB");
      const result = await recovery.exportRecoveryPDF(activeGroup.id, today);
      if (!(result instanceof Blob)) {
        const msg =
          result && typeof result === "object" && typeof result.message === "string"
            ? result.message
            : "Printing the PDF requires an online connection. Use Export PDF when connected.";
        alert(msg);
        return;
      }
      const url = window.URL.createObjectURL(result);
      const iframe = document.createElement("iframe");
      iframe.setAttribute(
        "style",
        "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden"
      );
      iframe.setAttribute("title", "Recovery PDF print preview");
      let printed = false;
      const cleanup = () => {
        window.URL.revokeObjectURL(url);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      };
      const tryPrint = () => {
        if (printed) return;
        printed = true;
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          window.open(url, "_blank", "noopener,noreferrer");
        }
        setTimeout(cleanup, 2000);
      };
      iframe.onload = () => {
        setTimeout(tryPrint, 250);
      };
      document.body.appendChild(iframe);
      iframe.src = url;
      setTimeout(() => {
        if (!printed) tryPrint();
      }, 2000);
    } catch (error) {
      console.error("Error printing PDF:", error);
      alert(error?.message || "Failed to print. Try Export PDF and print from the downloaded file.");
    }
  };

  const handlePostFinalizeDone = () => {
    setShowPostFinalizeModal(false);
    setPostFinalizeMessage("");
    setRecoveries([]);
    setCurrentMemberIndex(0);
    setRecoveryEditMode(false);
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
          setRecoveryEditMode(false);
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
        setRecoveryEditMode(false);
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
      setFullLoanRecoveryPaymentMode(DEFAULT_PAYMENT_MODE_CASH);
      setFullLoanRecoveryBankId("");
      setFullLoanRecoveryOnlineRef("");
      setFullLoanRecoveryScreenshot(null);

      alert(`Full loan recovery of ₹${remainingLoanAmount.toLocaleString()} saved successfully!`);

      // refresh demand details
      recovery.getDemandDetails(activeGroup.id, currentMember.id, today)
        .then((res) => {
          if (res?.success && res?.data) {
            const demandDetails = res.data.data || res.data;
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
        setPostFinalizeMessage("Recovery data submitted for approval.");
      } else {
        setPostFinalizeMessage("Recovery data saved successfully.");
      }

      setShowPostFinalizeModal(true);
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
                    setRecoveryEditMode(false);
                    setCurrentStep(0);
                    resetForm();
                  }
                }}
              />
            </div>

            {recoveryEditMode && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <p className="font-semibold">Editing saved recoveries</p>
                <p className="mt-1 text-amber-900/90">
                  Use Save &amp; Next to update each member. Amounts replace the previous save for today; when you finish the list you return to the summary step.
                </p>
              </div>
            )}

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

              {/* Current Member Form — sticky when section scrolls into view */}
              <div className="lg:col-span-8 min-w-0 sticky top-20 z-10 self-start">
                {currentMember && currentMemberSummary ? (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="p-2 sm:p-3 md:p-4 space-y-4">
                      {/* Add penalty: only show form when user clicks the button (admin and group panel) */}
                      <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 sm:p-4">
                        {!showAddPenalty ? (
                          <button
                            type="button"
                            onClick={() => setShowAddPenalty(true)}
                            className="w-full sm:w-auto px-4 py-2 rounded-lg font-medium text-sm bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                          >
                            Add penalty
                          </button>
                        ) : (
                          <>
                            <h4 className="text-sm font-semibold text-amber-900 mb-2">Add penalty for this member</h4>
                            <p className="text-xs text-amber-800 mb-3">Set a penalty amount for the member. It will appear in demand and can be recovered in the form below.</p>
                            <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-3">
                              <div className="flex-1 min-w-0">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Amount (₹)</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={penaltyAmountToAdd}
                                  onChange={(e) => setPenaltyAmountToAdd(e.target.value)}
                                  placeholder="0.00"
                                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
                                <input
                                  type="text"
                                  value={penaltyNotesToAdd}
                                  onChange={(e) => setPenaltyNotesToAdd(e.target.value)}
                                  placeholder="Reason for penalty"
                                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                                />
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={handleAddPenalty}
                                  disabled={addPenaltyLoading || !penaltyAmountToAdd || !(parseFloat(penaltyAmountToAdd) > 0) || (!isOnline && !isAdminMode)}
                                  className="shrink-0 px-4 py-2 rounded-lg font-medium text-sm bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                  title={!isOnline && !isAdminMode ? "Add penalty requires connection when in group panel" : undefined}
                                >
                                  {addPenaltyLoading ? "Adding…" : "Add penalty"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setShowAddPenalty(false); setAddPenaltyError(null); }}
                                  className="shrink-0 px-4 py-2 rounded-lg font-medium text-sm bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                            {addPenaltyError && (
                              <p className="mt-2 text-xs text-red-600">{addPenaltyError}</p>
                            )}
                          </>
                        )}
                      </div>
                      <MemberRecoveryForm
                        currentMember={currentMember}
                        currentMemberSummary={currentMemberSummary}
                        recoveryEditMode={recoveryEditMode}
                        isAlreadyRecovered={isAlreadyRecovered}
                        currentMemberRecoveryStatus={currentMemberRecoveryStatus}
                        attendance={attendance}
                        recoveryByOther={recoveryByOther}
                        otherMemberId={otherMemberId}
                        allMembers={allMembers}
                        amountBreakup={amountBreakup}
                        totalAmount={totalAmount}
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
                        onFullLoanRecoveryClick={isAdminMode ? undefined : () => setShowFullLoanRecovery(true)}
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
                        onAmountBreakupChange={(nextBreakup) => {
                          setAmountBreakup(nextBreakup);
                        }}
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
              onCapturePhoto={handleCapturePhoto}
              onRemovePhoto={() => setGroupPhoto(null)}
              onCashDenominationsChange={setCashDenominations}
              onFinalize={handleFinalize}
              onEditMembers={handleEditMembersFromSummary}
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
            setFullLoanRecoveryPaymentMode(DEFAULT_PAYMENT_MODE_CASH);
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

        <PostFinalizeRecoveryModal
          open={showPostFinalizeModal}
          message={postFinalizeMessage}
          groupLabel={
            activeGroup?.name ||
            activeGroup?.group_name ||
            activeGroup?.raw?.group_name ||
            "Group"
          }
          dateLabel={new Date().toLocaleDateString("en-GB")}
          onExportExcel={handleExportRecoveryExcel}
          onExportPDF={handleExportRecoveryPDF}
          onPrintPDF={handlePrintRecoveryPDF}
          onDone={handlePostFinalizeDone}
        />
      </div>
    </div>
  );
}
