import React, { useState, useEffect } from "react";
import { RefreshCw, CloudOff } from "lucide-react";
import { useGroup } from "../contexts/GroupContext";
import { useOffline } from "../contexts/OfflineContext";
import { getMembersByGroup } from "../services/memberServiceOffline";
import { getLoans } from "../services/loanServiceOffline";
import { getRecoveries } from "../services/recoveryServiceOffline";

const GroupProfile = () => {
  const { currentGroup, isGroupLoading } = useGroup();
  const { isOnline, isSyncing, syncPending, triggerSync } = useOffline();
  const [syncMessage, setSyncMessage] = useState(null);
  const [groupStats, setGroupStats] = useState({
    totalMembers: 0,
    totalLoans: 0,
    totalOutstanding: 0,
    totalSavings: 0,
    lastMeeting: null,
    loading: true,
  });

  useEffect(() => {
    if (currentGroup?.id) {
      loadGroupStats();
    } else if (!isGroupLoading) {
      setGroupStats(prev => ({ ...prev, loading: false }));
    }
  }, [currentGroup, isGroupLoading]);

  const loadGroupStats = async () => {
    try {
      setGroupStats(prev => ({ ...prev, loading: true }));

      const [membersRes, loansRes, recoveriesRes] = await Promise.all([
        getMembersByGroup(currentGroup.id).catch(() => ({ success: false, data: [] })),
        getLoans(currentGroup.id).catch(() => ({ success: false, data: [] })),
        getRecoveries(currentGroup.id).catch(() => ({ success: false, data: [] })),
      ]);

      // Calculate total members
      const members = membersRes?.data || [];
      const totalMembers = Array.isArray(members) ? members.length : 0;

      // Calculate total loans given and outstanding
      const loans = loansRes?.data || [];
      let totalLoans = 0;
      let totalOutstanding = 0;

      if (Array.isArray(loans)) {
        loans.forEach((loan) => {
          const loanAmount = parseFloat(loan.amount || loan.loan_amount || 0);
          const paidAmount = parseFloat(loan.paid_amount || loan.paidAmount || 0);
          totalLoans += loanAmount;
          totalOutstanding += Math.max(0, loanAmount - paidAmount);
        });
      }

      // Calculate total savings from recoveries
      let totalSavings = 0;
      let lastMeetingDate = null;

      if (recoveriesRes?.success && Array.isArray(recoveriesRes.data)) {
        recoveriesRes.data.forEach((recovery) => {
          const recoveryDate = recovery.date;
          if (recoveryDate && (!lastMeetingDate || new Date(recoveryDate) > new Date(lastMeetingDate))) {
            lastMeetingDate = recoveryDate;
          }

          if (recovery.recoveries && Array.isArray(recovery.recoveries)) {
            recovery.recoveries.forEach((memberRecovery) => {
              const amounts = memberRecovery.amounts || {};
              totalSavings += parseFloat(amounts.saving || 0);
            });
          }
        });
      }

      setGroupStats({
        totalMembers,
        totalLoans,
        totalOutstanding,
        totalSavings,
        lastMeeting: lastMeetingDate,
        loading: false,
      });
    } catch (error) {
      console.error("Error loading group stats:", error);
      setGroupStats(prev => ({ ...prev, loading: false }));
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString("en-GB");
    } catch {
      return dateString;
    }
  };

  const handleSyncToBackend = async () => {
    if (!isOnline) {
      setSyncMessage({ type: "error", text: "No internet. Connect and try again." });
      return;
    }
    setSyncMessage(null);
    try {
      await triggerSync();
      setSyncMessage({ type: "success", text: "Data synced to backend successfully." });
      await loadGroupStats();
      setTimeout(() => setSyncMessage(null), 4000);
    } catch (err) {
      const msg = err?.message || "Sync failed.";
      setSyncMessage({ type: "error", text: msg });
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  if (isGroupLoading || groupStats.loading) {
    return (
      <div className="w-full bg-white shadow-md rounded-xl p-5 mb-6">
        <h1 className="text-lg font-bold text-blue-600 mb-4">Group Profile</h1>
        <div className="text-gray-600">Loading group details...</div>
      </div>
    );
  }

  if (!currentGroup) {
    return (
      <div className="w-full bg-white shadow-md rounded-xl p-5 mb-6">
        <h1 className="text-lg font-bold text-blue-600 mb-4">Group Profile</h1>
        <div className="text-gray-600">No group selected</div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white shadow-md rounded-xl p-5 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h1 className="text-lg font-bold text-blue-600">Group Profile</h1>
        {isOnline ? (
          <button
            type="button"
            onClick={handleSyncToBackend}
            disabled={isSyncing}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <RefreshCw className={`w-4 h-4 shrink-0 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing…" : syncPending > 0 ? `Sync to backend (${syncPending} pending)` : "Sync to backend"}
          </button>
        ) : (
          <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-100 text-gray-500 text-sm">
            <CloudOff className="w-4 h-4" />
            Offline – sync when online
          </div>
        )}
      </div>

      {syncMessage && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            syncMessage.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {syncMessage.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-gray-500">Group Code</p>
          <p className="font-semibold">{currentGroup.code || "N/A"}</p>
        </div>

        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-gray-500">Group Name</p>
          <p className="font-semibold">{currentGroup.name || "N/A"}</p>
        </div>

        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-gray-500">Village</p>
          <p className="font-semibold">{currentGroup.village || "N/A"}</p>
        </div>

        {currentGroup.cluster && (
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-500">Cluster</p>
            <p className="font-semibold">{currentGroup.cluster}</p>
          </div>
        )}

        <div className="p-4 bg-green-50 rounded-lg">
          <p className="text-sm text-gray-500">Total Members</p>
          <p className="font-semibold">{groupStats.totalMembers}</p>
        </div>

        <div className="p-4 bg-yellow-50 rounded-lg">
          <p className="text-sm text-gray-500">Total Loans Given</p>
          <p className="font-semibold">{formatCurrency(groupStats.totalLoans)}</p>
        </div>

        <div className="p-4 bg-red-50 rounded-lg">
          <p className="text-sm text-gray-500">Total Outstanding</p>
          <p className="font-semibold">{formatCurrency(groupStats.totalOutstanding)}</p>
        </div>

        <div className="p-4 bg-purple-50 rounded-lg">
          <p className="text-sm text-gray-500">Total Savings</p>
          <p className="font-semibold">{formatCurrency(groupStats.totalSavings)}</p>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500">Last Meeting Date</p>
          <p className="font-semibold">{formatDate(groupStats.lastMeeting)}</p>
        </div>
      </div>
    </div>
  );
};

export default GroupProfile;
