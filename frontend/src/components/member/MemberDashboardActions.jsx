import { Download, Plus } from "lucide-react";

const btn = "flex items-center justify-center gap-1 px-2 sm:px-3 py-2 text-xs sm:text-sm rounded-lg font-medium shadow-sm transition-colors min-h-[44px] min-w-0";

export default function MemberDashboardActions({
  onCreateFD,
  onExportTableExcel,
  onExportFullDetailsExcel,
  onExportCompleteLedgerExcel,
}) {
  return (
    <div className="flex flex-wrap gap-1.5 sm:gap-2 w-full min-w-0">
      <button onClick={onCreateFD} className={`${btn} bg-green-600 text-white hover:bg-green-700`} title="Create New FD">
        <Plus size={14} className="shrink-0" />
        <span className="break-words">New FD</span>
      </button>
      <button onClick={onExportTableExcel} className={`${btn} bg-blue-600 text-white hover:bg-blue-700`} title="Export Table Excel">
        <Download size={14} className="shrink-0" />
        <span className="break-words">Export</span>
      </button>
      <button onClick={onExportFullDetailsExcel} className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700`} title="Export Full Details Excel">
        <Download size={14} className="shrink-0" />
        <span className="break-words">Full Details</span>
      </button>
      <button onClick={onExportCompleteLedgerExcel} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`} title="Export Complete Ledger Excel">
        <Download size={14} className="shrink-0" />
        <span className="break-words">Complete Ledger</span>
      </button>
    </div>
  );
}
