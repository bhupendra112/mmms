import React from "react";

const LedgerFilters = ({ filters, setFilters }) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow-md mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">

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
          <option value="Sita Devi">Sita Devi</option>
          <option value="Rani Verma">Rani Verma</option>
          <option value="Kusum Bai">Kusum Bai</option>
        </select>
      </div>

      {/* Category Filter */}
      <div>
        <label className="text-sm text-gray-600">Category</label>
        <select
          className="w-full border p-2 rounded mt-1"
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
        >
          <option value="">All</option>
          <option value="Savings">Savings</option>
          <option value="Loan">Loan</option>
          <option value="FD">FD</option>
          <option value="Interest">Interest</option>
          <option value="Other">Other</option>
        </select>
      </div>

    </div>
  );
};

export default LedgerFilters;
