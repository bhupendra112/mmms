import React from "react";

const GroupProfile = () => {
  const group = {
    code: "GRP123",
    name: "Maa Sharda Mahila Group",
    village: "Rewa",
    totalMembers: 18,
    totalLoans: 450000,
    totalOutstanding: 120000,
    totalSavings: 780000,
    lastMeeting: "2025-01-20",
  };

  return (
    <div className="w-full bg-white shadow-md rounded-xl p-5 mb-6">
      <h1 className="text-lg font-bold text-blue-600 mb-4">
        Group Profile
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-gray-500">Group Code</p>
          <p className="font-semibold">{group.code}</p>
        </div>

        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-gray-500">Group Name</p>
          <p className="font-semibold">{group.name}</p>
        </div>

        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-gray-500">Village</p>
          <p className="font-semibold">{group.village}</p>
        </div>

        <div className="p-4 bg-green-50 rounded-lg">
          <p className="text-sm text-gray-500">Total Members</p>
          <p className="font-semibold">{group.totalMembers}</p>
        </div>

        <div className="p-4 bg-yellow-50 rounded-lg">
          <p className="text-sm text-gray-500">Total Loans Given</p>
          <p className="font-semibold">₹ {group.totalLoans}</p>
        </div>

        <div className="p-4 bg-red-50 rounded-lg">
          <p className="text-sm text-gray-500">Total Outstanding</p>
          <p className="font-semibold">₹ {group.totalOutstanding}</p>
        </div>

        <div className="p-4 bg-purple-50 rounded-lg">
          <p className="text-sm text-gray-500">Total Savings</p>
          <p className="font-semibold">₹ {group.totalSavings}</p>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500">Last Meeting Date</p>
          <p className="font-semibold">{group.lastMeeting}</p>
        </div>

      </div>
    </div>
  );
};

export default GroupProfile;
