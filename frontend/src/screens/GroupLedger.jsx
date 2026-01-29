import React, { useState, useEffect } from "react";
import { RefreshCw, CloudOff } from "lucide-react";
import LedgerFilters from "../components/LedgerFilters";
import LedgerTable from "../components/LedgerTable";
import GroupProfile from "./GroupProfile";
import { useGroup } from "../contexts/GroupContext";
import { useOffline } from "../contexts/OfflineContext";
import { getRecoveries } from "../services/recoveryServiceOffline";
import { getMembersByGroup } from "../services/memberServiceOffline";

const GroupLedger = () => {
  const { currentGroup, isGroupLoading } = useGroup();
  const { isOnline, triggerRefresh, lastRefreshedAt } = useOffline();
  const [refreshInProgress, setRefreshInProgress] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState(null);
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    member: "",
    category: "",
  });
  const [ledgerData, setLedgerData] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const log = (loc, msg, data) => { fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: loc, message: msg, data: data || {}, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H7' }) }).catch(() => { }); };
    if (currentGroup?.id) {
      log('GroupLedger.jsx:useEffect', 'Load triggered', { currentGroupId: currentGroup?.id, lastRefreshedAt });
      loadLedgerData();
      loadMembers();
    } else if (!isGroupLoading) {
      setLoading(false);
    }
  }, [currentGroup, isGroupLoading, lastRefreshedAt]);

  const handleGetFreshData = async () => {
    const log = (loc, msg, data) => { fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: loc, message: msg, data: data || {}, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H6' }) }).catch(() => { }); };
    log('GroupLedger.jsx:handleGetFreshData', 'Get fresh data clicked', { isOnline, currentGroupId: currentGroup?.id });
    if (!isOnline) {
      setRefreshMessage({ type: "error", text: "You are offline. Connect to the internet to fetch fresh data." });
      setTimeout(() => setRefreshMessage(null), 4000);
      return;
    }
    setRefreshMessage(null);
    setRefreshInProgress(true);
    try {
      log('GroupLedger.jsx:handleGetFreshData', 'Calling triggerRefresh', {});
      await triggerRefresh();
      log('GroupLedger.jsx:handleGetFreshData', 'TriggerRefresh success', {});
      setRefreshMessage({ type: "success", text: "Full fresh data loaded (groups, members, loans, FDs, payments, recoveries, expenses)." });
      setTimeout(() => setRefreshMessage(null), 4000);
    } catch (err) {
      log('GroupLedger.jsx:handleGetFreshData', 'TriggerRefresh error', { error: err?.message });
      setRefreshMessage({ type: "error", text: err?.message || "Failed to fetch fresh data." });
      setTimeout(() => setRefreshMessage(null), 5000);
    } finally {
      setRefreshInProgress(false);
    }
  };

  const loadMembers = async () => {
    const log = (loc, msg, data) => { fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: loc, message: msg, data: data || {}, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H7' }) }).catch(() => { }); };
    try {
      log('GroupLedger.jsx:loadMembers', 'Load members start', { groupId: currentGroup?.id });
      const response = await getMembersByGroup(currentGroup.id);
      const arr = Array.isArray(response?.data) ? response.data : [];
      log('GroupLedger.jsx:loadMembers', 'Load members done', { success: response?.success, count: arr.length });
      if (response.success && response.data) setMembers(arr);
    } catch (err) {
      log('GroupLedger.jsx:loadMembers', 'Load members error', { error: err?.message });
      console.error("Error loading members:", err);
    }
  };

  const loadLedgerData = async () => {
    const log = (loc, msg, data) => { fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: loc, message: msg, data: data || {}, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H7' }) }).catch(() => { }); };
    try {
      setLoading(true);
      setError("");
      log('GroupLedger.jsx:loadLedgerData', 'Load ledger start', { groupId: currentGroup?.id });
      const response = await getRecoveries(currentGroup.id);
      const raw = response?.data;
      const isArr = Array.isArray(raw);
      log('GroupLedger.jsx:loadLedgerData', 'Load ledger response', { success: response?.success, isArray: isArr, length: isArr ? raw.length : 0 });
      if (response.success && response.data) {
        // Transform recovery data to ledger format
        const transformedData = [];

        // Process each recovery
        if (Array.isArray(response.data)) {
          response.data.forEach((recovery) => {
            // Process individual member recoveries
            if (recovery.recoveries && Array.isArray(recovery.recoveries)) {
              recovery.recoveries.forEach((memberRecovery) => {
                const amounts = memberRecovery.amounts || {};
                const saving = parseFloat(amounts.saving || 0);
                const loan = parseFloat(amounts.loan || 0);
                const fd = parseFloat(amounts.fd || 0);
                const interest = parseFloat(amounts.interest || 0);
                const yogdan = parseFloat(amounts.yogdan || 0);
                const other = parseFloat(amounts.other || 0);
                const total = saving + loan + fd + interest + yogdan + other;

                // Format date
                const recoveryDate = recovery.date || memberRecovery.date;
                const formattedDate = recoveryDate
                  ? new Date(recoveryDate).toLocaleDateString("en-GB")
                  : "N/A";

                transformedData.push({
                  date: recoveryDate, // Keep original for sorting/filtering
                  formattedDate: formattedDate, // Formatted for display
                  member: memberRecovery.memberName || memberRecovery.member_name || "",
                  savings: saving,
                  loan: loan,
                  fd: fd,
                  interest: interest,
                  yogdan: yogdan,
                  other: other,
                  total: total,
                  mode: memberRecovery.paymentMode?.cash && memberRecovery.paymentMode?.online
                    ? "Cash & Online"
                    : memberRecovery.paymentMode?.cash
                      ? "Cash"
                      : memberRecovery.paymentMode?.online
                        ? "Online"
                        : "N/A",
                });
              });
            }
          });
        }

        // Sort by date (newest first)
        transformedData.sort((a, b) => {
          const dateA = a.date ? new Date(a.date) : new Date(0);
          const dateB = b.date ? new Date(b.date) : new Date(0);
          return dateB - dateA;
        });
        setLedgerData(transformedData);
      } else {
        setLedgerData([]);
      }
    } catch (err) {
      console.error("Error loading ledger data:", err);
      setError(err.message || "Failed to load ledger data");
      setLedgerData([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter ledger data based on filters
  const filteredLedgerData = ledgerData.filter((entry) => {
    if (filters.from && entry.date) {
      const entryDate = new Date(entry.date);
      const fromDate = new Date(filters.from);
      if (entryDate < fromDate) return false;
    }
    if (filters.to && entry.date) {
      const entryDate = new Date(entry.date);
      const toDate = new Date(filters.to);
      toDate.setHours(23, 59, 59, 999); // Include entire day
      if (entryDate > toDate) return false;
    }
    if (filters.member && entry.member) {
      if (!entry.member.toLowerCase().includes(filters.member.toLowerCase())) return false;
    }
    if (filters.category && entry.mode) {
      if (entry.mode.toLowerCase() !== filters.category.toLowerCase()) return false;
    }
    return true;
  });

  if (isGroupLoading || loading) {
    return (
      <div className="flex flex-col min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-gray-100 p-3 sm:p-4">
        <div className="flex items-center justify-center min-h-[280px]">
          <div className="text-gray-600">Loading ledger data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-gray-100 p-3 sm:p-4">
      {/* Group Header */}
      <GroupProfile />

      {/* Ledger Title + Get fresh data */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-blue-600">
          Group Ledger
        </h1>
        {isOnline ? (
          <button
            type="button"
            onClick={handleGetFreshData}
            disabled={refreshInProgress || !currentGroup?.id}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Fetch latest data from backend (groups, members, loans, FDs, payments, recoveries, expenses)"
          >
            <RefreshCw className={`w-4 h-4 shrink-0 ${refreshInProgress ? "animate-spin" : ""}`} />
            {refreshInProgress ? "Fetching…" : "Get full fresh data"}
          </button>
        ) : (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-500 text-sm">
            <CloudOff className="w-4 h-4" />
            Offline – connect to get full fresh data
          </div>
        )}
      </div>

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

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4">
        <LedgerFilters
          filters={filters}
          setFilters={setFilters}
          members={members}
          ledgerData={ledgerData}
        />
      </div>

      {/* Ledger Table - scrollable container */}
      {filteredLedgerData.length > 0 ? (
        <div className="min-h-0 flex-1 w-full overflow-x-auto overflow-y-visible">
          <LedgerTable ledger={filteredLedgerData} />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-6 sm:p-8 text-center">
          <p className="text-gray-600 text-sm sm:text-base">No ledger entries found</p>
        </div>
      )}
    </div>
  );
};

export default GroupLedger;
