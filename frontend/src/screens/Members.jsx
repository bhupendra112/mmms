import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useGroup } from "../contexts/GroupContext";
import { getMembersByGroup } from "../services/memberService";
import { getPendingApprovals } from "../services/approvalDB";

const Members = () => {
  const { currentGroup, isGroupLoading } = useGroup();
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState([]);
  const [pendingMembers, setPendingMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleExport = () => {
    alert("Export function will be added here (CSV / Excel)");
  };

  useEffect(() => {
    if (isGroupLoading) return;
    if (!currentGroup?.id) return;
    setLoading(true);
    getMembersByGroup(currentGroup.id)
      .then((res) => setMembers(Array.isArray(res?.data) ? res.data : []))
      .catch((e) => {
        console.error("Failed to load members:", e);
        setMembers([]);
      })
      .finally(() => setLoading(false));
  }, [currentGroup?.id, isGroupLoading]);

  useEffect(() => {
    if (isGroupLoading) return;
    if (!currentGroup?.id) return;
    getPendingApprovals(currentGroup.id)
      .then((approvals) => {
        const pending = (approvals || [])
          .filter((a) => a.type === "member" && a.status === "pending")
          .map((a) => ({
            _id: a.id,
            Member_Id: a.data?.Member_Id || "PENDING",
            Member_Nm: a.data?.Member_Nm || "-",
            Village: a.data?.Village || "-",
            __pending: true,
          }));
        setPendingMembers(pending);
      })
      .catch((e) => {
        console.error("Failed to load pending approvals:", e);
        setPendingMembers([]);
      });
  }, [currentGroup?.id, isGroupLoading]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const combined = [...pendingMembers, ...members];
    if (!q) return combined;
    return combined.filter((m) => {
      const name = String(m.Member_Nm || "").toLowerCase();
      const code = String(m.Member_Id || "").toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [members, pendingMembers, search]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Member List</h1>

        <div className="flex gap-3">
          <Link
            to="/group/member-registration"
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
      </div>

      {isGroupLoading && <p className="text-gray-600">Loading group…</p>}
      {!isGroupLoading && !currentGroup && (
        <p className="text-gray-600">No active group found.</p>
      )}
      {loading && <p className="text-gray-600">Loading members…</p>}

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
            <tr key={m._id} className="border hover:bg-gray-50">
              <td className="p-3 border">{m.Member_Id}</td>
              <td className="p-3 border">{m.Member_Nm}</td>
              <td className="p-3 border">{m.Village || "-"}</td>
              <td className="p-3 border">
                {m.__pending ? (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                    Pending Approval
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                    Active
                  </span>
                )}
              </td>

              <td className="p-3 border text-center">
                {m.__pending ? (
                  <span className="text-gray-500 text-sm">Waiting</span>
                ) : (
                  <Link
                    to={`/group/members/${m._id}`}
                    className="bg-blue-600 text-white px-3 py-1 rounded"
                  >
                    View
                  </Link>
                )}
              </td>
            </tr>
          ))}
          {!loading && filtered.length === 0 && (
            <tr>
              <td className="p-4 text-center text-gray-600" colSpan={5}>
                No members found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Members;
