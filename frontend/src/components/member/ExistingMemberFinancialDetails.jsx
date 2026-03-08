import { formatDate } from "../../utils/memberUtils";

export default function ExistingMemberFinancialDetails({ member, memberDoc, isMobile, windowWidthRef, formatDate: formatDateFn = formatDate }) {
  if (!member?.isExistingMember) return null;

  // Determine if we should show desktop table
  const currentWidth = windowWidthRef?.current || (typeof window !== 'undefined' ? window.innerWidth : 1280);
  const isCurrentlyMobile = typeof window !== 'undefined' ? window.innerWidth < 640 : currentWidth < 640;
  const shouldShowTable = !isCurrentlyMobile && !isMobile;

  return (
    <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg shadow-sm p-2 sm:p-3 md:p-4 lg:p-6 mb-2 sm:mb-3 md:mb-4 w-full min-w-0 box-border overflow-x-hidden">
      <h2 className="text-sm sm:text-base md:text-lg font-semibold text-gray-800 mb-2 sm:mb-3 break-words">Existing Member Financial Details</h2>

      {/* Mobile Card View */}
      <div className={`block sm:hidden ${shouldShowTable ? 'hidden' : ''} space-y-2 mb-4`}>
        <div className="bg-white border rounded-lg p-3">
          <div className="flex justify-between items-center mb-2 pb-2 border-b border-blue-200">
            <span className="text-xs font-semibold text-gray-700">Opening Saving:</span>
            <span className="text-xs text-gray-800">₹{member.openingBalance.toLocaleString()}</span>
          </div>
          {member.fdTotal > 0 && (
            <>
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-blue-200">
                <span className="text-xs font-semibold text-gray-700">FD Amount:</span>
                <span className="text-xs text-gray-800">₹{member.fdTotal.toLocaleString()}</span>
              </div>
              {member.fdDate && (
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-blue-200">
                  <span className="text-xs font-semibold text-gray-700">FD Date:</span>
                  <span className="text-xs text-gray-800">{formatDateFn(member.fdDate)}</span>
                </div>
              )}
              {member.fdMaturityDate && (
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-blue-200">
                  <span className="text-xs font-semibold text-gray-700">FD Maturity Date:</span>
                  <span className="text-xs text-gray-800">{formatDateFn(member.fdMaturityDate)}</span>
                </div>
              )}
              {member.fdInterest > 0 && (
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-blue-200">
                  <span className="text-xs font-semibold text-gray-700">FD Interest:</span>
                  <span className="text-xs text-gray-800">₹{member.fdInterest.toLocaleString()}</span>
                </div>
              )}
            </>
          )}
          {member.loanOutstanding > 0 && (
            <>
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-blue-200">
                <span className="text-xs font-semibold text-gray-700">Loan Amount:</span>
                <span className="text-xs text-gray-800">₹{member.loanOutstanding.toLocaleString()}</span>
              </div>
              {member.loanDate && (
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-blue-200">
                  <span className="text-xs font-semibold text-gray-700">Loan Date:</span>
                  <span className="text-xs text-gray-800">{formatDateFn(member.loanDate)}</span>
                </div>
              )}
              {member.loanOverdueInterest > 0 && (
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-blue-200">
                  <span className="text-xs font-semibold text-gray-700">Overdue Interest:</span>
                  <span className="text-xs text-gray-800">₹{member.loanOverdueInterest.toLocaleString()}</span>
                </div>
              )}
              {memberDoc?.loanDetails?.time_period && (
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-blue-200">
                  <span className="text-xs font-semibold text-gray-700">Loan Time Period:</span>
                  <span className="text-xs text-gray-800 break-words">
                    {memberDoc.loanDetails.time_period / 12} {memberDoc.loanDetails.time_period / 12 === 1 ? 'year' : 'years'} ({memberDoc.loanDetails.time_period} months)
                  </span>
                </div>
              )}
              {memberDoc?.loanDetails?.installment_amount && (
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-blue-200">
                  <span className="text-xs font-semibold text-gray-700">Monthly Installment:</span>
                  <span className="text-xs text-gray-800">₹{parseFloat(memberDoc.loanDetails.installment_amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
            </>
          )}
          {member.openingYogdan > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-gray-700">Opening Yogdan:</span>
              <span className="text-xs text-gray-800">₹{member.openingYogdan.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Table View */}
      {shouldShowTable && (
        <div className="existing-member-finance-table w-full min-w-0 overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-[400px] w-full border-collapse text-xs md:text-sm">
            <tbody>
              <tr className="border-b border-blue-200">
                <td className="p-2 md:p-3 font-semibold text-gray-700 bg-blue-100 w-1/3">Opening Saving:</td>
                <td className="p-2 md:p-3 text-gray-800">₹{member.openingBalance.toLocaleString()}</td>
              </tr>
              {member.fdTotal > 0 && (
                <>
                  <tr className="border-b border-blue-200">
                    <td className="p-2 md:p-3 font-semibold text-gray-700 bg-blue-100">FD Amount:</td>
                    <td className="p-2 md:p-3 text-gray-800">₹{member.fdTotal.toLocaleString()}</td>
                  </tr>
                  {member.fdDate && (
                    <tr className="border-b border-blue-200">
                      <td className="p-2 md:p-3 font-semibold text-gray-700 bg-blue-100">FD Date:</td>
                      <td className="p-2 md:p-3 text-gray-800">{formatDateFn(member.fdDate)}</td>
                    </tr>
                  )}
                  {member.fdMaturityDate && (
                    <tr className="border-b border-blue-200">
                      <td className="p-2 md:p-3 font-semibold text-gray-700 bg-blue-100">FD Maturity Date:</td>
                      <td className="p-2 md:p-3 text-gray-800">{formatDateFn(member.fdMaturityDate)}</td>
                    </tr>
                  )}
                  {member.fdInterest > 0 && (
                    <tr className="border-b border-blue-200">
                      <td className="p-2 md:p-3 font-semibold text-gray-700 bg-blue-100">FD Interest:</td>
                      <td className="p-2 md:p-3 text-gray-800">₹{member.fdInterest.toLocaleString()}</td>
                    </tr>
                  )}
                </>
              )}
              {member.loanOutstanding > 0 && (
                <>
                  <tr className="border-b border-blue-200">
                    <td className="p-2 md:p-3 font-semibold text-gray-700 bg-blue-100">Loan Amount:</td>
                    <td className="p-2 md:p-3 text-gray-800">₹{member.loanOutstanding.toLocaleString()}</td>
                  </tr>
                  {member.loanDate && (
                    <tr className="border-b border-blue-200">
                      <td className="p-2 md:p-3 font-semibold text-gray-700 bg-blue-100">Loan Date:</td>
                      <td className="p-2 md:p-3 text-gray-800">{formatDateFn(member.loanDate)}</td>
                    </tr>
                  )}
                  {member.loanOverdueInterest > 0 && (
                    <tr className="border-b border-blue-200">
                      <td className="p-2 md:p-3 font-semibold text-gray-700 bg-blue-100">Overdue Interest:</td>
                      <td className="p-2 md:p-3 text-gray-800">₹{member.loanOverdueInterest.toLocaleString()}</td>
                    </tr>
                  )}
                  {memberDoc?.loanDetails?.time_period && (
                    <tr className="border-b border-blue-200">
                      <td className="p-2 md:p-3 font-semibold text-gray-700 bg-blue-100">Loan Time Period:</td>
                      <td className="p-2 md:p-3 text-gray-800 break-words">
                        {memberDoc.loanDetails.time_period / 12} {memberDoc.loanDetails.time_period / 12 === 1 ? 'year' : 'years'} ({memberDoc.loanDetails.time_period} months)
                      </td>
                    </tr>
                  )}
                  {memberDoc?.loanDetails?.installment_amount && (
                    <tr className="border-b border-blue-200">
                      <td className="p-2 md:p-3 font-semibold text-gray-700 bg-blue-100">Monthly Installment:</td>
                      <td className="p-2 md:p-3 text-gray-800">₹{parseFloat(memberDoc.loanDetails.installment_amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                </>
              )}
              {member.openingYogdan > 0 && (
                <tr className="border-b border-blue-200">
                  <td className="p-2 md:p-3 font-semibold text-gray-700 bg-blue-100">Opening Yogdan:</td>
                  <td className="p-2 md:p-3 text-gray-800">₹{member.openingYogdan.toLocaleString()}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Saving Rate Snapshot Section */}
      {memberDoc?.saving_per_member_snapshot && (
        <div className="mt-4 md:mt-6">
          <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-2 md:mb-3">Saving Rate Snapshot</h3>
          <p className="text-xs md:text-sm text-gray-600 mb-3 md:mb-4">
            This rate is used for saving demand calculations instead of current group rate.
          </p>
          <div className="w-full min-w-0 overflow-x-auto rounded-lg border bg-white">
            <table className="min-w-[400px] w-full border-collapse text-xs md:text-sm">
              <tbody>
                <tr className="border-b border-blue-200">
                  <td className="p-2 md:p-3 font-semibold text-gray-700 bg-blue-100 w-1/3">Saving Per Member Snapshot:</td>
                  <td className="p-2 md:p-3 text-gray-800">₹{memberDoc.saving_per_member_snapshot.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
