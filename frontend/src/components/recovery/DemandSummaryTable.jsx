export default function DemandSummaryTable({ currentMember, currentMemberSummary }) {
  if (!currentMemberSummary) {
    return null;
  }

  const fatherOrHusband = (currentMember && (
    (currentMember.raw && (currentMember.raw.F_H_Name || currentMember.raw.F_H_FatherName)) ||
    currentMember.fatherOrHusbandName ||
    ""
  )) || "";
  const fatherOrHusbandDisplay = (typeof fatherOrHusband === "string" ? fatherOrHusband : String(fatherOrHusband || "")).trim();

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
      // Skip non-category keys (e.g. interestDayDetails)
      if (key === "interestDayDetails") return false;
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
      {/* Member basic details – sticky so admin always sees which member they are filling for */}
      {currentMember && (
        <div className="sticky top-20 z-10 mb-3 p-3 rounded-lg border border-gray-200 bg-gray-50 text-sm shadow-sm">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Member basic details</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-gray-800">
            <div>
              <span className="text-gray-500">Name:</span> <span className="font-medium">{currentMember.name || "—"}</span>
            </div>
            <div>
              <span className="text-gray-500">Code:</span> <span className="font-medium">{currentMember.code || "—"}</span>
            </div>
            <div>
              <span className="text-gray-500">Father/Husband:</span> <span className="font-medium">{fatherOrHusbandDisplay || "—"}</span>
            </div>
          </div>
        </div>
      )}
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
                ₹{Math.round(Object.entries(currentMemberSummary).reduce((sum, [k, d]) => {
                  if (k === "interestDayDetails" || !d || Array.isArray(d)) return sum;
                  const val = typeof d.total === 'number' ? d.total : parseFloat(d.total ?? 0) || 0;
                  return sum + val;
                }, 0)).toLocaleString()}
              </td>
              <td className="border border-gray-200 p-1.5 sm:p-2 text-center text-gray-800">
                ₹{Math.round(Object.entries(currentMemberSummary).reduce((sum, [k, d]) => (k === "interestDayDetails" || !d || Array.isArray(d)) ? sum : sum + (typeof d.actual === "number" ? d.actual : parseFloat(d.actual ?? 0) || 0), 0)).toLocaleString()}
              </td>
              <td className="border border-gray-200 p-1.5 sm:p-2 text-center text-gray-800">
                ₹{Math.round(Object.entries(currentMemberSummary).reduce((sum, [k, d]) => (k === "interestDayDetails" || !d || Array.isArray(d)) ? sum : sum + (typeof d.unpaid === "number" ? d.unpaid : parseFloat(d.unpaid ?? 0) || 0), 0)).toLocaleString()}
              </td>
              <td className="border border-gray-200 p-1.5 sm:p-2 text-center text-gray-800">
                ₹{Math.round(Object.entries(currentMemberSummary).reduce((sum, [k, d]) => (k === "interestDayDetails" || !d || Array.isArray(d)) ? sum : sum + (typeof d.opening === "number" ? d.opening : parseFloat(d.opening ?? 0) || 0), 0)).toLocaleString()}
              </td>
              <td className="border border-gray-200 p-1.5 sm:p-2 text-center text-gray-800">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Interest calculation (days) – debug/detail from backend */}
      {Array.isArray(currentMemberSummary.interestDayDetails) && currentMemberSummary.interestDayDetails.length > 0 && (
        <div className="mt-4 p-3 rounded-lg border border-blue-200 bg-blue-50/50">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Interest calculation (days used)</h4>
          <p className="text-xs text-gray-600 mb-2">Each period shows the start date, end date, number of days, and how interest was calculated.</p>
          <div className="overflow-x-auto">
            <table className="min-w-[400px] w-full border-collapse text-xs">
              <thead>
                <tr className="bg-blue-100/80">
                  <th className="border border-blue-200 p-1.5 text-left font-medium text-gray-700">#</th>
                  <th className="border border-blue-200 p-1.5 text-left font-medium text-gray-700">Start date</th>
                  <th className="border border-blue-200 p-1.5 text-left font-medium text-gray-700">End date</th>
                  <th className="border border-blue-200 p-1.5 text-center font-medium text-gray-700">Days</th>
                  <th className="border border-blue-200 p-1.5 text-right font-medium text-gray-700">Principal</th>
                  <th className="border border-blue-200 p-1.5 text-center font-medium text-gray-700">Rate %</th>
                  <th className="border border-blue-200 p-1.5 text-right font-medium text-gray-700">Interest (₹)</th>
                </tr>
              </thead>
              <tbody>
                {currentMemberSummary.interestDayDetails.map((period, idx) => {
                  const isLabelOnly = period.label && (period.startDate == null && period.endDate == null);
                  const startStr = period.startDate ? new Date(period.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
                  const endStr = period.endDate ? new Date(period.endDate).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
                  return (
                    <tr key={idx} className="hover:bg-blue-50/50">
                      <td className="border border-blue-200 p-1.5 text-gray-800">{idx + 1}</td>
                      <td className="border border-blue-200 p-1.5 text-gray-700" colSpan={isLabelOnly ? 2 : 1}>
                        {isLabelOnly ? period.label : startStr}
                      </td>
                      {!isLabelOnly && <td className="border border-blue-200 p-1.5 text-gray-700">{endStr}</td>}
                      <td className="border border-blue-200 p-1.5 text-center text-gray-700">{isLabelOnly ? "—" : (period.days ?? "—")}</td>
                      <td className="border border-blue-200 p-1.5 text-right text-gray-700">{isLabelOnly ? "—" : `₹${Number(period.principal ?? 0).toLocaleString("en-IN")}`}</td>
                      <td className="border border-blue-200 p-1.5 text-center text-gray-700">{isLabelOnly ? "—" : `${period.rate ?? "—"}%`}</td>
                      <td className="border border-blue-200 p-1.5 text-right font-medium text-gray-800">₹{Math.round(Number(period.interest ?? 0)).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
