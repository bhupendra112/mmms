import { useState } from "react";
import { CheckCircle, Download, FileText, Printer, X } from "lucide-react";

/**
 * Shown after successful "Finalize & Save All" — export/print only.
 */
export default function PostFinalizeRecoveryModal({
  open,
  message,
  groupLabel,
  dateLabel,
  onExportExcel,
  onExportPDF,
  onPrintPDF,
  onDone,
}) {
  const [printBusy, setPrintBusy] = useState(false);

  if (!open) return null;

  const handlePrint = async () => {
    if (!onPrintPDF) return;
    try {
      setPrintBusy(true);
      await onPrintPDF();
    } finally {
      setPrintBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-finalize-title"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-200 overflow-hidden">
        <button
          type="button"
          onClick={onDone}
          className="absolute top-3 right-3 p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="p-5 sm:p-6 pt-12 sm:pt-6">
          <div className="flex items-start gap-3 mb-4">
            <CheckCircle className="text-green-600 shrink-0 w-8 h-8 mt-0.5" />
            <div>
              <h2 id="post-finalize-title" className="text-lg sm:text-xl font-bold text-gray-900">
                Recovery saved
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                {groupLabel}
                {dateLabel ? ` · ${dateLabel}` : ""}
              </p>
              {message ? (
                <p className="text-sm text-gray-800 mt-3 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                  {message}
                </p>
              ) : null}
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Export or print the recovery sheet for your records.
          </p>

          <div className="flex flex-col gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onExportExcel}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-green-600 text-white font-medium text-sm hover:bg-green-700 transition-colors"
            >
              <Download size={18} className="shrink-0" />
              Export Excel
            </button>
            <button
              type="button"
              onClick={onExportPDF}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-red-600 text-white font-medium text-sm hover:bg-red-700 transition-colors"
            >
              <FileText size={18} className="shrink-0" />
              Export PDF
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={printBusy || !onPrintPDF}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-slate-700 text-white font-medium text-sm hover:bg-slate-800 disabled:opacity-60 transition-colors"
            >
              <Printer size={18} className="shrink-0" />
              {printBusy ? "Preparing…" : "Print"}
            </button>
            <button
              type="button"
              onClick={onDone}
              className="mt-1 w-full px-4 py-3 rounded-xl border-2 border-gray-300 text-gray-800 font-semibold text-sm hover:bg-gray-50 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
