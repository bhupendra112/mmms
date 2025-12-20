import React, { useState, useEffect } from "react";
import LedgerFilters from "../components/LedgerFilters";
import LedgerTable from "../components/LedgerTable";
import GroupProfile from "./GroupProfile";
import { useGroup } from "../contexts/GroupContext";
import { getRecoveries } from "../services/recoveryService";
import { getMembersByGroup } from "../services/memberService";

const GroupLedger = () => {
  const { currentGroup, isGroupLoading } = useGroup();
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
    if (currentGroup?.id) {
      loadLedgerData();
      loadMembers();
    } else if (!isGroupLoading) {
      setLoading(false);
    }
  }, [currentGroup, isGroupLoading]);

  const loadMembers = async () => {
    try {
      const response = await getMembersByGroup(currentGroup.id);
      if (response.success && response.data) {
        setMembers(Array.isArray(response.data) ? response.data : []);
      }
    } catch (err) {
      console.error("Error loading members:", err);
    }
  };

  const loadLedgerData = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await getRecoveries(currentGroup.id);
      
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
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-gray-600">Loading ledger data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Group Header */}
      <GroupProfile />

      {/* Ledger Title */}
      <h1 className="text-2xl font-bold text-blue-600 mb-4">
        Group Ledger
      </h1>

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

      {/* Ledger Table */}
      {filteredLedgerData.length > 0 ? (
        <LedgerTable ledger={filteredLedgerData} />
      ) : (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-600">No ledger entries found</p>
        </div>
      )}
    </div>
  );
};

export default GroupLedger;
