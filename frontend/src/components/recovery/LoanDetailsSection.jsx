import { CreditCard, ArrowRight } from "lucide-react";

export default function LoanDetailsSection({
  currentMember,
  memberLoanTotals,
  loanDetails,
  showLoanBreakdown,
  onToggleBreakdown,
  onFullLoanRecovery,
}) {
  if (!currentMember) return null;

  const currentLoanTotals = memberLoanTotals[currentMember.id];
  const currentLoans = loanDetails[currentMember.id] || [];
  const hasLoanData = currentLoanTotals && (currentLoanTotals.totalLoanAmount ?? 0) > 0;

  if (!hasLoanData) return null;

  const memberId = currentMember.id;
  const isBreakdownVisible = showLoanBreakdown[memberId] || false;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 sm:p-5 md:p-6 mb-4 sm:mb-6 border border-blue-200 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 mb-3 sm:mb-4">
        <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2">
          <CreditCard size={20} className="text-blue-600 shrink-0 w-5 h-5" />
          Loan Details
        </h3>
        {currentLoans.length > 0 && (
          <button
            onClick={() => onToggleBreakdown(memberId)}
            className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors self-start sm:self-auto"
          >
            {isBreakdownVisible ? 'Hide' : 'Show'} Breakdown
            <ArrowRight size={16} className={`shrink-0 transition-transform ${isBreakdownVisible ? 'rotate-90' : ''}`} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-3 sm:mb-4">
        <div className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 shadow-sm">
          <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Loan Amount</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-800">
            ₹{Math.round(currentLoanTotals.totalLoanAmount ?? 0).toLocaleString()}
          </p>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
            From LoanMaster (all approved loans)
          </p>
        </div>
        <div className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 shadow-sm">
          <p className="text-xs sm:text-sm text-gray-600 mb-1">Recovered Amount</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600">
            ₹{Math.round(currentLoanTotals.totalLoanRecovered ?? 0).toLocaleString()}
          </p>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
            From RecoveryMaster (all recoveries)
          </p>
        </div>
        <div className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 shadow-sm sm:col-span-2 md:col-span-1">
          <p className="text-xs sm:text-sm text-gray-600 mb-1">Remaining Amount</p>
          <p className="text-xl sm:text-2xl font-bold text-red-600">
            ₹{Math.round(currentLoanTotals.remainingLoanAmount ?? 0).toLocaleString()}
          </p>
        </div>
      </div>
      {isBreakdownVisible && currentLoans.length > 0 && (
        <div className="mt-3 sm:mt-4 bg-white rounded-lg p-3 sm:p-4 border border-gray-200">
          <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">Individual Loan Breakdown</h4>
          <div className="w-full overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-[520px] sm:min-w-[600px] w-full text-[10px] sm:text-xs md:text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left p-1.5 sm:p-2 font-semibold text-gray-700">Date</th>
                  <th className="text-right p-1.5 sm:p-2 font-semibold text-gray-700">Amount</th>
                  <th className="text-right p-1.5 sm:p-2 font-semibold text-gray-700">Installment</th>
                  <th className="text-right p-1.5 sm:p-2 font-semibold text-gray-700">Period</th>
                  <th className="text-right p-1.5 sm:p-2 font-semibold text-gray-700">Rate</th>
                  <th className="text-left p-1.5 sm:p-2 font-semibold text-gray-700">Purpose</th>
                </tr>
              </thead>
              <tbody>
                {currentLoans.map((loan, idx) => (
                  <tr key={loan.id || idx} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="p-1.5 sm:p-2 text-gray-700">
                      {loan.date ? new Date(loan.date).toLocaleDateString('en-GB') : '—'}
                    </td>
                    <td className="p-1.5 sm:p-2 text-right font-medium text-gray-800">
                      ₹{Math.round(loan.amount ?? 0).toLocaleString()}
                    </td>
                    <td className="p-1.5 sm:p-2 text-right text-gray-700">
                      {loan.installment_amount ? `₹${Math.round(loan.installment_amount).toLocaleString()}/mo` : '—'}
                    </td>
                    <td className="p-1.5 sm:p-2 text-right text-gray-700">
                      {loan.time_period ? `${loan.time_period} mo` : '—'}
                    </td>
                    <td className="p-1.5 sm:p-2 text-right text-gray-700">
                      {loan.loan_rate ? `${loan.loan_rate}%` : '—'}
                    </td>
                    <td className="p-1.5 sm:p-2 text-gray-700 truncate max-w-[80px] sm:max-w-none">
                      {loan.purpose || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
