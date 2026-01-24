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

  const handleExport = () => {
    return handleBulkExport("excel");
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
    <div className="p-3 sm:p-4 md:p-6">
      <div className="members-header flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Member List</h1>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
          <Link
            to="/group/member-registration"
            className="bg-green-600 text-white px-4 py-2 rounded shadow text-center text-sm sm:text-base"
          >
            ➕ Add Member
          </Link>

          <button
            onClick={handleExport}
            className="bg-blue-600 text-white px-4 py-2 rounded shadow text-sm sm:text-base"
          >
            ⬇️ Export
          </button>
        </div>
      </div>

      {/* Filters and Export */}
      <div className="mb-4 sm:mb-6 space-y-4">
        <div className="flex gap-2 sm:gap-4">
          <input
            type="text"
            placeholder="Search member code / name..."
            className="search-input border p-2 rounded w-full sm:w-64 text-sm sm:text-base"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Date Range and Bulk Export */}
        <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Export Options</h3>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-3">
            <div className="w-full sm:w-auto">
              <label className="block text-sm font-semibold text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                value={dateRange.fromDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, fromDate: e.target.value }))}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div className="w-full sm:w-auto">
              <label className="block text-sm font-semibold text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                value={dateRange.toDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, toDate: e.target.value }))}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-end gap-2 w-full sm:w-auto">
              <button
                onClick={() => handleBulkExport('excel')}
                disabled={exportLoading}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50 w-full sm:w-auto"
              >
                <Download size={16} />
                {exportLoading ? "Exporting..." : "Export All (Excel)"}
              </button>
              <button
                onClick={() => handleBulkExport('pdf')}
                disabled={exportLoading}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:opacity-50 w-full sm:w-auto"
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

      {/* Mobile Card View */}
      <div className="block sm:hidden space-y-4">
        {filtered.map((m) => (
          <div key={m._id} className="bg-white border rounded-lg p-4 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800">{m.Member_Nm}</h3>
                <p className="text-sm text-gray-600">Code: {m.Member_Id}</p>
                {m.Village && <p className="text-sm text-gray-600">Village: {m.Village}</p>}
              </div>
              <div>
                {m.__pending ? (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                    Pending
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                    Active
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-3 border-t">
              {m.__pending ? (
                <span className="text-gray-500 text-sm">Waiting for approval</span>
              ) : (
                <>
                  <Link
                    to={`/group/members/${m._id}`}
                    className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm flex-1 text-center"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => handleExportMember(m._id, 'excel')}
                    disabled={exportLoading}
                    className="bg-green-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50 flex-1"
                    title="Export Excel"
                  >
                    <Download size={14} className="inline mr-1" />
                    Excel
                  </button>
                  <button
                    onClick={() => handleExportMember(m._id, 'pdf')}
                    disabled={exportLoading}
                    className="bg-red-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50 flex-1"
                    title="Export PDF"
                  >
                    <FileText size={14} className="inline mr-1" />
                    PDF
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {!loading && filtered.length === 0 && (
          <div className="bg-white border rounded-lg p-8 text-center text-gray-600">
            No members found.
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden sm:block overflow-x-auto members-table-container">
        <table className="w-full border min-w-[640px]">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 border text-left text-sm sm:text-base">Member Code</th>
              <th className="p-3 border text-left text-sm sm:text-base">Member Name</th>
              <th className="p-3 border text-left text-sm sm:text-base">Village</th>
              <th className="p-3 border text-left text-sm sm:text-base">Status</th>
              <th className="p-3 border text-center text-sm sm:text-base">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((m) => (
              <tr key={m._id} className="border hover:bg-gray-50">
                <td className="p-3 border text-sm sm:text-base">{m.Member_Id}</td>
                <td className="p-3 border text-sm sm:text-base">{m.Member_Nm}</td>
                <td className="p-3 border text-sm sm:text-base">{m.Village || "-"}</td>
                <td className="p-3 border">
                  {m.__pending ? (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs sm:text-sm">
                      Pending Approval
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs sm:text-sm">
                      Active
                    </span>
                  )}
                </td>

                <td className="p-3 border text-center">
                  {m.__pending ? (
                    <span className="text-gray-500 text-sm">Waiting</span>
                  ) : (
                    <div className="flex items-center justify-center gap-1 sm:gap-2">
                      <Link
                        to={`/group/members/${m._id}`}
                        className="bg-blue-600 text-white px-2 sm:px-3 py-1 rounded text-xs sm:text-sm"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => handleExportMember(m._id, 'excel')}
                        disabled={exportLoading}
                        className="bg-green-600 text-white px-2 py-1 rounded text-xs sm:text-sm disabled:opacity-50"
                        title="Export Ledger (Excel)"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        onClick={() => handleExportMember(m._id, 'pdf')}
                        disabled={exportLoading}
                        className="bg-red-600 text-white px-2 py-1 rounded text-xs sm:text-sm disabled:opacity-50"
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
    </div>
  );
};

export default Members;
