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
} from "lucide-react";
import { Input, Select } from "../../components/forms/FormComponents";
import { exportRecoveryToExcel, exportRecoveryToPDF } from "../../utils/exportUtils";
import { useGroup } from "../../contexts/GroupContext";
import { createApprovalRequest } from "../../services/approvalDB";
import { registerRecovery, updateMemberRecovery, getRecoveryByDate, updateRecoveryPhoto, getPreviousRecoveryData } from "../../services/recoveryService";
import { getLoans } from "../../services/loanService";
import { getGroups } from "../../services/groupService";
import { getMembersByGroup } from "../../services/memberService";
import { isMeetingDay, getNextMeetingDate, formatMeetingDateTime } from "../../utils/meetingDateUtils";
import CreateFD from "../../components/fd/CreateFD";

export default function DemandRecovery() {
  const { currentGroup, isOnline, isGroupPanel, isGroupLoading } = useGroup();
  const isAdminMode = !isGroupPanel;
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
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
    penalty: "",
    other: "",
    fd: "",
  });
  const [totalAmount, setTotalAmount] = useState(""); // Single total amount input for auto-calculation
  const [autoCalculated, setAutoCalculated] = useState(false); // Track if amounts are auto-calculated
  const [fdTimePeriod, setFdTimePeriod] = useState("");
  const [paymentMode, setPaymentMode] = useState({
    cash: false,
    online: false,
  });
  const [onlineRef, setOnlineRef] = useState("");
  const [screenshot, setScreenshot] = useState(null);
  const [groupPhoto, setGroupPhoto] = useState(null);
  const [showCreateFD, setShowCreateFD] = useState(false);
  const [selectedMemberForFD, setSelectedMemberForFD] = useState(null);

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

  // Load previous recovery data when member changes
  useEffect(() => {
    if (!activeGroup?.id || !allMembers.length || currentMemberIndex < 0) return;

    const member = allMembers[currentMemberIndex];
    if (!member?.id) return;

    const today = new Date().toLocaleDateString("en-GB");
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
  }, [activeGroup?.id, currentMemberIndex, allMembers]);

  // Demand summary (dynamic): uses new calculation logic with previous demands
  const getDemandSummary = (memberId) => {
    const recovery = recoveries.find((r) => r.memberId === memberId);
    const member = allMembers.find((m) => m.id === memberId);

    // Use demandDetails from recovery if available (calculated by backend)
    if (recovery?.demandDetails) {
      const dd = recovery.demandDetails;
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
          prev: 0,
          curr: 0,
          total: recovery?.amounts?.yogdan || 0,
          actual: recovery?.amounts?.yogdan || 0,
          unpaid: 0,
          opening: member?.openingYogdan || member?.raw?.openingYogdan || 0,
          closing: (member?.openingYogdan || member?.raw?.openingYogdan || 0) + (recovery?.amounts?.yogdan || 0),
        },
        memFeesSHG: {
          prev: 0,
          curr: 0,
          total: recovery?.amounts?.memFeesSHG || 0,
          actual: recovery?.amounts?.memFeesSHG || 0,
          unpaid: 0,
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
      };
    }

    // Calculate on frontend if demandDetails not available (for display before saving)
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
    const openingYogdan = member?.openingYogdan || member?.raw?.openingYogdan || 0;
    const openingInterest = member?.loanDetails?.overdueInterest || member?.raw?.loanDetails?.overdueInterest || 0;

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
    const actualPenalty = parseFloat(recovery?.amounts?.penalty || 0) || 0;
    const actualOther = (parseFloat(recovery?.amounts?.other1 || 0) || 0) +
      (parseFloat(recovery?.amounts?.other2 || 0) || 0) +
      (parseFloat(recovery?.amounts?.other || 0) || 0);

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

    // Calculate interest demand details (only for members with active loans)
    // Use overdue interest directly as current month interest demand
    // For existing members, show interest if they have loan amount, even without activeLoan
    const hasLoan = activeLoan || openingLoan > 0;
    const interestCurrDemand = hasLoan ? openingInterest : 0;

    const interestPrevDemand = prevData.interest.unpaidDemand || 0;
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
        total: interestTotalDemand,
        actual: actualInterest,
        unpaid: interestUnpaidDemand,
        opening: interestOpeningBalance,
        closing: interestClosingBalance,
      },
      fd: {
        prev: 0,
        curr: 0,
        total: 0,
        actual: actualFd,
        unpaid: 0,
        opening: openingFd,
        closing: openingFd + actualFd,
      },
      yogdan: {
        prev: 0,
        curr: 0,
        total: actualYogdan,
        actual: actualYogdan,
        unpaid: 0,
        opening: openingYogdan,
        closing: openingYogdan + actualYogdan,
      },
      memFeesSHG: {
        prev: 0,
        curr: 0,
        total: actualMemFeesSHG,
        actual: actualMemFeesSHG,
        unpaid: 0,
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
        const penalty = parseFloat(recovery.amounts?.penalty || 0);
        const other = (parseFloat(recovery.amounts?.other1 || 0) || 0) +
          (parseFloat(recovery.amounts?.other2 || 0) || 0) +
          (parseFloat(recovery.amounts?.other || 0) || 0);
        const memberTotal = saving + loan + fd + interest + yogdan + memFeesSHG + memFeesSamiti + penalty + other;

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
      penalty: "",
      other: "",
      fd: "",
    });
    setTotalAmount("");
    setAutoCalculated(false);
    setFdTimePeriod("");
    setPaymentMode({ cash: false, online: false });
    setOnlineRef("");
    setScreenshot(null);
  };

  // Auto-calculate amounts from total
  const handleTotalAmountChange = (value) => {
    setTotalAmount(value);
    const total = parseFloat(value) || 0;

    if (total > 0) {
      // Get current member's demands
      const summary = currentMember ? getDemandSummary(currentMember.id) : null;
      const savingDue = summary?.saving?.total || 0;
      const loanDue = summary?.loan?.total || 0;
      const interestDue = summary?.interest?.total || 0;

      // New priority order: Other > Yogdan > Mem Fees SHG > Mem Fees Samiti > Penalty > Interest > Saving > Loan
      // If extra remains, add to Saving
      let remaining = total;
      const calculated = {
        saving: "",
        loan: "",
        interest: "",
        yogdan: "",
        memFeesSHG: "",
        memFeesSamiti: "",
        penalty: "",
        other: "",
        fd: "",
      };

      // 1. Allocate to Other (optional, no demand - skip for now, will be allocated last if extra)
      // We'll handle this at the end

      // 2. Allocate to Yogdan (optional, no demand - skip for now)

      // 3. Allocate to Member Fees SHG (yearly, optional, no monthly demand - skip for now)

      // 4. Allocate to Member Fees Samiti (yearly, optional, no monthly demand - skip for now)

      // 5. Allocate to Penalty (optional, no demand - skip for now)

      // 6. Allocate to Interest on Loan (if due)
      if (interestDue > 0 && remaining > 0) {
        const interestAmount = Math.min(interestDue, remaining);
        calculated.interest = interestAmount.toFixed(2);
        remaining -= interestAmount;
      }

      // 7. Allocate to Saving (if due)
      if (savingDue > 0 && remaining > 0) {
        const savingAmount = Math.min(savingDue, remaining);
        calculated.saving = savingAmount.toFixed(2);
        remaining -= savingAmount;
      }

      // 8. Allocate to Loan (if due)
      if (loanDue > 0 && remaining > 0) {
        const loanAmount = Math.min(loanDue, remaining);
        calculated.loan = loanAmount.toFixed(2);
        remaining -= loanAmount;
      }

      // 9. If there's remaining money after meeting all demands, add to Saving
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
        penalty: "",
        other: "",
        fd: "",
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

  // Handle payment mode
  const handlePaymentModeChange = (mode) => {
    setPaymentMode({
      ...paymentMode,
      [mode]: !paymentMode[mode],
    });
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
    // Validate activeGroup exists
    if (!activeGroup || !activeGroup.id) {
      alert("Group information is missing. Please select a group.");
      return;
    }

    // Validate meeting day
    if (!isMeetingDay(new Date(), activeGroup)) {
      alert("Recovery can only be done on scheduled meeting days. Please check the meeting schedule.");
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

    const saving = parseFloat(amountBreakup.saving) || 0;
    const loan = parseFloat(amountBreakup.loan) || 0;
    const fd = parseFloat(amountBreakup.fd) || 0;
    const interest = parseFloat(amountBreakup.interest) || 0;
    const yogdan = parseFloat(amountBreakup.yogdan) || 0;
    const memFeesSHG = parseFloat(amountBreakup.memFeesSHG) || 0;
    const memFeesSamiti = parseFloat(amountBreakup.memFeesSamiti) || 0;
    const penalty = parseFloat(amountBreakup.penalty) || 0;
    const other = parseFloat(amountBreakup.other) || 0;
    const total = saving + loan + fd + interest + yogdan + memFeesSHG + memFeesSamiti + penalty + other;

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
          penalty,
          other,
        },
        fd_time_period: isNewFd && fdTimePeriod ? parseInt(fdTimePeriod) : null,
        fd_rate_snapshot: fdRateSnapshot,
        paymentMode,
        onlineRef: paymentMode.online ? onlineRef : null,
        screenshot: screenshot || null,
      };

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

  // Save group photo and finalize
  const handleFinalize = async () => {
    if (!groupPhoto) {
      alert("Please take group photo");
      return;
    }

    // Validate meeting day
    if (!isMeetingDay(new Date(), activeGroup)) {
      alert("Recovery can only be finalized on scheduled meeting days. Please check the meeting schedule.");
      return;
    }

    try {
      setLoading(true);
      const today = new Date().toLocaleDateString("en-GB");

      // Update group photo in recovery session
      await updateRecoveryPhoto(activeGroup.id, today, groupPhoto);

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
      setAmountBreakup(memberRecovery.amounts || { saving: "", loan: "", fd: "", interest: "", yogdan: "", other: "" });
      setFdTimePeriod(memberRecovery.fd_time_period ? String(memberRecovery.fd_time_period) : "");
      setPaymentMode(memberRecovery.paymentMode || { cash: false, online: false });
      setOnlineRef(memberRecovery.onlineRef || "");
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

      {/* Step 0: Select Group (Admin only - when currentGroup is null) */}
      {isAdminMode && currentStep === 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Building2 size={24} className="text-blue-600" />
            Select Group
          </h2>
          <p className="text-gray-600 mb-6">Please select a group to proceed with demand recovery</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupsLoading && (
              <div className="col-span-full text-center py-8 text-gray-500">
                <p>Loading groups...</p>
              </div>
            )}
            {!groupsLoading && groups.map((group) => (
              <div
                key={group.id}
                onClick={() => handleSelectGroup(group)}
                className="p-6 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
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
            ))}
            {!groupsLoading && groups.length === 0 && (
              <div className="col-span-full text-center py-8 text-gray-500">
                <p>No groups found.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Meeting Date Check - Block access if not on meeting day */}
      {currentStep === 1 && activeGroup && !isTodayMeetingDay && (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <XCircle size={64} className="text-red-500" />
            <h2 className="text-2xl font-bold text-gray-800">Recovery Not Available</h2>
            <p className="text-lg text-gray-600">
              Recovery can only be done on scheduled meeting days.
            </p>
            {nextMeetingDate && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Next Meeting Date:</p>
                <p className="text-xl font-semibold text-blue-700">
                  {formatMeetingDateTime(nextMeetingDate, meetingTime)}
                </p>
              </div>
            )}
            <p className="text-sm text-gray-500 mt-4">
              Today's date: {today.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}
            </p>
            {activeGroup.raw?.meeting_date_1_day && (
              <p className="text-sm text-gray-500">
                Meeting days: {activeGroup.raw.meeting_date_1_day}
                {activeGroup.raw.meeting_date_2_day && ` and ${activeGroup.raw.meeting_date_2_day}`} of each month
              </p>
            )}
          </div>
        </div>
      )}

      {/* Step 1: Recovery Entry */}
      {currentStep === 1 && activeGroup && isTodayMeetingDay && (
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
                    {Object.entries(currentMemberSummary)
                      .filter(([key, data]) => {
                        // Always show: saving, loan, interest, fd
                        if (['saving', 'loan', 'interest', 'fd'].includes(key)) {
                          return true;
                        }
                        // Hide these categories if all values are 0: yogdan, memFeesSHG, memFeesSamiti, penalty, other
                        const hasValue = data.prev > 0 || data.curr > 0 || data.total > 0 ||
                          data.actual > 0 || data.unpaid > 0 || data.opening > 0 || data.closing > 0;
                        return hasValue;
                      })
                      .map(([key, data]) => {
                        // Map category keys to display names
                        const categoryNames = {
                          saving: "Saving",
                          loan: "Loan",
                          interest: "Int on loan",
                          yogdan: "Yogdan",
                          memFeesSHG: "Mem. Fees SHG (Yearly)",
                          memFeesSamiti: "Mem. Fees Samiti (Yearly)",
                          penalty: "Penalty",
                          other: "Other",
                          fd: "FD",
                        };
                        return (
                          <tr key={key} className="hover:bg-gray-50">
                            <td className="border p-2 font-medium text-gray-800">{categoryNames[key] || key}</td>
                            <td className="border p-2 text-center text-gray-700">{data.prev === 0 ? "—" : `₹${data.prev}`}</td>
                            <td className="border p-2 text-center text-gray-700">{data.curr === 0 ? "—" : `₹${data.curr}`}</td>
                            <td className="border p-2 text-center text-gray-700">{data.total === 0 ? "—" : `₹${data.total}`}</td>
                            <td className="border p-2 text-center text-gray-700">{data.actual === 0 ? "—" : `₹${data.actual}`}</td>
                            <td className="border p-2 text-center text-gray-700">{data.unpaid === 0 ? "—" : `₹${data.unpaid}`}</td>
                            <td className="border p-2 text-center text-gray-700">{data.opening === 0 ? "—" : `₹${data.opening}`}</td>
                            <td className="border p-2 text-center text-gray-700">{data.closing === 0 ? "—" : `₹${data.closing}`}</td>
                          </tr>
                        );
                      })}
                    <tr className="bg-gray-50 font-semibold">
                      <td className="border p-2 text-gray-800">TOTAL</td>
                      <td className="border p-2 text-center text-gray-800">—</td>
                      <td className="border p-2 text-center text-gray-800">—</td>
                      <td className="border p-2 text-center text-gray-800">
                        ₹{Object.values(currentMemberSummary).reduce((sum, d) => sum + d.total, 0)}
                      </td>
                      <td className="border p-2 text-center text-gray-800">
                        ₹{Object.values(currentMemberSummary).reduce((sum, d) => sum + d.actual, 0)}
                      </td>
                      <td className="border p-2 text-center text-gray-800">
                        ₹{Object.values(currentMemberSummary).reduce((sum, d) => sum + d.unpaid, 0)}
                      </td>
                      <td className="border p-2 text-center text-gray-800">
                        ₹{Object.values(currentMemberSummary).reduce((sum, d) => sum + d.opening, 0)}
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

              {/* Amount Breakup - Only show if present or absent with recovery by other */}
              {(attendance === "present" || (attendance === "absent" && recoveryByOther)) && (
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
                        step="0.01"
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
                          step="0.01"
                        />
                      )}
                      {(parseFloat(amountBreakup.loan) || 0) > 0 && (
                        <Input
                          label="Loan"
                          name="loan"
                          type="number"
                          value={amountBreakup.loan}
                          handleChange={(e) => {
                            setAmountBreakup({ ...amountBreakup, loan: e.target.value });
                            setAutoCalculated(false);
                          }}
                          placeholder="Enter loan payment"
                          step="0.01"
                        />
                      )}
                      {(parseFloat(amountBreakup.interest) || 0) > 0 && (
                        <Input
                          label="Interest on Loan"
                          name="interest"
                          type="number"
                          value={amountBreakup.interest}
                          handleChange={(e) => {
                            setAmountBreakup({ ...amountBreakup, interest: e.target.value });
                            setAutoCalculated(false);
                          }}
                          placeholder="Enter interest payment"
                          step="0.01"
                        />
                      )}
                      {(parseFloat(amountBreakup.yogdan) || 0) > 0 && (
                        <Input
                          label="Yogdan (when loan is given)"
                          name="yogdan"
                          type="number"
                          value={amountBreakup.yogdan}
                          handleChange={(e) => {
                            setAmountBreakup({ ...amountBreakup, yogdan: e.target.value });
                            setAutoCalculated(false);
                          }}
                          placeholder="Enter yogdan amount"
                          step="0.01"
                        />
                      )}
                      {(parseFloat(amountBreakup.memFeesSHG) || 0) > 0 && (
                        <Input
                          label="Member Fees SHG (Yearly)"
                          name="memFeesSHG"
                          type="number"
                          value={amountBreakup.memFeesSHG}
                          handleChange={(e) => {
                            setAmountBreakup({ ...amountBreakup, memFeesSHG: e.target.value });
                            setAutoCalculated(false);
                          }}
                          placeholder="Enter SHG fees"
                          step="0.01"
                        />
                      )}
                      {(parseFloat(amountBreakup.memFeesSamiti) || 0) > 0 && (
                        <Input
                          label="Member Fees Samiti (Yearly)"
                          name="memFeesSamiti"
                          type="number"
                          value={amountBreakup.memFeesSamiti}
                          handleChange={(e) => {
                            setAmountBreakup({ ...amountBreakup, memFeesSamiti: e.target.value });
                            setAutoCalculated(false);
                          }}
                          placeholder="Enter Samiti fees"
                          step="0.01"
                        />
                      )}
                      {(parseFloat(amountBreakup.penalty) || 0) > 0 && (
                        <Input
                          label="Penalty"
                          name="penalty"
                          type="number"
                          value={amountBreakup.penalty}
                          handleChange={(e) => {
                            setAmountBreakup({ ...amountBreakup, penalty: e.target.value });
                            setAutoCalculated(false);
                          }}
                          placeholder="Enter penalty amount"
                          step="0.01"
                        />
                      )}
                      {(parseFloat(amountBreakup.other) || 0) > 0 && (
                        <Input
                          label="Other"
                          name="other"
                          type="number"
                          value={amountBreakup.other}
                          handleChange={(e) => {
                            setAmountBreakup({ ...amountBreakup, other: e.target.value });
                            setAutoCalculated(false);
                          }}
                          placeholder="Enter other amount"
                          step="0.01"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Mode - Only show if present or absent with recovery by other */}
              {(attendance === "present" || (attendance === "absent" && recoveryByOther)) && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Payment Mode *
                  </label>
                  <div className="flex gap-4 mb-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={paymentMode.cash}
                        onChange={() => handlePaymentModeChange("cash")}
                        className="w-5 h-5 text-blue-600 rounded"
                      />
                      <span className="font-medium text-gray-700">Cash</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={paymentMode.online}
                        onChange={() => handlePaymentModeChange("online")}
                        className="w-5 h-5 text-blue-600 rounded"
                      />
                      <span className="font-medium text-gray-700">Online</span>
                    </label>
                  </div>

                  {paymentMode.online && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
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
                  className="flex items-center gap-2 px-8 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold shadow-md"
                >
                  {currentMemberIndex < allMembers.length - 1 ? (
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
                  onClick={() => exportRecoveryToPDF(recoveries, activeGroup.name, totals)}
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
                <p className="text-3xl font-bold text-gray-800">₹{totals.totalCash.toLocaleString()}</p>
              </div>
              <div className="p-6 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                <p className="text-sm text-gray-600 mb-2">Total Online</p>
                <p className="text-3xl font-bold text-gray-800">₹{totals.totalOnline.toLocaleString()}</p>
              </div>
              <div className="p-6 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                <p className="text-sm text-gray-600 mb-2">Grand Total</p>
                <p className="text-3xl font-bold text-gray-800">₹{totals.totalAmount.toLocaleString()}</p>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold text-gray-800 mb-3">Members Recovery Status ({recoveries.length})</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {recoveries.map((recovery) => {
                  const member = allMembers.find((m) => m.id === recovery.memberId);
                  const isRecovered = recovery.attendance === "present" || (recovery.attendance === "absent" && recovery.recoveryByOther);
                  const amount = isRecovered
                    ? (recovery.amounts?.saving || 0) +
                    (recovery.amounts?.loan || 0) +
                    (recovery.amounts?.fd || 0) +
                    (recovery.amounts?.interest || 0) +
                    (recovery.amounts?.yogdan || 0) +
                    (recovery.amounts?.other || 0)
                    : 0;
                  return (
                    <div
                      key={recovery.id}
                      className={`p-3 rounded-lg border-2 ${isRecovered
                        ? "bg-green-50 border-green-200"
                        : "bg-red-50 border-red-200"
                        }`}
                    >
                      <p className="font-medium text-gray-800">{member?.name}</p>
                      <p className="text-sm text-gray-600">{member?.code}</p>
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
    </div>
  );
}
