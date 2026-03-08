import { formatDate } from "../../utils/memberUtils";

export default function MembershipFeesSummary({ memberRecoveries, memberDoc, isMobile, windowWidthRef, formatDate: formatDateFn = formatDate }) {
  // Calculate totals for membership fees
  const totalMemFeesGroup = memberRecoveries.reduce((sum, recovery) => {
    return sum + (parseFloat(recovery.amounts?.memFeesGroup || 0) || 0);
  }, 0);
  const totalMemFeesSHG = memberRecoveries.reduce((sum, recovery) => {
    return sum + (parseFloat(recovery.amounts?.memFeesSHG || 0) || 0);
  }, 0);
  const totalMemFeesSamiti = memberRecoveries.reduce((sum, recovery) => {
    return sum + (parseFloat(recovery.amounts?.memFeesSamiti || 0) || 0);
  }, 0);

  // Get last payment dates from member document
  const lastMemFeesSHGDate = memberDoc?.lastMembershipPaidDate;
  const lastMemFeesGroupDate = memberDoc?.lastMembershipGroupPaidDate;

  // Helper function to check if paid for current April-to-April cycle
  const getCurrentCycleStart = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11, where 0 is January
    // If current month is before April (month 3), cycle started last year
    if (currentMonth < 3) {
      return new Date(currentYear - 1, 3, 1); // April 1 of previous year
    }
    return new Date(currentYear, 3, 1); // April 1 of current year
  };

  const currentCycleStart = getCurrentCycleStart();
  const isMemFeesSHGPaid = lastMemFeesSHGDate && new Date(lastMemFeesSHGDate) >= currentCycleStart;
  const isMemFeesGroupPaid = lastMemFeesGroupDate && new Date(lastMemFeesGroupDate) >= currentCycleStart;

  // Determine if we should show desktop table
  const currentWidth = windowWidthRef?.current || (typeof window !== 'undefined' ? window.innerWidth : 1280);
  const isCurrentlyMobile = typeof window !== 'undefined' ? window.innerWidth < 640 : currentWidth < 640;
  const shouldShowTable = !isCurrentlyMobile && !isMobile;

  return (
    <div className="bg-white rounded-xl shadow-sm p-2 sm:p-3 md:p-4 lg:p-6 mb-2 sm:mb-3 md:mb-4 w-full min-w-0 box-border overflow-x-hidden">
      <h2 className="text-sm sm:text-base md:text-lg font-semibold text-gray-800 mb-2 sm:mb-3 break-words">Membership Fees Summary</h2>

      {/* Mobile Card View */}
      <div className={`block sm:hidden ${shouldShowTable ? 'hidden' : ''}`}>
        <div className="space-y-3">
          <div className="bg-gray-50 border rounded-lg p-3">
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
              <span className="text-xs font-semibold text-gray-700">Mem. Fees SHG (Yearly):</span>
              <span className="text-xs text-gray-800">₹{totalMemFeesSHG.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
              <span className="text-xs font-semibold text-gray-700">Payment Status:</span>
              <span className={`px-2 py-1 rounded text-xs font-semibold ${isMemFeesSHGPaid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                {isMemFeesSHGPaid ? "Paid" : "Not Paid"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-gray-700">Last Payment:</span>
              <span className="text-xs text-gray-800">{lastMemFeesSHGDate ? formatDateFn(lastMemFeesSHGDate) : "Never"}</span>
            </div>
          </div>

          <div className="bg-gray-50 border rounded-lg p-3">
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
              <span className="text-xs font-semibold text-gray-700">Mem. Fees Group:</span>
              <span className="text-xs text-gray-800">₹{totalMemFeesGroup.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
              <span className="text-xs font-semibold text-gray-700">Payment Status:</span>
              <span className={`px-2 py-1 rounded text-xs font-semibold ${isMemFeesGroupPaid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                {isMemFeesGroupPaid ? "Paid" : "Not Paid"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-gray-700">Last Payment:</span>
              <span className="text-xs text-gray-800">{lastMemFeesGroupDate ? formatDateFn(lastMemFeesGroupDate) : "Never"}</span>
            </div>
          </div>

          {totalMemFeesSamiti > 0 && (
            <div className="bg-gray-50 border rounded-lg p-3">
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
                <span className="text-xs font-semibold text-gray-700">Mem. Fees Samiti (Yearly):</span>
                <span className="text-xs text-gray-800">₹{totalMemFeesSamiti.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
                <span className="text-xs font-semibold text-gray-700">Payment Status:</span>
                <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">Paid</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-gray-700">Last Payment:</span>
                <span className="text-xs text-gray-800">—</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Table View */}
      {shouldShowTable && (
        <div className="membership-fees-table w-full min-w-0 overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-[500px] w-full border-collapse text-xs md:text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 md:p-3 text-left font-semibold text-gray-700 border-b border-gray-200">Fee Type</th>
                <th className="p-2 md:p-3 text-right font-semibold text-gray-700 border-b border-gray-200">Total Paid</th>
                <th className="p-2 md:p-3 text-left font-semibold text-gray-700 border-b border-gray-200">Payment Status</th>
                <th className="p-2 md:p-3 text-left font-semibold text-gray-700 border-b border-gray-200">Last Payment Date</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="p-2 md:p-3 font-semibold text-gray-700 bg-gray-50">Mem. Fees SHG (Yearly)</td>
                <td className="p-2 md:p-3 text-gray-800 text-right">₹{totalMemFeesSHG.toLocaleString()}</td>
                <td className="p-2 md:p-3">
                  <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${isMemFeesSHGPaid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {isMemFeesSHGPaid ? "Paid" : "Not Paid"}
                  </span>
                </td>
                <td className="p-2 md:p-3 text-gray-800">{lastMemFeesSHGDate ? formatDateFn(lastMemFeesSHGDate) : "Never"}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-2 md:p-3 font-semibold text-gray-700 bg-gray-50">Mem. Fees Group</td>
                <td className="p-2 md:p-3 text-gray-800 text-right">₹{totalMemFeesGroup.toLocaleString()}</td>
                <td className="p-2 md:p-3">
                  <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${isMemFeesGroupPaid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {isMemFeesGroupPaid ? "Paid" : "Not Paid"}
                  </span>
                </td>
                <td className="p-2 md:p-3 text-gray-800">{lastMemFeesGroupDate ? formatDateFn(lastMemFeesGroupDate) : "Never"}</td>
              </tr>
              {totalMemFeesSamiti > 0 && (
                <tr className="border-b border-gray-200">
                  <td className="p-2 md:p-3 font-semibold text-gray-700 bg-gray-50">Mem. Fees Samiti (Yearly)</td>
                  <td className="p-2 md:p-3 text-gray-800 text-right">₹{totalMemFeesSamiti.toLocaleString()}</td>
                  <td className="p-2 md:p-3">
                    <span className="px-2 py-1 rounded text-xs font-semibold whitespace-nowrap bg-blue-100 text-blue-800">
                      Paid
                    </span>
                  </td>
                  <td className="p-2 md:p-3 text-gray-800">—</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
