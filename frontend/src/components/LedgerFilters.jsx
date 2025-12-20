import React from "react";

const LedgerFilters = ({ filters, setFilters, members = [], ledgerData = [] }) => {
  // Extract unique member names from members list
  const memberNamesFromList = members.length > 0 
    ? members.map(m => m.Member_Nm || m.memberName || m.name || "").filter(Boolean)
    : [];

  // Extract unique member names from ledger data
  const memberNamesFromLedger = ledgerData.length > 0
    ? ledgerData.map(entry => entry.member || "").filter(Boolean)
    : [];

  // Combine both sources and remove duplicates
  const allMemberNames = [...memberNamesFromList, ...memberNamesFromLedger];
  const uniqueMemberNames = [...new Set(allMemberNames)].sort();

  return (
    <div className="bg-white p-4 rounded-lg shadow-md mb-4 grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Date Range */}
      <div>
        <label className="text-sm text-gray-600">From Date</label>
        <input
          type="date"
          className="w-full border p-2 rounded mt-1"
          value={filters.from}
          onChange={(e) => setFilters({ ...filters, from: e.target.value })}
        />
      </div>

      <div>
        <label className="text-sm text-gray-600">To Date</label>
        <input
          type="date"
          className="w-full border p-2 rounded mt-1"
          value={filters.to}
          onChange={(e) => setFilters({ ...filters, to: e.target.value })}
        />
      </div>

      {/* Member Filter */}
      <div>
        <label className="text-sm text-gray-600">Member</label>
        <select
          className="w-full border p-2 rounded mt-1"
          value={filters.member}
          onChange={(e) => setFilters({ ...filters, member: e.target.value })}
        >
          <option value="">All Members</option>
          {uniqueMemberNames.map((memberName, index) => (
            <option key={index} value={memberName}>
              {memberName}
            </option>
          ))}
        </select>
      </div>

      {/* Payment Mode Filter */}
      <div>
        <label className="text-sm text-gray-600">Payment Mode</label>
        <select
          className="w-full border p-2 rounded mt-1"
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
        >
          <option value="">All Modes</option>
          <option value="cash">Cash</option>
          <option value="online">Online</option>
          <option value="cash & online">Cash & Online</option>
        </select>
      </div>
    </div>
  );
};

export default LedgerFilters;
