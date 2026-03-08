import { FileText } from "lucide-react";
import { formatDate } from "../../utils/memberUtils";

export default function RecoveryDetails({ memberRecoveries, transactionsLoading, isMobile, windowWidthRef, formatDate: formatDateFn = formatDate }) {
  if (memberRecoveries.length === 0) return null;

  // Determine if we should show desktop table
  const currentWidth = windowWidthRef?.current || (typeof window !== 'undefined' ? window.innerWidth : 1280);
  const isCurrentlyMobile = typeof window !== 'undefined' ? window.innerWidth < 640 : currentWidth < 640;
  const shouldShowTable = !isCurrentlyMobile && !isMobile;

  return (
    <div className="bg-white rounded-xl shadow-sm p-2 sm:p-3 md:p-4 lg:p-6 mb-2 sm:mb-3 md:mb-4 w-full min-w-0 box-border overflow-x-hidden">
      <h2 className="text-sm sm:text-base md:text-lg font-semibold text-gray-800 mb-2 sm:mb-3 flex flex-wrap items-center gap-2">
        <FileText size={18} className="sm:w-5 sm:h-5 text-blue-600 shrink-0" />
        <span className="break-words">Recovery Details ({memberRecoveries.length})</span>
      </h2>
      {transactionsLoading ? (
        <p className="text-xs sm:text-sm md:text-base text-gray-600">Loading recoveries...</p>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className={`block sm:hidden ${shouldShowTable ? 'hidden' : ''} space-y-3`}>
            {memberRecoveries.map((recovery, index) => {
              const amounts = recovery.amounts || {};
              const saving = parseFloat(amounts.saving || 0);
              const loan = parseFloat(amounts.loan || 0);
              const fd = parseFloat(amounts.fd || 0);
              const interest = parseFloat(amounts.interest || 0);
              const yogdan = parseFloat(amounts.yogdan || 0);
              const memFeesSHG = parseFloat(amounts.memFeesSHG || 0);
              const memFeesGroup = parseFloat(amounts.memFeesGroup || 0);
              const memFeesSamiti = parseFloat(amounts.memFeesSamiti || 0);
              const other = parseFloat(amounts.other || 0);
              const chargesTotal = amounts.charges ?
                Object.values(amounts.charges).reduce((sum, amount) => sum + (parseFloat(amount) || 0), 0) : 0;
              const total = saving + loan + fd + interest + yogdan + memFeesSHG + memFeesGroup + memFeesSamiti + other + chargesTotal;
              const mode = recovery.paymentMode?.cash && recovery.paymentMode?.online
                ? "Cash & Online"
                : recovery.paymentMode?.cash
                  ? "Cash"
                  : recovery.paymentMode?.online
                    ? "Online"
                    : "N/A";

              return (
                <div key={recovery.recoveryId || index} className="bg-gray-50 border rounded-lg p-3 shadow-sm">
                  <div className="flex justify-between items-start mb-2 pb-2 border-b border-gray-200">
                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-1">
                        {formatDateFn(recovery.recoveryDate || recovery.date)}
                      </p>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${mode === "Cash"
                        ? "bg-green-100 text-green-800"
                        : mode === "Online"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-purple-100 text-purple-800"
                        }`}>
                        {mode}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-700">
                        ₹{total.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">Total</p>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs">
                    {saving > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Savings:</span>
                        <span className="text-gray-800">₹{saving.toLocaleString()}</span>
                      </div>
                    )}
                    {loan > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Loan:</span>
                        <span className="text-gray-800">₹{loan.toLocaleString()}</span>
                      </div>
                    )}
                    {fd > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">FD:</span>
                        <span className="text-gray-800">₹{fd.toLocaleString()}</span>
                      </div>
                    )}
                    {interest > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Interest:</span>
                        <span className="text-gray-800">₹{interest.toLocaleString()}</span>
                      </div>
                    )}
                    {yogdan > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Yogdan:</span>
                        <span className="text-gray-800">₹{yogdan.toLocaleString()}</span>
                      </div>
                    )}
                    {memFeesSHG > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Mem. Fees SHG:</span>
                        <span className="text-gray-800">₹{memFeesSHG.toLocaleString()}</span>
                      </div>
                    )}
                    {memFeesGroup > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Mem. Fees Group:</span>
                        <span className="text-gray-800">₹{memFeesGroup.toLocaleString()}</span>
                      </div>
                    )}
                    {chargesTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Charges:</span>
                        <span className="text-gray-800">₹{chargesTotal.toLocaleString()}</span>
                      </div>
                    )}
                    {other > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Other:</span>
                        <span className="text-gray-800">₹{other.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          {shouldShowTable && (
            <div className="recovery-details-table w-full min-w-0 overflow-x-auto rounded-lg border bg-white">
              <table className="min-w-[1200px] w-full border-collapse text-xs md:text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 p-2 md:p-3 text-left font-semibold">Date</th>
                    <th className="border border-gray-300 p-2 md:p-3 text-right font-semibold">Savings</th>
                    <th className="border border-gray-300 p-2 md:p-3 text-right font-semibold">Loan</th>
                    <th className="border border-gray-300 p-2 md:p-3 text-right font-semibold">FD</th>
                    <th className="border border-gray-300 p-2 md:p-3 text-right font-semibold">Interest</th>
                    <th className="border border-gray-300 p-2 md:p-3 text-right font-semibold">Yogdan</th>
                    <th className="border border-gray-300 p-2 md:p-3 text-right font-semibold">Mem. Fees SHG</th>
                    <th className="border border-gray-300 p-2 md:p-3 text-right font-semibold">Mem. Fees Group</th>
                    <th className="border border-gray-300 p-2 md:p-3 text-right font-semibold">Charges</th>
                    <th className="border border-gray-300 p-2 md:p-3 text-right font-semibold">Other</th>
                    <th className="border border-gray-300 p-2 md:p-3 text-right font-semibold">Total</th>
                    <th className="border border-gray-300 p-2 md:p-3 text-left font-semibold">Payment Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {memberRecoveries.map((recovery, index) => {
                    const amounts = recovery.amounts || {};
                    const saving = parseFloat(amounts.saving || 0);
                    const loan = parseFloat(amounts.loan || 0);
                    const fd = parseFloat(amounts.fd || 0);
                    const interest = parseFloat(amounts.interest || 0);
                    const yogdan = parseFloat(amounts.yogdan || 0);
                    const memFeesSHG = parseFloat(amounts.memFeesSHG || 0);
                    const memFeesGroup = parseFloat(amounts.memFeesGroup || 0);
                    const memFeesSamiti = parseFloat(amounts.memFeesSamiti || 0);
                    const other = parseFloat(amounts.other || 0);
                    const chargesTotal = amounts.charges ?
                      Object.values(amounts.charges).reduce((sum, amount) => sum + (parseFloat(amount) || 0), 0) : 0;
                    const total = saving + loan + fd + interest + yogdan + memFeesSHG + memFeesGroup + memFeesSamiti + other + chargesTotal;
                    const mode = recovery.paymentMode?.cash && recovery.paymentMode?.online
                      ? "Cash & Online"
                      : recovery.paymentMode?.cash
                        ? "Cash"
                        : recovery.paymentMode?.online
                          ? "Online"
                          : "N/A";

                    return (
                      <tr key={recovery.recoveryId || index} className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-2 md:p-3">
                          {formatDateFn(recovery.recoveryDate || recovery.date)}
                        </td>
                        <td className="border border-gray-300 p-2 md:p-3 text-right">₹{saving.toLocaleString()}</td>
                        <td className="border border-gray-300 p-2 md:p-3 text-right">₹{loan.toLocaleString()}</td>
                        <td className="border border-gray-300 p-2 md:p-3 text-right">₹{fd.toLocaleString()}</td>
                        <td className="border border-gray-300 p-2 md:p-3 text-right">₹{interest.toLocaleString()}</td>
                        <td className="border border-gray-300 p-2 md:p-3 text-right">₹{yogdan.toLocaleString()}</td>
                        <td className="border border-gray-300 p-2 md:p-3 text-right">₹{memFeesSHG.toLocaleString()}</td>
                        <td className="border border-gray-300 p-2 md:p-3 text-right">₹{memFeesGroup.toLocaleString()}</td>
                        <td className="border border-gray-300 p-2 md:p-3 text-right" title={
                          amounts.charges && Object.keys(amounts.charges).length > 0
                            ? Object.entries(amounts.charges)
                              .filter(([_, amount]) => parseFloat(amount) > 0)
                              .map(([name, amount]) => `${name}: ₹${parseFloat(amount).toLocaleString()}`)
                              .join(", ")
                            : ""
                        }>
                          ₹{chargesTotal.toLocaleString()}
                        </td>
                        <td className="border border-gray-300 p-2 md:p-3 text-right">₹{other.toLocaleString()}</td>
                        <td className="border border-gray-300 p-2 md:p-3 text-right font-semibold text-green-700">
                          ₹{total.toLocaleString()}
                        </td>
                        <td className="border border-gray-300 p-2 md:p-3">
                          <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${mode === "Cash"
                            ? "bg-green-100 text-green-800"
                            : mode === "Online"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-purple-100 text-purple-800"
                            }`}>
                            {mode}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
