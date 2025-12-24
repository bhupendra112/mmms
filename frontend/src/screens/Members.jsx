import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, FileText } from "lucide-react";
import { useGroup } from "../contexts/GroupContext";
import { getMembersByGroup, exportMemberLedger } from "../services/memberService";
import { getPendingApprovals } from "../services/approvalDB";
import { exportMemberLedgerToExcel, exportMemberLedgerToPDF } from "../utils/exportUtils";

const Members = () => {
  const { currentGroup, isGroupLoading } = useGroup();
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState([]);
  const [pendingMembers, setPendingMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState(new Set());
  const [dateRange, setDateRange] = useState({ fromDate: "", toDate: "" });

  const handleExportMember = async (memberId, format = 'excel') => {
    try {
      setExportLoading(true);
      const filters = {
        memberId: memberId,
        fromDate: dateRange.fromDate || undefined,
        toDate: dateRange.toDate || undefined,
      };
      
      const response = await exportMemberLedger(filters);
      
      if (response?.success && response?.data && response.data.length > 0) {
        const memberData = response.data[0];
        const memberCode = memberData.memberInfo?.code || "Member";
        
        if (format === 'excel') {
          exportMemberLedgerToExcel([memberData], `Member_${memberCode}_Ledger`);
        } else {
          exportMemberLedgerToPDF([memberData], `Member_${memberCode}_Ledger`);
        }
      } else {
        alert("No ledger data found to export");
      }
    } catch (error) {
      console.error("Error exporting ledger:", error);
      alert("Failed to export ledger. Please try again.");
    } finally {
      setExportLoading(false);
    }
  };

  const handleBulkExport = async (format = 'excel') => {
    if (!currentGroup?.id) {
      alert("Please select a group first");
      return;
    }
    
    try {
      setExportLoading(true);
      const filters = {
        groupId: currentGroup.id,
        fromDate: dateRange.fromDate || undefined,
        toDate: dateRange.toDate || undefined,
      };
      
      const response = await exportMemberLedger(filters);
      
      if (response?.success && response?.data && response.data.length > 0) {
        const groupName = currentGroup.name || "Group";
        if (format === 'excel') {
          exportMemberLedgerToExcel(response.data, `${groupName}_All_Members_Ledger`);
        } else {
          exportMemberLedgerToPDF(response.data, `${groupName}_All_Members_Ledger`);
        }
      } else {
        alert("No ledger data found to export");
      }
    } catch (error) {
      console.error("Error exporting ledger:", error);
      alert("Failed to export ledger. Please try again.");
    } finally {
      setExportLoading(false);
    }
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

      {/* Filters and Export */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Search member code / name..."
            className="border p-2 rounded w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        {/* Date Range and Bulk Export */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Export Options</h3>
          <div className="flex items-center gap-4 mb-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                value={dateRange.fromDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, fromDate: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                value={dateRange.toDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, toDate: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={() => handleBulkExport('excel')}
                disabled={exportLoading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
              >
                <Download size={16} />
                {exportLoading ? "Exporting..." : "Export All (Excel)"}
              </button>
              <button
                onClick={() => handleBulkExport('pdf')}
                disabled={exportLoading}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:opacity-50"
              >
                <FileText size={16} />
                {exportLoading ? "Exporting..." : "Export All (PDF)"}
              </button>
            </div>
          </div>
        </div>
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
            <th className="p-3 border">Actions</th>
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
                  <div className="flex items-center justify-center gap-2">
                    <Link
                      to={`/group/members/${m._id}`}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => handleExportMember(m._id, 'excel')}
                      disabled={exportLoading}
                      className="bg-green-600 text-white px-2 py-1 rounded text-sm disabled:opacity-50"
                      title="Export Ledger (Excel)"
                    >
                      <Download size={14} />
                    </button>
                    <button
                      onClick={() => handleExportMember(m._id, 'pdf')}
                      disabled={exportLoading}
                      className="bg-red-600 text-white px-2 py-1 rounded text-sm disabled:opacity-50"
                      title="Export Ledger (PDF)"
                    >
                      <FileText size={14} />
                    </button>
                  </div>
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
