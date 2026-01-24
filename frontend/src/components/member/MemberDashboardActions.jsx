import { Download, FileText, Plus } from "lucide-react";

export default function MemberDashboardActions({
  onCreateFD,
  onExportTableExcel,
  onExportTablePDF,
  onExportFullDetailsExcel,
  onExportFullDetailsPDF,
  onExportCompleteLedgerExcel,
  onExportCompleteLedgerPDF,
}) {
  return (
    <div className="action-buttons-container flex flex-wrap justify-start sm:justify-end gap-1.5 sm:gap-2 mb-3 sm:mb-4 md:mb-6 w-full box-border">
      <button
        onClick={onCreateFD}
        className="flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-sm text-xs transition-colors flex-shrink-0"
      >
        <Plus size={12} className="sm:w-3.5 sm:h-3.5 shrink-0" />
        <span className="hidden sm:inline">Create New FD</span>
        <span className="sm:hidden">New FD</span>
      </button>
      <button
        onClick={onExportTableExcel}
        className="flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm text-xs transition-colors flex-shrink-0"
      >
        <Download size={12} className="sm:w-3.5 sm:h-3.5 shrink-0" />
        <span className="hidden xl:inline">Export Table Excel</span>
        <span className="xl:hidden hidden md:inline">Table Excel</span>
        <span className="md:hidden hidden sm:inline">Excel</span>
        <span className="sm:hidden">E</span>
      </button>
      <button
        onClick={onExportTablePDF}
        className="flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-sm text-xs transition-colors flex-shrink-0"
      >
        <FileText size={12} className="sm:w-3.5 sm:h-3.5 shrink-0" />
        <span className="hidden xl:inline">Export Table PDF</span>
        <span className="xl:hidden hidden md:inline">Table PDF</span>
        <span className="md:hidden hidden sm:inline">PDF</span>
        <span className="sm:hidden">P</span>
      </button>
      <button
        onClick={onExportFullDetailsExcel}
        className="flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm text-xs transition-colors flex-shrink-0"
      >
        <Download size={12} className="sm:w-3.5 sm:h-3.5 shrink-0" />
        <span className="hidden xl:inline">Export Full Details Excel</span>
        <span className="xl:hidden hidden md:inline">Full Excel</span>
        <span className="md:hidden hidden sm:inline">Full</span>
        <span className="sm:hidden">F</span>
      </button>
      <button
        onClick={onExportFullDetailsPDF}
        className="flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium shadow-sm text-xs transition-colors flex-shrink-0"
      >
        <FileText size={12} className="sm:w-3.5 sm:h-3.5 shrink-0" />
        <span className="hidden xl:inline">Export Full Details PDF</span>
        <span className="xl:hidden hidden md:inline">Full PDF</span>
        <span className="md:hidden hidden sm:inline">PDF</span>
        <span className="sm:hidden">P</span>
      </button>
      <button
        onClick={onExportCompleteLedgerExcel}
        className="flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-sm text-xs transition-colors flex-shrink-0"
      >
        <Download size={12} className="sm:w-3.5 sm:h-3.5 shrink-0" />
        <span className="hidden xl:inline">Export Complete Ledger Excel</span>
        <span className="xl:hidden hidden md:inline">Ledger Excel</span>
        <span className="md:hidden hidden sm:inline">Ledger</span>
        <span className="sm:hidden">L</span>
      </button>
      <button
        onClick={onExportCompleteLedgerPDF}
        className="flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium shadow-sm text-xs transition-colors flex-shrink-0"
      >
        <FileText size={12} className="sm:w-3.5 sm:h-3.5 shrink-0" />
        <span className="hidden xl:inline">Export Complete Ledger PDF</span>
        <span className="xl:hidden hidden md:inline">Ledger PDF</span>
        <span className="md:hidden hidden sm:inline">PDF</span>
        <span className="sm:hidden">P</span>
      </button>
    </div>
  );
}
