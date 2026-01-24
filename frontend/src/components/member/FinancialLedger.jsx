import { Calendar } from "lucide-react";
import { formatDate, formatCurrency } from "../../utils/memberUtils";

export default function FinancialLedger({
  ledgerData,
  filteredLedger,
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  ledgerLoading,
  ledgerError,
  formatDate: formatDateFn = formatDate,
  formatCurrency: formatCurrencyFn = formatCurrency,
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 md:p-6 w-full box-border overflow-x-hidden">
      <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 mb-2 sm:mb-3 md:mb-4 break-words">Financial Ledger</h2>

      {/* Date Filter - Moved to top */}
      <div className="bg-gray-50 rounded-lg p-3 sm:p-4 md:p-5 mb-3 sm:mb-4 md:mb-6 border border-gray-200">
        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-800 mb-2 sm:mb-3 md:mb-4 flex flex-wrap items-center gap-2">
          <Calendar size={16} className="sm:w-4 sm:h-4 md:w-5 md:h-5 shrink-0" />
          <span className="break-words">Date Range Filter</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-6 max-w-full">
          <div>
            <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-2">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => onFromDateChange(e.target.value)}
              className="w-full px-3 py-2 md:py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
            {fromDate && (
              <p className="text-xs text-gray-500 mt-1">Selected: {formatDateFn(fromDate)}</p>
            )}
          </div>
          <div>
            <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-2">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => onToDateChange(e.target.value)}
              className="w-full px-3 py-2 md:py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
            {toDate && (
              <p className="text-xs text-gray-500 mt-1">Selected: {formatDateFn(toDate)}</p>
            )}
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button
              onClick={() => {
                onFromDateChange("");
                onToDateChange("");
              }}
              className="px-4 md:px-6 py-2 md:py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium text-sm w-full sm:w-auto"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {ledgerError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 sm:p-3 md:p-4 mb-2 sm:mb-3 md:mb-4">
          <p className="text-xs sm:text-sm md:text-base text-red-700 font-semibold">Error loading ledger</p>
          <p className="text-xs text-red-600 mt-1">{ledgerError}</p>
        </div>
      )}
      {ledgerLoading && (
        <div className="text-center p-3 sm:p-4 md:p-6 text-xs sm:text-sm md:text-base text-gray-600">
          Loading financial ledger...
        </div>
      )}
      {!ledgerLoading && !ledgerError && (
        <>
          {/* Mobile: Show simplified view or scrollable message */}
          <div className="block sm:hidden mb-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <p className="text-sm text-blue-800 font-semibold mb-2">Financial Ledger</p>
              <p className="text-xs text-blue-700 mb-3">
                This table contains {filteredLedger.length} record{filteredLedger.length !== 1 ? 's' : ''}.
                Please use desktop view or scroll horizontally to view the complete ledger.
              </p>
              <p className="text-xs text-blue-600">
                Swipe left/right on the table below to see all columns.
              </p>
            </div>
          </div>

          <div className="financial-ledger-table w-full overflow-x-auto sm:overflow-x-auto overflow-y-auto sm:overflow-y-visible max-h-[500px] sm:max-h-none rounded-lg border bg-white">
            <table className="min-w-[1400px] w-full border-collapse text-xs md:text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th rowSpan={2} className="border border-gray-300 p-2 md:p-3 text-left font-semibold">
                    Date
                  </th>
                  <th rowSpan={2} className="border border-gray-300 p-2 md:p-3 text-left font-semibold">
                    Receipt
                  </th>
                  <th colSpan={3} className="border border-gray-300 p-2 md:p-3 text-center font-semibold">
                    Monthly Savings
                  </th>
                  <th colSpan={3} className="border border-gray-300 p-2 md:p-3 text-center font-semibold">
                    General Loan
                  </th>
                  <th colSpan={3} className="border border-gray-300 p-2 md:p-3 text-center font-semibold">
                    FD
                  </th>
                  <th colSpan={2} className="border border-gray-300 p-2 md:p-3 text-center font-semibold">
                    Interest
                  </th>
                  <th colSpan={2} className="border border-gray-300 p-2 md:p-3 text-center font-semibold">
                    Yogdan
                  </th>
                  <th className="border border-gray-300 p-2 md:p-3 text-center font-semibold">
                    Charges
                  </th>
                </tr>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 p-1 md:p-2 text-center font-medium text-xs">Deposit</th>
                  <th className="border border-gray-300 p-1 md:p-2 text-center font-medium text-xs">Withdraw</th>
                  <th className="border border-gray-300 p-1 md:p-2 text-center font-medium text-xs">Balance</th>
                  <th className="border border-gray-300 p-1 md:p-2 text-center font-medium text-xs">Paid</th>
                  <th className="border border-gray-300 p-1 md:p-2 text-center font-medium text-xs">Recovered</th>
                  <th className="border border-gray-300 p-2 text-center font-medium">Balance</th>
                  <th className="border border-gray-300 p-2 text-center font-medium">Deposit</th>
                  <th className="border border-gray-300 p-2 text-center font-medium">Withdraw</th>
                  <th className="border border-gray-300 p-2 text-center font-medium">Balance</th>
                  <th className="border border-gray-300 p-2 text-center font-medium">Due</th>
                  <th className="border border-gray-300 p-2 text-center font-medium">Paid</th>
                  <th className="border border-gray-300 p-2 text-center font-medium">Due</th>
                  <th className="border border-gray-300 p-2 text-center font-medium">Paid</th>
                  <th className="border border-gray-300 p-2 text-center font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan={17} className="text-center p-6 text-gray-500">
                      No records found for the selected date range
                    </td>
                  </tr>
                ) : (
                  filteredLedger.map((row, i) => {
                    // Calculate total charges amount
                    const chargesTotal = row.charges ?
                      Object.values(row.charges).reduce((sum, amount) => sum + (parseFloat(amount) || 0), 0) : 0;
                    // Format charges details for display
                    const chargesDetails = row.charges && Object.keys(row.charges).length > 0
                      ? Object.entries(row.charges)
                        .filter(([_, amount]) => parseFloat(amount) > 0)
                        .map(([name, amount]) => `${name}: ₹${parseFloat(amount).toLocaleString()}`)
                        .join(", ")
                      : "—";

                    // Format all numeric values properly
                    const formattedSavingsDeposit = formatCurrencyFn(row.savingsDeposit);
                    const formattedSavingsWithdraw = formatCurrencyFn(row.savingsWithdraw);
                    const formattedSavingsBalance = formatCurrencyFn(row.savingsBalance);
                    const formattedLoanPaid = formatCurrencyFn(row.loanPaid);
                    const formattedLoanRecovered = formatCurrencyFn(row.loanRecovered);
                    const formattedLoanBalance = formatCurrencyFn(row.loanBalance);
                    const formattedFdDeposit = formatCurrencyFn(row.fdDeposit);
                    const formattedFdWithdraw = formatCurrencyFn(row.fdWithdraw);
                    const formattedFdBalance = formatCurrencyFn(row.fdBalance);

                    // For recovery entries, show remaining due (due - paid) instead of total due before payment
                    // For other entries, show the due amount as is
                    let displayInterestDue = row.interestDue || 0;
                    let displayYogdanDue = row.yogdanDue || 0;
                    if (row.receipt === "Recovery") {
                      // Calculate remaining due after payment
                      displayInterestDue = Math.max(0, (row.interestDue || 0) - (row.interestPaid || 0));
                      displayYogdanDue = Math.max(0, (row.yogdanDue || 0) - (row.yogdanPaid || 0));
                    }

                    const formattedInterestDue = formatCurrencyFn(displayInterestDue);
                    const formattedInterestPaid = formatCurrencyFn(row.interestPaid);
                    const formattedYogdanDue = formatCurrencyFn(displayYogdanDue);
                    const formattedYogdanPaid = formatCurrencyFn(row.yogdanPaid);

                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-2 md:p-3">{formatDateFn(row.date)}</td>
                        <td className="border border-gray-300 p-2 md:p-3">{row.receipt}</td>
                        <td className="border border-gray-300 p-2 md:p-3 text-right">
                          {formattedSavingsDeposit > 0 ? `₹${formattedSavingsDeposit.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : "—"}
                        </td>
                        <td className="border border-gray-300 p-2 md:p-3 text-right">
                          {formattedSavingsWithdraw > 0 ? `₹${formattedSavingsWithdraw.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : "—"}
                        </td>
                        <td className="border border-gray-300 p-2 md:p-3 text-right font-semibold">
                          {formattedSavingsBalance > 0 ? `₹${formattedSavingsBalance.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : "—"}
                        </td>
                        <td className="border border-gray-300 p-2 md:p-3 text-right">
                          {formattedLoanPaid > 0 ? `₹${formattedLoanPaid.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : "—"}
                        </td>
                        <td className="border border-gray-300 p-2 md:p-3 text-right">
                          {formattedLoanRecovered > 0 ? `₹${formattedLoanRecovered.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : "—"}
                        </td>
                        <td className="border border-gray-300 p-2 md:p-3 text-right font-semibold">
                          {formattedLoanBalance > 0 ? `₹${formattedLoanBalance.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : "—"}
                        </td>
                        <td className="border border-gray-300 p-2 md:p-3 text-right">
                          {formattedFdDeposit > 0 ? `₹${formattedFdDeposit.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : "—"}
                        </td>
                        <td className="border border-gray-300 p-2 md:p-3 text-right">
                          {formattedFdWithdraw > 0 ? `₹${formattedFdWithdraw.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : "—"}
                        </td>
                        <td className="border border-gray-300 p-2 md:p-3 text-right font-semibold">
                          {formattedFdBalance > 0 ? `₹${formattedFdBalance.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : "—"}
                        </td>
                        <td className="border border-gray-300 p-2 md:p-3 text-right">
                          {formattedInterestDue > 0
                            ? `₹${formattedInterestDue.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                            : (row.receipt === "Recovery" ? "₹0" : "—")}
                        </td>
                        <td className="border border-gray-300 p-2 md:p-3 text-right">
                          {formattedInterestPaid > 0
                            ? `₹${formattedInterestPaid.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                            : (row.receipt === "Recovery" ? "₹0" : "—")}
                        </td>
                        <td className="border border-gray-300 p-2 md:p-3 text-right">
                          {formattedYogdanDue > 0
                            ? `₹${formattedYogdanDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : (row.receipt === "Recovery" ? "₹0.00" : "—")}
                        </td>
                        <td className="border border-gray-300 p-2 md:p-3 text-right">
                          {formattedYogdanPaid > 0
                            ? `₹${formattedYogdanPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : (row.receipt === "Recovery" ? "₹0.00" : "—")}
                        </td>
                        <td className="border border-gray-300 p-2 md:p-3 text-right break-words" title={chargesDetails}>
                          {chargesTotal > 0 ? `₹${chargesTotal.toLocaleString()}` : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {filteredLedger.length > 0 && (
            <div className="mt-3 md:mt-4 text-xs md:text-sm text-gray-600">
              Showing {filteredLedger.length} record(s)
              {fromDate || toDate
                ? ` (Filtered from ${fromDate ? formatDateFn(fromDate) : "beginning"} to ${toDate ? formatDateFn(toDate) : "end"
                })`
                : " (All records)"}
            </div>
          )}
        </>
      )}
    </div>
  );
}
