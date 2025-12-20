import React, { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { Input, Select } from "../../components/forms/FormComponents";
import {
  initRecoveryDB,
  saveRecovery,
  getRecoveriesByGroup,
  deleteRecovery,
  saveGroupPhoto,
  subscribeToRecoveries,
} from "../../services/recoveryDB";
import { exportRecoveryToExcel, exportRecoveryToPDF } from "../../utils/exportUtils";
import { useGroup } from "../../contexts/GroupContext";
import { createApprovalRequest } from "../../services/approvalDB";
import { registerRecovery } from "../../services/recoveryService";
import { getGroups } from "../../services/groupService";
import { getMembersByGroup } from "../../services/memberService";
import { isMeetingDay, getNextMeetingDate, formatMeetingDateTime } from "../../utils/meetingDateUtils";

export default function DemandRecovery() {
  const { currentGroup, isOnline, isGroupPanel, isGroupLoading } = useGroup();
  const isAdminMode = !isGroupPanel;
  const [dbReady, setDbReady] = useState(false);
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [allMembers, setAllMembers] = useState([]);
  const [recoveries, setRecoveries] = useState([]);
  const [currentMemberIndex, setCurrentMemberIndex] = useState(0);
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
    fd: "",
    interest: "",
    yogdan: "",
    other: "",
  });
  const [paymentMode, setPaymentMode] = useState({
    cash: false,
    online: false,
  });
  const [onlineRef, setOnlineRef] = useState("");
  const [screenshot, setScreenshot] = useState(null);
  const [groupPhoto, setGroupPhoto] = useState(null);
  const subscriptionRef = useRef(null);

  // Determine active group: use currentGroup from context if available, otherwise use selectedGroup (admin)
  const activeGroup = currentGroup || selectedGroup;

  // Check if today is a meeting day and get next meeting date
  const today = new Date();
  const isTodayMeetingDay = activeGroup ? isMeetingDay(today, activeGroup) : false;
  const nextMeetingDate = activeGroup ? getNextMeetingDate(activeGroup) : null;
  const meetingTime = activeGroup?.raw?.meeting_date_2_time || activeGroup?.meeting_date_2_time || null;

  // Demand summary (dynamic): uses group saving_per_member (if available) + amounts entered in current meeting.
  // Includes opening balances from existing member financial data
  const getDemandSummary = (memberId) => {
    const recovery = recoveries.find((r) => r.memberId === memberId);
    const member = allMembers.find((m) => m.id === memberId);

    // Get opening balances from member data (if existing member)
    const openingSaving = member?.openingSaving || member?.raw?.openingSaving || 0;
    const openingLoan = member?.loanDetails?.amount || member?.raw?.loanDetails?.amount || 0;
    const openingFd = member?.fdDetails?.amount || member?.raw?.fdDetails?.amount || 0;
    const openingYogdan = member?.openingYogdan || member?.raw?.openingYogdan || 0;
    const openingInterest = member?.loanDetails?.overdueInterest || member?.raw?.loanDetails?.overdueInterest || 0;

    const savingDue = Number(activeGroup?.raw?.saving_per_member || activeGroup?.saving_per_member || 0) || 0;
    const actualSaving = parseFloat(recovery?.amounts?.saving || 0) || 0;
    const actualLoan = parseFloat(recovery?.amounts?.loan || 0) || 0;
    const actualFd = parseFloat(recovery?.amounts?.fd || 0) || 0;
    const actualInterest = parseFloat(recovery?.amounts?.interest || 0) || 0;
    const actualYogdan = parseFloat(recovery?.amounts?.yogdan || 0) || 0;
    const actualOther = parseFloat(recovery?.amounts?.other || 0) || 0;

    // Calculate closing balances (opening + actual received)
    const closingSaving = openingSaving + actualSaving;
    const closingLoan = Math.max(0, openingLoan - actualLoan); // Loan balance decreases with payment
    const closingFd = openingFd + actualFd; // FD increases with deposit
    const closingInterest = Math.max(0, openingInterest - actualInterest); // Interest decreases with payment
    const closingYogdan = openingYogdan + actualYogdan; // Yogdan increases with recovery

    return {
      saving: {
        prev: 0,
        curr: savingDue,
        total: savingDue,
        actual: actualSaving,
        unpaid: Math.max(savingDue - actualSaving, 0),
        opening: openingSaving,
        closing: closingSaving,
      },
      loan: {
        prev: 0,
        curr: 0,
        total: actualLoan,
        actual: actualLoan,
        unpaid: Math.max(0, openingLoan - actualLoan),
        opening: openingLoan,
        closing: closingLoan,
      },
      fd: {
        prev: 0,
        curr: 0,
        total: actualFd,
        actual: actualFd,
        unpaid: 0,
        opening: openingFd,
        closing: closingFd,
      },
      interest: {
        prev: 0,
        curr: 0,
        total: actualInterest,
        actual: actualInterest,
        unpaid: Math.max(0, openingInterest - actualInterest),
        opening: openingInterest,
        closing: closingInterest,
      },
      yogdan: {
        prev: 0,
        curr: 0,
        total: actualYogdan,
        actual: actualYogdan,
        unpaid: 0,
        opening: openingYogdan,
        closing: closingYogdan,
      },
      other: { prev: 0, curr: 0, total: actualOther, actual: actualOther, unpaid: 0, opening: 0, closing: 0 },
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

  // Initialize database
  useEffect(() => {
    initRecoveryDB()
      .then(() => {
        setDbReady(true);
      })
      .catch((error) => {
        console.error("Database initialization error:", error);
        alert("Database initialization failed. Please refresh the page.");
      });
  }, []);

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
    if (activeGroup && dbReady) {
      loadRecoveries();

      // Set up subscription
      subscribeToRecoveries(activeGroup.id, (data) => {
        setRecoveries(data);
      }).then((sub) => {
        subscriptionRef.current = sub;
      }).catch((error) => {
        console.error('Error setting up subscription:', error);
      });

      return () => {
        if (subscriptionRef.current) {
          subscriptionRef.current.unsubscribe();
          subscriptionRef.current = null;
        }
      };
    }
  }, [activeGroup, dbReady]);

  const loadRecoveries = async () => {
    if (activeGroup) {
      const data = await getRecoveriesByGroup(activeGroup.id);
      setRecoveries(data);
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
        const other = parseFloat(recovery.amounts?.other || 0);
        const memberTotal = saving + loan + fd + interest + yogdan + other;

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
    setAmountBreakup({ saving: "", loan: "", fd: "", interest: "", yogdan: "", other: "" });
    setPaymentMode({ cash: false, online: false });
    setOnlineRef("");
    setScreenshot(null);
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
        const recoveryData = {
          groupId: activeGroup.id,
          groupName: activeGroup.name,
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
            other: 0,
          },
          paymentMode: { cash: false, online: false },
          onlineRef: null,
          screenshot: null,
          date: new Date().toLocaleDateString("en-GB"),
        };

        if (currentMemberRecovery) {
          await deleteRecovery(currentMemberRecovery.id);
        }

        await saveRecovery(recoveryData);
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
        alert("Error saving record");
        return;
      }
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
    const other = parseFloat(amountBreakup.other) || 0;
    const total = saving + loan + fd + interest + yogdan + other;

    if (total === 0) {
      alert("Please enter at least one amount");
      return;
    }

    try {
      const recoveryData = {
        groupId: activeGroup.id,
        groupName: activeGroup.name,
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
          other,
        },
        paymentMode,
        onlineRef: paymentMode.online ? onlineRef : null,
        screenshot: screenshot || null,
        date: new Date().toLocaleDateString("en-GB"),
      };

      if (currentMemberRecovery) {
        await deleteRecovery(currentMemberRecovery.id);
      }

      await saveRecovery(recoveryData);
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
      // For group panel, create approval request; for admin, save directly to MongoDB
      if (currentGroup) {
        // Group panel: create approval request
        await createApprovalRequest("recovery", {
          recoveries,
          groupPhoto,
          totals,
          memberCount: allMembers.length,
          date: new Date().toLocaleDateString("en-GB"),
        }, activeGroup.id, activeGroup.name);
        alert("Recovery data submitted for approval!");
      } else {
        // Admin: directly save to MongoDB
        await registerRecovery({
          groupId: activeGroup.id,
          groupName: activeGroup.name,
          groupCode: activeGroup.code,
          recoveries,
          groupPhoto,
          totals,
          memberCount: allMembers.length,
          date: new Date().toLocaleDateString("en-GB"),
        });
        alert("Recovery data saved successfully!");
      }

      await saveGroupPhoto({
        groupId: activeGroup.id,
        groupName: activeGroup.name,
        photo: groupPhoto,
        totalCash: totals.totalCash,
        totalOnline: totals.totalOnline,
        totalAmount: totals.totalAmount,
        memberCount: allMembers.length,
        date: new Date().toLocaleDateString("en-GB"),
      });

      // Reset everything
      setRecoveries([]);
      setCurrentMemberIndex(0);
      setCurrentStep(1);
      setGroupPhoto(null);
      resetForm();
    } catch (error) {
      console.error("Error finalizing:", error);
      alert("Error");
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
      setAttendance(memberRecovery.attendance);
      setRecoveryByOther(memberRecovery.recoveryByOther || false);
      setOtherMemberId(memberRecovery.otherMemberId || "");
      setAmountBreakup(memberRecovery.amounts || { saving: "", loan: "", fd: "", interest: "", yogdan: "", other: "" });
      setPaymentMode(memberRecovery.paymentMode || { cash: false, online: false });
      setOnlineRef(memberRecovery.onlineRef || "");
    }
  };

  if (!dbReady) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <p className="text-blue-600 font-semibold">Loading database...</p>
        </div>
      </div>
    );
  }

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
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <User size={20} className="text-blue-600" />
                {currentMember.name} ({currentMember.code})
              </h3>

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
                    {Object.entries(currentMemberSummary).map(([key, data]) => (
                      <tr key={key} className="hover:bg-gray-50">
                        <td className="border p-2 font-medium text-gray-800 capitalize">{key}</td>
                        <td className="border p-2 text-center text-gray-700">{data.prev === 0 ? "—" : `₹${data.prev}`}</td>
                        <td className="border p-2 text-center text-gray-700">{data.curr === 0 ? "—" : `₹${data.curr}`}</td>
                        <td className="border p-2 text-center text-gray-700">{data.total === 0 ? "—" : `₹${data.total}`}</td>
                        <td className="border p-2 text-center text-gray-700">{data.actual === 0 ? "—" : `₹${data.actual}`}</td>
                        <td className="border p-2 text-center text-gray-700">{data.unpaid === 0 ? "—" : `₹${data.unpaid}`}</td>
                        <td className="border p-2 text-center text-gray-700">{data.opening === 0 ? "—" : `₹${data.opening}`}</td>
                        <td className="border p-2 text-center text-gray-700">{data.closing === 0 ? "—" : `₹${data.closing}`}</td>
                      </tr>
                    ))}
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
                    <Input
                      label="Savings"
                      name="saving"
                      type="number"
                      value={amountBreakup.saving}
                      handleChange={(e) =>
                        setAmountBreakup({ ...amountBreakup, saving: e.target.value })
                      }
                      placeholder="Enter amount"
                    />

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { key: "loan", label: "Loan" },
                        { key: "fd", label: "FD" },
                        { key: "interest", label: "Interest" },
                        { key: "yogdan", label: "Yogdan" },
                        { key: "other", label: "Other" },
                      ].map(({ key, label }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleAmountField(key)}
                          className={`px-4 py-2 rounded-lg font-medium text-sm ${activeAmountFields[key]
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-700"
                            }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {activeAmountFields.loan && (
                        <Input
                          label="Loan Amount"
                          name="loan"
                          type="number"
                          value={amountBreakup.loan}
                          handleChange={(e) =>
                            setAmountBreakup({ ...amountBreakup, loan: e.target.value })
                          }
                          placeholder="Enter loan amount"
                        />
                      )}
                      {activeAmountFields.fd && (
                        <Input
                          label="FD Deposit Amount"
                          name="fd"
                          type="number"
                          value={amountBreakup.fd}
                          handleChange={(e) =>
                            setAmountBreakup({ ...amountBreakup, fd: e.target.value })
                          }
                          placeholder="Enter FD deposit amount"
                        />
                      )}
                      {activeAmountFields.interest && (
                        <Input
                          label="Interest Amount"
                          name="interest"
                          type="number"
                          value={amountBreakup.interest}
                          handleChange={(e) =>
                            setAmountBreakup({ ...amountBreakup, interest: e.target.value })
                          }
                          placeholder="Enter interest amount"
                        />
                      )}
                      {activeAmountFields.yogdan && (
                        <Input
                          label="Yogdan Amount"
                          name="yogdan"
                          type="number"
                          value={amountBreakup.yogdan}
                          handleChange={(e) =>
                            setAmountBreakup({ ...amountBreakup, yogdan: e.target.value })
                          }
                          placeholder="Enter Yogdan amount"
                        />
                      )}
                      {activeAmountFields.other && (
                        <Input
                          label="Other Amount"
                          name="other"
                          type="number"
                          value={amountBreakup.other}
                          handleChange={(e) =>
                            setAmountBreakup({ ...amountBreakup, other: e.target.value })
                          }
                          placeholder="Enter other amount"
                        />
                      )}
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-lg font-semibold text-gray-800">
                        Total: ₹
                        {(
                          parseFloat(amountBreakup.saving || 0) +
                          parseFloat(amountBreakup.loan || 0) +
                          parseFloat(amountBreakup.fd || 0) +
                          parseFloat(amountBreakup.interest || 0) +
                          parseFloat(amountBreakup.yogdan || 0) +
                          parseFloat(amountBreakup.other || 0)
                        ).toLocaleString()}
                      </p>
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
    </div>
  );
}
