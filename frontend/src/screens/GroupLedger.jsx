import React, { useState } from "react";
import GroupProfile from "./GroupProfile";
import { useGroup } from "../contexts/GroupContext";
import { useOffline } from "../contexts/OfflineContext";
import { RefreshCw, CloudOff } from "lucide-react";

const GroupLedger = () => {
  const { currentGroup, isGroupLoading } = useGroup();
  const { isOnline, triggerRefresh } = useOffline();
  const [refreshInProgress, setRefreshInProgress] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState(null);

  const handleGetFreshData = async () => {
    if (!isOnline) {
      setRefreshMessage({
        type: "error",
        text: "You are offline. Connect to the internet to fetch fresh data.",
      });
      setTimeout(() => setRefreshMessage(null), 4000);
      return;
    }

    setRefreshMessage(null);
    setRefreshInProgress(true);
    try {
      await triggerRefresh();
      setRefreshMessage({
        type: "success",
        text:
          "Full fresh data loaded (groups, members, loans, FDs, payments, recoveries, expenses).",
      });
      setTimeout(() => setRefreshMessage(null), 4000);
    } catch (err) {
      setRefreshMessage({
        type: "error",
        text: err?.message || "Failed to fetch fresh data.",
      });
      setTimeout(() => setRefreshMessage(null), 5000);
    } finally {
      setRefreshInProgress(false);
    }
  };

  if (isGroupLoading) {
    return (
      <div className="flex flex-col min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-gray-100 p-3 sm:p-4">
        <div className="flex items-center justify-center min-h-[280px]">
          <div className="text-gray-600">Loading group...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-gray-100 p-3 sm:p-4">
      {/* Top bar with refresh button */}
      <div className="flex items-center justify-end mb-3">
        {isOnline ? (
          <button
            type="button"
            onClick={handleGetFreshData}
            disabled={refreshInProgress || !currentGroup?.id}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full font-medium text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
            title="Fetch latest data from backend (groups, members, loans, FDs, payments, recoveries, expenses)"
          >
            <RefreshCw
              className={`w-4 h-4 shrink-0 ${
                refreshInProgress ? "animate-spin" : ""
              }`}
            />
            {refreshInProgress ? "Refreshing…" : "Refresh data"}
          </button>
        ) : (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-gray-500 text-xs sm:text-sm shadow-sm">
            <CloudOff className="w-4 h-4" />
            <span>Offline – connect to refresh</span>
          </div>
        )}
      </div>

      {/* Group Header */}
      <GroupProfile />

      {refreshMessage && (
        <div
          className={`mt-4 mb-2 px-4 py-3 rounded-lg text-sm ${
            refreshMessage.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {refreshMessage.text}
        </div>
      )}
    </div>
  );
};

export default GroupLedger;
