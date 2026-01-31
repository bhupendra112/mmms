import { DollarSign } from "lucide-react";
import { formatDate } from "../../utils/memberUtils";

export default function FinancialSummary({ member, memberDoc, isMobile, windowWidthRef, formatDate: formatDateFn = formatDate }) {
  if (!member) return null;

  // Determine if we should show desktop table
  const currentWidth = windowWidthRef?.current || (typeof window !== 'undefined' ? window.innerWidth : 1280);
  const isCurrentlyMobile = typeof window !== 'undefined' ? window.innerWidth < 640 : currentWidth < 640;
  const shouldShowTable = !isCurrentlyMobile && !isMobile;

  return (
    <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 md:p-6 mb-3 sm:mb-4 md:mb-6 w-full box-border overflow-x-hidden">
      <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 mb-2 sm:mb-3 md:mb-4 break-words flex items-center gap-2">
        <DollarSign size={18} className="sm:w-5 sm:h-5 shrink-0" />
        <span>Financial Summary</span>
      </h2>

      {/* Mobile Card View */}
      <div className={`block sm:hidden ${shouldShowTable ? 'hidden' : ''}`}>
        <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
          <div className="space-y-2">
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
              <span className="text-xs font-semibold text-gray-700">Opening Balance:</span>
              <span className="text-xs text-gray-800">₹{(member?.openingBalance || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
              <span className="text-xs font-semibold text-gray-700">Savings Total:</span>
              <span className="text-xs text-gray-800">₹{(member?.savingsTotal || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
              <span className="text-xs font-semibold text-gray-700">Loan Outstanding:</span>
              <span className="text-xs text-gray-800">₹{(member?.loanOutstanding || 0).toLocaleString()}</span>
            </div>
            {member?.loanDate && (
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
                <span className="text-xs font-semibold text-gray-700">Loan Date:</span>
                <span className="text-xs text-gray-800">{formatDateFn(member.loanDate)}</span>
              </div>
            )}
            {(member?.loanOverdueInterest || 0) > 0 && (
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
                <span className="text-xs font-semibold text-gray-700">Overdue Interest:</span>
                <span className="text-xs text-gray-800">₹{(member?.loanOverdueInterest || 0).toLocaleString()}</span>
              </div>
            )}
            {memberDoc?.loanDetails?.time_period && (
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
                <span className="text-xs font-semibold text-gray-700">Loan Time Period:</span>
                <span className="text-xs text-gray-800 break-words">
                  {memberDoc.loanDetails.time_period / 12} {memberDoc.loanDetails.time_period / 12 === 1 ? 'year' : 'years'} ({memberDoc.loanDetails.time_period} months)
                </span>
              </div>
            )}
            {memberDoc?.loanDetails?.installment_amount && (
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
                <span className="text-xs font-semibold text-gray-700">Monthly Installment:</span>
                <span className="text-xs text-gray-800">₹{parseFloat(memberDoc.loanDetails.installment_amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
              <span className="text-xs font-semibold text-gray-700">FD Total:</span>
              <span className="text-xs text-gray-800">₹{(member?.fdTotal || 0).toLocaleString()}</span>
            </div>
            {member?.fdDate && (
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
                <span className="text-xs font-semibold text-gray-700">FD Date:</span>
                <span className="text-xs text-gray-800">{formatDateFn(member.fdDate)}</span>
              </div>
            )}
            {member?.fdMaturityDate && (
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
                <span className="text-xs font-semibold text-gray-700">FD Maturity Date:</span>
                <span className="text-xs text-gray-800">{formatDateFn(member.fdMaturityDate)}</span>
              </div>
            )}
            {(member?.fdInterest || 0) > 0 && (
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
                <span className="text-xs font-semibold text-gray-700">FD Interest:</span>
                <span className="text-xs text-gray-800">₹{(member?.fdInterest || 0).toLocaleString()}</span>
              </div>
            )}
            {(member?.openingYogdan || 0) > 0 && (
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
                <span className="text-xs font-semibold text-gray-700">Opening Yogdan:</span>
                <span className="text-xs text-gray-800">₹{(member?.openingYogdan || 0).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
              <span className="text-xs font-semibold text-gray-700">Interest Pending:</span>
              <span className="text-xs text-gray-800">₹{(member?.interestPending || 0).toLocaleString()}</span>
            </div>
            {(member?.penaltyPaid || 0) > 0 && (
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
                <span className="text-xs font-semibold text-gray-700">Penalty Paid:</span>
                <span className="text-xs text-gray-800">₹{(member?.penaltyPaid || 0).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-gray-700">Last Recovery:</span>
              <span className="text-xs text-gray-800">{formatDateFn(member?.lastRecoveryDate) || "N/A"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Table View */}
      {shouldShowTable && (
        <div className="finance-summary-table w-full overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-[400px] w-full border-collapse text-xs md:text-sm">
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="p-2 md:p-3 font-semibold text-gray-700 bg-gray-50 w-1/3">Opening Balance:</td>
                <td className="p-2 md:p-3 text-gray-800">₹{(member?.openingBalance || 0).toLocaleString()}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-2 md:p-3 font-semibold text-gray-700 bg-gray-50">Savings Total:</td>
                <td className="p-2 md:p-3 text-gray-800">₹{(member?.savingsTotal || 0).toLocaleString()}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-2 md:p-3 font-semibold text-gray-700 bg-gray-50">Loan Outstanding:</td>
                <td className="p-2 md:p-3 text-gray-800">₹{(member?.loanOutstanding || 0).toLocaleString()}</td>
              </tr>
              {member?.loanDate && (
                <tr className="border-b border-gray-200">
                  <td className="p-2 md:p-3 font-semibold text-gray-700 bg-gray-50">Loan Date:</td>
                  <td className="p-2 md:p-3 text-gray-800">{formatDateFn(member.loanDate)}</td>
                </tr>
              )}
              {(member?.loanOverdueInterest || 0) > 0 && (
                <tr className="border-b border-gray-200">
                  <td className="p-2 md:p-3 font-semibold text-gray-700 bg-gray-50">Overdue Interest:</td>
                  <td className="p-2 md:p-3 text-gray-800">₹{(member?.loanOverdueInterest || 0).toLocaleString()}</td>
                </tr>
              )}
              {memberDoc?.loanDetails?.time_period && (
                <tr className="border-b border-gray-200">
                  <td className="p-2 md:p-3 font-semibold text-gray-700 bg-gray-50">Loan Time Period:</td>
                  <td className="p-2 md:p-3 text-gray-800 break-words">
                    {memberDoc.loanDetails.time_period / 12} {memberDoc.loanDetails.time_period / 12 === 1 ? 'year' : 'years'} ({memberDoc.loanDetails.time_period} months)
                  </td>
                </tr>
              )}
              {memberDoc?.loanDetails?.installment_amount && (
                <tr className="border-b border-gray-200">
                  <td className="p-2 md:p-3 font-semibold text-gray-700 bg-gray-50">Monthly Installment:</td>
                  <td className="p-2 md:p-3 text-gray-800">₹{parseFloat(memberDoc.loanDetails.installment_amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              )}
              <tr className="border-b border-gray-200">
                <td className="p-2 md:p-3 font-semibold text-gray-700 bg-gray-50">FD Total:</td>
                <td className="p-2 md:p-3 text-gray-800">₹{(member?.fdTotal || 0).toLocaleString()}</td>
              </tr>
              {member?.fdDate && (
                <tr className="border-b border-gray-200">
                  <td className="p-2 md:p-3 font-semibold text-gray-700 bg-gray-50">FD Date:</td>
                  <td className="p-2 md:p-3 text-gray-800">{formatDateFn(member.fdDate)}</td>
                </tr>
              )}
              {member?.fdMaturityDate && (
                <tr className="border-b border-gray-200">
                  <td className="p-2 md:p-3 font-semibold text-gray-700 bg-gray-50">FD Maturity Date:</td>
                  <td className="p-2 md:p-3 text-gray-800">{formatDateFn(member.fdMaturityDate)}</td>
                </tr>
              )}
              {(member?.fdInterest || 0) > 0 && (
                <tr className="border-b border-gray-200">
                  <td className="p-2 md:p-3 font-semibold text-gray-700 bg-gray-50">FD Interest:</td>
                  <td className="p-2 md:p-3 text-gray-800">₹{(member?.fdInterest || 0).toLocaleString()}</td>
                </tr>
              )}
              {(member?.openingYogdan || 0) > 0 && (
                <tr className="border-b border-gray-200">
                  <td className="p-2 md:p-3 font-semibold text-gray-700 bg-gray-50">Opening Yogdan:</td>
                  <td className="p-2 md:p-3 text-gray-800">₹{(member?.openingYogdan || 0).toLocaleString()}</td>
                </tr>
              )}
              <tr className="border-b border-gray-200">
                <td className="p-2 md:p-3 font-semibold text-gray-700 bg-gray-50">Interest Pending:</td>
                <td className="p-2 md:p-3 text-gray-800">₹{(member?.interestPending || 0).toLocaleString()}</td>
              </tr>
              {(member?.penaltyPaid || 0) > 0 && (
                <tr className="border-b border-gray-200">
                  <td className="p-2 md:p-3 font-semibold text-gray-700 bg-gray-50">Penalty Paid:</td>
                  <td className="p-2 md:p-3 text-gray-800">₹{(member?.penaltyPaid || 0).toLocaleString()}</td>
                </tr>
              )}
              <tr>
                <td className="p-2 md:p-3 font-semibold text-gray-700 bg-gray-50">Last Recovery:</td>
                <td className="p-2 md:p-3 text-gray-800">{formatDateFn(member?.lastRecoveryDate) || "N/A"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
