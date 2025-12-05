import { useState } from "react";
import { Link } from "react-router-dom";

const dummyMembers = [
  { id: 1, code: "M001", name: "Rahul Patel", village: "Rewa", status: "Active" },
  { id: 2, code: "M002", name: "Sita Devi", village: "Satna", status: "Inactive" },
  { id: 3, code: "M003", name: "Amit Yadav", village: "Chorhata", status: "Active" },
];

const Members = () => {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");

  const handleExport = () => {
    alert("Export function will be added here (CSV / Excel)");
  };

  const filtered = dummyMembers.filter((m) => {
    const matchSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.code.toLowerCase().includes(search.toLowerCase());

    const matchStatus = filterStatus === "All" || m.status === filterStatus;

    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Member List</h1>

        <div className="flex gap-3">
          <Link
            to="/member-registration"
            className="bg-green-600 text-white px-4 py-2 rounded shadow"
          >
            ➕ Add Member
          </Link>

          <button
            onClick={handleExport}
            className="bg-blue-600 text-white px-4 py-2 rounded shadow"
          >
            ⬇️ Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Search member code / name..."
          className="border p-2 rounded w-64"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="border p-2 rounded"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option>All</option>
          <option>Active</option>
          <option>Inactive</option>
        </select>
      </div>

      {/* Table */}
      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-3 border">Member Code</th>
            <th className="p-3 border">Member Name</th>
            <th className="p-3 border">Village</th>
            <th className="p-3 border">Status</th>
            <th className="p-3 border">Action</th>
          </tr>
        </thead>

        <tbody>
          {filtered.map((m) => (
            <tr key={m.id} className="border hover:bg-gray-50">
              <td className="p-3 border">{m.code}</td>
              <td className="p-3 border">{m.name}</td>
              <td className="p-3 border">{m.village}</td>
              <td className="p-3 border">{m.status}</td>

              <td className="p-3 border text-center">
                <Link
                  to={`/members/${m.id}`}
                  className="bg-blue-600 text-white px-3 py-1 rounded"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Members;
