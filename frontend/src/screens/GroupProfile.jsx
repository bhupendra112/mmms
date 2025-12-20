import React, { useState, useEffect } from "react";
import { useGroup } from "../contexts/GroupContext";
import { getMembersByGroup } from "../services/memberService";
import { getLoans } from "../services/loanService";
import { getRecoveries } from "../services/recoveryService";

const GroupProfile = () => {
  const { currentGroup, isGroupLoading } = useGroup();
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
      <h1 className="text-lg font-bold text-blue-600 mb-4">Group Profile</h1>

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
