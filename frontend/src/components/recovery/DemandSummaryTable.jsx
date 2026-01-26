export default function DemandSummaryTable({ currentMemberSummary }) {
  if (!currentMemberSummary) {
    return null;
  }

  // Map category keys to display names
  const categoryNames = {
    saving: "Saving",
    loan: "Loan",
    interest: "Int on loan",
    yogdan: "Yogdan",
    memFeesSHG: "Mem. Fees SHG (Yearly)",
    memFeesSamiti: "Mem. Fees Samiti (Yearly)",
    memFeesGroup: "Mem. Fees Group (Yearly)",
    penalty: "Penalty",
    other: "Other",
    fd: "FD",
    charges: "Charges",
  };

  const rows = [];
  Object.entries(currentMemberSummary)
    .filter(([key, data]) => {
      // Always show: saving, loan, interest, fd
      if (['saving', 'loan', 'interest', 'fd'].includes(key)) {
        return true;
      }
      // Special handling for charges - show if has charges due
      if (key === "charges" && data.chargesDue && Object.keys(data.chargesDue).length > 0) {
        return true;
      }
      // Special handling for yogdan - show only if unpaid > 0 (not paid yet)
      if (key === "yogdan") {
        const hasYogdanUnpaid = data.unpaid > 0;
        return hasYogdanUnpaid;
      }
      // Special handling for memFeesSHG - show if has any amount due
      if (key === "memFeesSHG") {
        const hasValue = data.prev > 0 || data.curr > 0 || data.total > 0 ||
          data.actual > 0 || data.unpaid > 0 || data.opening > 0 || data.closing > 0;
        return hasValue;
      }
      // Special handling for memFeesGroup - show if has any amount due
      if (key === "memFeesGroup") {
        const hasValue = data.prev > 0 || data.curr > 0 || data.total > 0 ||
          data.actual > 0 || data.unpaid > 0 || data.opening > 0 || data.closing > 0;
        return hasValue;
      }
      // Hide these categories if all values are 0: memFeesSamiti, penalty, other
      const hasValue = data.prev > 0 || data.curr > 0 || data.total > 0 ||
        data.actual > 0 || data.unpaid > 0 || data.opening > 0 || data.closing > 0;
      return hasValue;
    })
    .forEach(([key, data]) => {
      // Special handling for charges - show individual charges
      if (key === "charges" && data.chargesDue && Object.keys(data.chargesDue).length > 0) {
        Object.keys(data.chargesDue).forEach((chargeName) => {
          rows.push(
            <tr key={`charge-${chargeName}`} className="hover:bg-gray-50">
              <td className="border border-gray-200 p-1.5 sm:p-2 font-medium text-gray-800 pl-4 sm:pl-6">{chargeName}</td>
              <td className="border border-gray-200 p-1.5 sm:p-2 text-center text-gray-700">—</td>
              <td className="border border-gray-200 p-1.5 sm:p-2 text-center text-gray-700">{data.chargesDue[chargeName] === 0 ? "—" : `₹${Math.round(data.chargesDue[chargeName]).toLocaleString()}`}</td>
              <td className="border border-gray-200 p-1.5 sm:p-2 text-center text-gray-700">{data.chargesDue[chargeName] === 0 ? "—" : `₹${Math.round(data.chargesDue[chargeName]).toLocaleString()}`}</td>
              <td className="border border-gray-200 p-1.5 sm:p-2 text-center text-gray-700">{(data.actualCharges?.[chargeName] ?? 0) === 0 ? "—" : `₹${Math.round(data.actualCharges[chargeName]).toLocaleString()}`}</td>
              <td className="border border-gray-200 p-1.5 sm:p-2 text-center text-gray-700">{Math.max(0, (data.chargesDue[chargeName] ?? 0) - (data.actualCharges?.[chargeName] ?? 0)) === 0 ? "—" : `₹${Math.round(Math.max(0, (data.chargesDue[chargeName] ?? 0) - (data.actualCharges?.[chargeName] ?? 0))).toLocaleString()}`}</td>
              <td className="border border-gray-200 p-1.5 sm:p-2 text-center text-gray-700">—</td>
              <td className="border border-gray-200 p-1.5 sm:p-2 text-center text-gray-700">—</td>
            </tr>
          );
        });
      } else {
        // Use actualPaid from demandDetails for all categories including yogdan
        // This ensures we show the correct actual paid amount (0) from backend, not the total demand
        const displayValue = data.actual;
        rows.push(
          <tr key={key} className="hover:bg-gray-50">
            <td className="border border-gray-200 p-1.5 sm:p-2 font-medium text-gray-800">{categoryNames[key] || key}</td>
            <td className="border border-gray-200 p-1.5 sm:p-2 text-center text-gray-700">{data.prev === 0 ? "—" : `₹${Math.round(data.prev).toLocaleString()}`}</td>
            <td className="border border-gray-200 p-1.5 sm:p-2 text-center text-gray-700">{data.curr === 0 ? "—" : `₹${Math.round(data.curr).toLocaleString()}`}</td>
            <td className="border border-gray-200 p-1.5 sm:p-2 text-center text-gray-700">{data.total === 0 ? "—" : `₹${Math.round(data.total).toLocaleString()}`}</td>
            <td className="border border-gray-200 p-1.5 sm:p-2 text-center text-gray-700">{displayValue === 0 ? "—" : `₹${Math.round(displayValue).toLocaleString()}`}</td>
            <td className="border border-gray-200 p-1.5 sm:p-2 text-center text-gray-700">{data.unpaid === 0 ? "—" : `₹${Math.round(data.unpaid).toLocaleString()}`}</td>
            <td className="border border-gray-200 p-1.5 sm:p-2 text-center text-gray-700">{data.opening === 0 ? "—" : `₹${Math.round(data.opening).toLocaleString()}`}</td>
            <td className="border border-gray-200 p-1.5 sm:p-2 text-center text-gray-700">{data.closing === 0 ? "—" : `₹${Math.round(data.closing).toLocaleString()}`}</td>
          </tr>
        );
      }
    });

  return (
    <div className="mb-4 sm:mb-6">
      <h4 className="text-sm sm:text-base font-semibold text-gray-700 mb-2 sm:mb-3">Demand Summary</h4>
      <div className="w-full overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-[500px] sm:min-w-[600px] w-full border-collapse border border-gray-200 text-[10px] sm:text-xs md:text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-200 p-1.5 sm:p-2 text-left font-semibold text-gray-700">Category</th>
              <th className="border border-gray-200 p-1.5 sm:p-2 text-center font-semibold text-gray-700">Prev.</th>
              <th className="border border-gray-200 p-1.5 sm:p-2 text-center font-semibold text-gray-700">Curr.</th>
              <th className="border border-gray-200 p-1.5 sm:p-2 text-center font-semibold text-gray-700">Total</th>
              <th className="border border-gray-200 p-1.5 sm:p-2 text-center font-semibold text-gray-700">Actual</th>
              <th className="border border-gray-200 p-1.5 sm:p-2 text-center font-semibold text-gray-700">Unpaid</th>
              <th className="border border-gray-200 p-1.5 sm:p-2 text-center font-semibold text-gray-700">Opening</th>
              <th className="border border-gray-200 p-1.5 sm:p-2 text-center font-semibold text-gray-700">Closing</th>
            </tr>
          </thead>
          <tbody>
            {rows}
            <tr className="bg-gray-50 font-semibold">
              <td className="border border-gray-200 p-1.5 sm:p-2 text-gray-800">TOTAL</td>
              <td className="border border-gray-200 p-1.5 sm:p-2 text-center text-gray-800">—</td>
              <td className="border border-gray-200 p-1.5 sm:p-2 text-center text-gray-800">—</td>
              <td className="border border-gray-200 p-1.5 sm:p-2 text-center text-gray-800">
                ₹{Math.round(Object.values(currentMemberSummary).reduce((sum, d) => {
                  const val = typeof d.total === 'number' ? d.total : parseFloat(d.total ?? 0) || 0;
                  return sum + val;
                }, 0)).toLocaleString()}
              </td>
              <td className="border border-gray-200 p-1.5 sm:p-2 text-center text-gray-800">
                ₹{Math.round(Object.values(currentMemberSummary).reduce((sum, d) => sum + d.actual, 0)).toLocaleString()}
              </td>
              <td className="border border-gray-200 p-1.5 sm:p-2 text-center text-gray-800">
                ₹{Math.round(Object.values(currentMemberSummary).reduce((sum, d) => sum + d.unpaid, 0)).toLocaleString()}
              </td>
              <td className="border border-gray-200 p-1.5 sm:p-2 text-center text-gray-800">
                ₹{Math.round(Object.values(currentMemberSummary).reduce((sum, d) => sum + d.opening, 0)).toLocaleString()}
              </td>
              <td className="border border-gray-200 p-1.5 sm:p-2 text-center text-gray-800">—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
