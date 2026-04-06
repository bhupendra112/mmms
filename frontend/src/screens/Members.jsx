import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, FileText, RefreshCw } from "lucide-react";
import { useGroup } from "../contexts/GroupContext";
import { useOffline } from "../contexts/OfflineContext";
import { getMembersByGroup } from "../services/memberServiceOffline";
import { exportMemberLedger } from "../services/memberService";
import { exportMemberSummaryToExcel, exportMemberSummaryToPDF } from "../utils/exportUtils";
import { sortMembersAscending, getFatherOrHusbandLabel } from "../utils/memberListUtils";

const Members = () => {
  const { currentGroup, isGroupLoading } = useGroup();
  const { lastRefreshedAt } = useOffline();
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState(new Set());
  const [dateRange, setDateRange] = useState({ fromDate: "", toDate: "" });

  const handleExportMember = async (memberId, format = "excel") => {
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
          exportMemberSummaryToExcel([memberData], `Member_${memberCode}_Summary`);
        } else {
          exportMemberSummaryToPDF([memberData], `Member_${memberCode}_Summary`);
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
          exportMemberSummaryToExcel(response.data, `${groupName}_All_Members_Summary`);
        } else {
          exportMemberSummaryToPDF(response.data, `${groupName}_All_Members_Summary`);
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

  const loadMembers = useCallback(() => {
    if (!currentGroup?.id) return;
    setLoading(true);
    getMembersByGroup(currentGroup.id)
      .then((res) => setMembers(Array.isArray(res?.data) ? res.data : []))
      .catch((e) => {
        console.error("Failed to load members:", e);
        setMembers([]);
      })
      .finally(() => setLoading(false));
  }, [currentGroup?.id]);

  useEffect(() => {
    if (isGroupLoading) return;
    if (!currentGroup?.id) return;
    loadMembers();
  }, [currentGroup?.id, isGroupLoading, loadMembers, lastRefreshedAt]);

  const sortedMembers = useMemo(() => sortMembersAscending(members), [members]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedMembers;
    return sortedMembers.filter((m) => {
      const name = String(m.Member_Nm || "").toLowerCase();
      const code = String(m.Member_Id || "").toLowerCase();
      const fh = getFatherOrHusbandLabel(m).toLowerCase();
      const village = String(m.Village || "").toLowerCase();
      return name.includes(q) || code.includes(q) || fh.includes(q) || village.includes(q);
    });
  }, [sortedMembers, search]);

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <div className="members-header flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Member List</h1>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={loadMembers}
            disabled={loading || !currentGroup?.id}
            className="inline-flex items-center justify-center gap-1.5 bg-gray-600 text-white px-4 py-2 rounded shadow text-sm sm:text-base disabled:opacity-50"
            title="Refresh list (e.g. after admin approval)"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
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
            placeholder="Search code, name, father/husband, village..."
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
        {filtered.map((m, idx) => {
          const mid = m._uuid || m._id || m.Member_Id;
          const isLocal = m._isLocal === true;
          return (
            <div key={mid} className="bg-white border rounded-lg p-4 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">Sr. {idx + 1}</p>
                  <h3 className="font-semibold text-gray-800">{m.Member_Nm}</h3>
                  <p className="text-sm text-gray-600">Code: {m.Member_Id}</p>
                  <p className="text-sm text-gray-600">
                    Father / Husband: {getFatherOrHusbandLabel(m) || "—"}
                  </p>
                  {m.Village && <p className="text-sm text-gray-600">Village: {m.Village}</p>}
                </div>
                <div>
                  {isLocal ? (
                    <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs">
                      Pending sync
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                      Active
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-3 border-t">
                <Link
                  to={`/group/members/${mid}`}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm flex-1 text-center"
                >
                  View
                </Link>
                <button
                  onClick={() => handleExportMember(mid, "excel")}
                  disabled={exportLoading || isLocal}
                  className="bg-green-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50 flex-1"
                  title={isLocal ? "Sync first to export" : "Export Excel"}
                >
                  <Download size={14} className="inline mr-1" />
                  Excel
                </button>
                <button
                  onClick={() => handleExportMember(mid, "pdf")}
                  disabled={exportLoading || isLocal}
                  className="bg-red-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50 flex-1"
                  title={isLocal ? "Sync first to export" : "Export PDF"}
                >
                  <FileText size={14} className="inline mr-1" />
                  PDF
                </button>
              </div>
            </div>
          );
        })}
        {!loading && filtered.length === 0 && (
          <div className="bg-white border rounded-lg p-8 text-center text-gray-600">
            No members found.
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden sm:block overflow-x-auto members-table-container">
        <table className="w-full border min-w-[800px]">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 border text-center text-sm sm:text-base w-12">Sr.</th>
              <th className="p-3 border text-left text-sm sm:text-base">Member Code</th>
              <th className="p-3 border text-left text-sm sm:text-base">Member Name</th>
              <th className="p-3 border text-left text-sm sm:text-base">Father / Husband</th>
              <th className="p-3 border text-left text-sm sm:text-base">Village</th>
              <th className="p-3 border text-left text-sm sm:text-base">Status</th>
              <th className="p-3 border text-center text-sm sm:text-base">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((m, idx) => {
              const mid = m._uuid || m._id || m.Member_Id;
              const isLocal = m._isLocal === true;
              return (
                <tr key={mid} className="border hover:bg-gray-50">
                  <td className="p-3 border text-sm sm:text-base text-center text-gray-600 tabular-nums">{idx + 1}</td>
                  <td className="p-3 border text-sm sm:text-base">{m.Member_Id}</td>
                  <td className="p-3 border text-sm sm:text-base">{m.Member_Nm}</td>
                  <td className="p-3 border text-sm sm:text-base">{getFatherOrHusbandLabel(m) || "—"}</td>
                  <td className="p-3 border text-sm sm:text-base">{m.Village || "-"}</td>
                  <td className="p-3 border">
                    {isLocal ? (
                      <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs sm:text-sm">
                        Pending sync
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs sm:text-sm">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="p-3 border text-center">
                    <div className="flex items-center justify-center gap-1 sm:gap-2">
                      <Link
                        to={`/group/members/${mid}`}
                        className="bg-blue-600 text-white px-2 sm:px-3 py-1 rounded text-xs sm:text-sm"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => handleExportMember(mid, "excel")}
                        disabled={exportLoading || isLocal}
                        className="bg-green-600 text-white px-2 py-1 rounded text-xs sm:text-sm disabled:opacity-50"
                        title={isLocal ? "Sync first to export" : "Export Ledger (Excel)"}
                      >
                        <Download size={14} />
                      </button>
                      <button
                        onClick={() => handleExportMember(mid, "pdf")}
                        disabled={exportLoading || isLocal}
                        className="bg-red-600 text-white px-2 py-1 rounded text-xs sm:text-sm disabled:opacity-50"
                        title={isLocal ? "Sync first to export" : "Export Ledger (PDF)"}
                      >
                        <FileText size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
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
