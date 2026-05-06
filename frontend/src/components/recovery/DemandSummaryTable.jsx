import { useMemo } from "react";

function parseAmt(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function formatYmdIso(ymd) {
  if (!ymd || typeof ymd !== "string") return "—";
  const p = ymd.split("-");
  if (p.length !== 3) return ymd;
  const [y, m, d] = p;
  return `${d}/${m}/${y}`;
}

function formatInr(n) {
  const v = Math.round(Number(n) || 0);
  return `₹${v.toLocaleString("en-IN")}`;
}

/**
 * In recovery edit mode, demand API rows can be all zeros after payment; merge form/saved amounts
 * so the table matches what we show during normal demand entry.
 */
function mergeSavedAmountsIntoDemandSummary(base, saved) {
  if (!base || !saved) return base;
  const out = JSON.parse(JSON.stringify(base));

  const applyScalar = (key) => {
    const amt = parseAmt(saved[key]);
    if (amt <= 0) return;
    if (!out[key]) out[key] = { prev: 0, curr: 0, total: 0, actual: 0, unpaid: 0, opening: 0, closing: 0 };
    out[key].actual = amt;
    if (!(out[key].total > 0) && !(out[key].curr > 0)) {
      out[key].total = Math.max(out[key].total || 0, amt);
    }
  };

  ["saving", "loan", "interest", "yogdan", "memFeesSHG", "memFeesSamiti", "memFeesGroup", "penalty", "fd"].forEach(applyScalar);

  const otherAmt = parseAmt(saved.other);
  if (otherAmt > 0) {
    if (!out.other) out.other = { prev: 0, curr: 0, total: 0, actual: 0, unpaid: 0, opening: 0, closing: 0 };
    out.other.actual = otherAmt;
    out.other.total = Math.max(out.other.total || 0, otherAmt);
  }

  if (saved.charges && typeof saved.charges === "object") {
    if (!out.charges) {
      out.charges = {
        prev: 0,
        curr: 0,
        total: 0,
        actual: 0,
        unpaid: 0,
        opening: 0,
        closing: 0,
        chargesDue: {},
        actualCharges: {},
      };
    }
    if (!out.charges.chargesDue) out.charges.chargesDue = {};
    if (!out.charges.actualCharges) out.charges.actualCharges = {};
    let chargeSum = 0;
    Object.entries(saved.charges).forEach(([name, val]) => {
      const a = parseAmt(val);
      if (a <= 0) return;
      chargeSum += a;
      if (!out.charges.chargesDue[name] || out.charges.chargesDue[name] === 0) {
        out.charges.chargesDue[name] = a;
      }
      out.charges.actualCharges[name] = a;
    });
    if (chargeSum > 0) {
      out.charges.actual = chargeSum;
      out.charges.total = Math.max(out.charges.total || 0, chargeSum);
    }
  }

  return out;
}

export default function DemandSummaryTable({
  currentMember,
  currentMemberSummary,
  recoveryEditMode = false,
  savedAmounts = null,
}) {
  const summary = useMemo(() => {
    if (!currentMemberSummary) return null;
    if (recoveryEditMode && savedAmounts) {
      return mergeSavedAmountsIntoDemandSummary(currentMemberSummary, savedAmounts);
    }
    return currentMemberSummary;
  }, [currentMemberSummary, recoveryEditMode, savedAmounts]);

  if (!summary) {
    return null;
  }

  const meetingAccrualByLoanRows = Array.isArray(summary?.interestSchedule?.meetingAccrualByLoan)
    ? summary.interestSchedule.meetingAccrualByLoan
    : [];
  const shouldShowInterestSchedule = !!(summary?.interestSchedule?.summary && meetingAccrualByLoanRows.length > 0);

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
  Object.entries(summary)
    .filter(([key, data]) => {
      // Skip non-category keys (e.g. interestDayDetails, interestSchedule)
      if (key === "interestDayDetails" || key === "interestSchedule") return false;
      // Always show: saving, loan, interest, fd
      if (['saving', 'loan', 'interest', 'fd'].includes(key)) {
        return true;
      }
      // Special handling for charges - show if has charges due (includes merged edit-mode rows)
      if (key === "charges" && data.chargesDue && Object.keys(data.chargesDue).length > 0) {
        return true;
      }
      // Yogdan: same rule as other categories (do not hide when unpaid is 0 but actual/total > 0)
      if (key === "yogdan") {
        const hasValue = data.prev > 0 || data.curr > 0 || data.total > 0 ||
          data.actual > 0 || data.unpaid > 0 || data.opening > 0 || data.closing > 0;
        return hasValue;
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
            <div className="hidden sm:block">
              <span className="text-gray-500">Code:</span> <span className="font-medium">{currentMember.code || "—"}</span>
            </div>
            <div>
              <span className="text-gray-500">Father/Husband:</span> <span className="font-medium">{fatherOrHusbandDisplay || "—"}</span>
            </div>
          </div>
        </div>
      )}
      <div className="mb-2 sm:mb-3">
        <h4 className="text-sm sm:text-base font-semibold text-gray-700">Demand Summary</h4>
        {recoveryEditMode && (
          <p className="text-xs text-amber-900/90 mt-1.5 rounded-md border border-amber-200 bg-amber-50/80 px-2.5 py-2">
            Edit mode: table uses your <strong>saved recovery amounts</strong> merged with demand so all categories stay visible, same as during entry.
          </p>
        )}
      </div>
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
                ₹{Math.round(Object.entries(summary).reduce((sum, [k, d]) => {
                  if (k === "interestDayDetails" || k === "interestSchedule" || !d || Array.isArray(d)) return sum;
                  const val = typeof d.total === 'number' ? d.total : parseFloat(d.total ?? 0) || 0;
                  return sum + val;
                }, 0)).toLocaleString()}
              </td>
              <td className="border border-gray-200 p-1.5 sm:p-2 text-center text-gray-800">
                ₹{Math.round(Object.entries(summary).reduce((sum, [k, d]) => (k === "interestDayDetails" || k === "interestSchedule" || !d || Array.isArray(d)) ? sum : sum + (typeof d.actual === "number" ? d.actual : parseFloat(d.actual ?? 0) || 0), 0)).toLocaleString()}
              </td>
              <td className="border border-gray-200 p-1.5 sm:p-2 text-center text-gray-800">
                ₹{Math.round(Object.entries(summary).reduce((sum, [k, d]) => (k === "interestDayDetails" || k === "interestSchedule" || !d || Array.isArray(d)) ? sum : sum + (typeof d.unpaid === "number" ? d.unpaid : parseFloat(d.unpaid ?? 0) || 0), 0)).toLocaleString()}
              </td>
              <td className="border border-gray-200 p-1.5 sm:p-2 text-center text-gray-800">
                ₹{Math.round(Object.entries(summary).reduce((sum, [k, d]) => (k === "interestDayDetails" || k === "interestSchedule" || !d || Array.isArray(d)) ? sum : sum + (typeof d.opening === "number" ? d.opening : parseFloat(d.opening ?? 0) || 0), 0)).toLocaleString()}
              </td>
              <td className="border border-gray-200 p-1.5 sm:p-2 text-center text-gray-800">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Interest breakdown: overdue + meeting accrual by loan (from demandDetails.interestSchedule) */}
      {shouldShowInterestSchedule && (
        <div className="mt-4 p-3 sm:p-4 rounded-lg border border-slate-200 bg-slate-50/80 shadow-sm">
          <h4 className="text-sm sm:text-base font-semibold text-gray-800 mb-1">Interest on loan — calculation</h4>
          <p className="text-[11px] sm:text-xs text-gray-600 mb-3 leading-relaxed">
            {summary.interestSchedule.formula}
          </p>
          <p className="text-xs text-gray-700 mb-2">
            <span className="font-medium text-gray-600">Meeting:</span>{" "}
            {formatYmdIso(summary.interestSchedule.meetingDateYmd)}
            {summary.interestSchedule.meetingSequence != null && (
              <span className="text-gray-500"> (sequence {summary.interestSchedule.meetingSequence})</span>
            )}
          </p>

          <div className="overflow-x-auto mb-4">
            <table className="min-w-[320px] w-full border-collapse text-[11px] sm:text-xs">
              <caption className="sr-only">How overdue and meeting accrual build interest demand</caption>
              <thead>
                <tr className="bg-slate-200/90">
                  <th className="border border-slate-300 p-1.5 sm:p-2 text-left font-semibold text-gray-800">Component</th>
                  <th className="border border-slate-300 p-1.5 sm:p-2 text-right font-semibold text-gray-800">Amount</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                <tr className="hover:bg-slate-50/80">
                  <td className="border border-slate-200 p-1.5 sm:p-2 text-gray-700">Previous unpaid (carried)</td>
                  <td className="border border-slate-200 p-1.5 sm:p-2 text-right text-gray-900 tabular-nums">{formatInr(summary.interestSchedule.summary.interestPrevDemand)}</td>
                </tr>
                <tr className="hover:bg-slate-50/80">
                  <td className="border border-slate-200 p-1.5 sm:p-2 text-gray-700">Overdue on member record</td>
                  <td className="border border-slate-200 p-1.5 sm:p-2 text-right text-gray-900 tabular-nums">{formatInr(summary.interestSchedule.summary.overdueStoredOnMember)}</td>
                </tr>
                <tr className="hover:bg-slate-50/80">
                  <td className="border border-slate-200 p-1.5 sm:p-2 text-gray-700">Interest already recovered before this meeting</td>
                  <td className="border border-slate-200 p-1.5 sm:p-2 text-right text-gray-900 tabular-nums">{formatInr(summary.interestSchedule.summary.interestPaidBeforeThisMeeting)}</td>
                </tr>
                <tr className="hover:bg-slate-50/80">
                  <td className="border border-slate-200 p-1.5 sm:p-2 text-gray-700 font-medium">Overdue still in current demand</td>
                  <td className="border border-slate-200 p-1.5 sm:p-2 text-right font-medium text-gray-900 tabular-nums">{formatInr(summary.interestSchedule.summary.remainingOverdueInCurr)}</td>
                </tr>
                <tr className="hover:bg-slate-50/80">
                  <td className="border border-slate-200 p-1.5 sm:p-2 text-gray-700 font-medium">This meeting accrual (all loans)</td>
                  <td className="border border-slate-200 p-1.5 sm:p-2 text-right font-medium text-gray-900 tabular-nums">{formatInr(summary.interestSchedule.summary.meetingPeriodInterest)}</td>
                </tr>
                <tr className="bg-slate-100/90 font-semibold">
                  <td className="border border-slate-300 p-1.5 sm:p-2 text-gray-900">Current demand (overdue remaining + accrual)</td>
                  <td className="border border-slate-300 p-1.5 sm:p-2 text-right text-gray-900 tabular-nums">{formatInr(summary.interestSchedule.summary.interestCurrDemand)}</td>
                </tr>
                <tr className="bg-slate-100/90 font-semibold">
                  <td className="border border-slate-300 p-1.5 sm:p-2 text-gray-900">Total demand (Prev + Curr)</td>
                  <td className="border border-slate-300 p-1.5 sm:p-2 text-right text-gray-900 tabular-nums">{formatInr(summary.interestSchedule.summary.interestTotalDemand)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h5 className="text-xs sm:text-sm font-semibold text-gray-800 mb-1">Meeting accrual by loan</h5>
          <p className="text-[11px] text-gray-600 mb-2 max-w-3xl">
            <span className="font-medium text-gray-700">Loan date</span> is disbursement on file. <span className="font-medium text-gray-700">Accrual from → to</span> is only this meeting’s window (not from loan date to meeting in one step). Loans with no days in this window are omitted.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full border-collapse text-[11px] sm:text-xs">
              <thead>
                <tr className="bg-emerald-100/80">
                  <th className="border border-emerald-200/90 p-1.5 sm:p-2 text-left font-semibold text-gray-800">#</th>
                  <th className="border border-emerald-200/90 p-1.5 sm:p-2 text-left font-semibold text-gray-800">Loan date</th>
                  <th className="border border-emerald-200/90 p-1.5 sm:p-2 text-left font-semibold text-gray-800 min-w-[120px]">Purpose</th>
                  <th className="border border-emerald-200/90 p-1.5 sm:p-2 text-left font-semibold text-gray-800">Accrual from</th>
                  <th className="border border-emerald-200/90 p-1.5 sm:p-2 text-left font-semibold text-gray-800">Accrual to</th>
                  <th className="border border-emerald-200/90 p-1.5 sm:p-2 text-center font-semibold text-gray-800">Days</th>
                  <th className="border border-emerald-200/90 p-1.5 sm:p-2 text-right font-semibold text-gray-800">Principal</th>
                  <th className="border border-emerald-200/90 p-1.5 sm:p-2 text-center font-semibold text-gray-800">Rate %</th>
                  <th className="border border-emerald-200/90 p-1.5 sm:p-2 text-right font-semibold text-gray-800">Interest</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {meetingAccrualByLoanRows.map((row) => (
                  <tr key={`${row.loanId}-${row.rowIndex}`} className="hover:bg-emerald-50/40">
                    <td className="border border-emerald-100 p-1.5 sm:p-2 text-gray-800">{row.rowIndex}</td>
                    <td className="border border-emerald-100 p-1.5 sm:p-2 text-gray-700 whitespace-nowrap">{formatYmdIso(row.loanDateYmd)}</td>
                    <td className="border border-emerald-100 p-1.5 sm:p-2 text-gray-700 max-w-[200px] truncate" title={row.purpose || ""}>{row.purpose || "—"}</td>
                    <td className="border border-emerald-100 p-1.5 sm:p-2 text-gray-700 whitespace-nowrap">{formatYmdIso(row.accrualFromYmd || row.startDateYmd)}</td>
                    <td className="border border-emerald-100 p-1.5 sm:p-2 text-gray-700 whitespace-nowrap">{formatYmdIso(row.accrualToYmd || row.endDateYmd)}</td>
                    <td className="border border-emerald-100 p-1.5 sm:p-2 text-center text-gray-800 tabular-nums">{row.days ?? "—"}</td>
                    <td className="border border-emerald-100 p-1.5 sm:p-2 text-right text-gray-800 tabular-nums">{formatInr(row.principal)}</td>
                    <td className="border border-emerald-100 p-1.5 sm:p-2 text-center text-gray-800">{row.ratePercent ?? "—"}%</td>
                    <td className="border border-emerald-100 p-1.5 sm:p-2 text-right font-medium text-gray-900 tabular-nums">{formatInr(row.interest)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detailed day ledger (optional, when backend sent _debugInterestDays) */}
      {Array.isArray(summary.interestDayDetails) && summary.interestDayDetails.length > 0 && (
        <div className="mt-4 p-3 rounded-lg border border-blue-200 bg-blue-50/50">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Interest — day-detail trace</h4>
          <p className="text-xs text-gray-600 mb-2">Fine-grained periods from the engine (same formula as above).</p>
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
                {summary.interestDayDetails.map((period, idx) => {
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
                      <td className="border border-blue-200 p-1.5 text-right font-medium text-gray-800">₹{Math.round(Number(period.interest ?? 0)).toLocaleString("en-IN")}</td>
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
