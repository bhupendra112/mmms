import React, { useState } from "react";
import LedgerFilters from "../components/LedgerFilters";
import LedgerTable from "../components/LedgerTable";
import GroupProfile from "./GroupProfile";

const GroupLedger = () => {
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    member: "",
    category: "",
  });

  const ledgerData = [
    {
      date: "2025-01-20",
      member: "Sita Devi",
      savings: 200,
      loan: 1000,
      fd: 0,
      interest: 50,
      other: 0,
      total: 1250,
      mode: "Cash",
    },
    {
      date: "2025-01-20",
      member: "Rani Verma",
      savings: 300,
      loan: 500,
      fd: 100,
      interest: 40,
      other: 10,
      total: 950,
      mode: "Online",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-100 p-4">

      {/* Group Header */}
      <GroupProfile />

      {/* Ledger Title */}
      <h1 className="text-2xl font-bold text-blue-600 mb-4">
        Group Ledger
      </h1>

      {/* Filters */}
      <div className="mb-4">
        <LedgerFilters filters={filters} setFilters={setFilters} />
      </div>

      {/* Ledger Table */}
      <LedgerTable ledger={ledgerData} />

    </div>
  );
};

export default GroupLedger;
