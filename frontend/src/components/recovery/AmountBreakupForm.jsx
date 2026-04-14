import { Input } from "../forms/FormComponents";

/** Remaining demand for a line (unpaid preferred, else total). */
function scalarDemandCap(summary) {
  if (!summary) return 0;
  const unpaidRaw = summary.unpaid;
  if (unpaidRaw !== undefined && unpaidRaw !== null && unpaidRaw !== "") {
    return Math.max(0, Math.round(parseFloat(unpaidRaw) || 0));
  }
  return Math.max(0, Math.round(parseFloat(summary.total) || 0));
}

/** Non-zero value in the form breakup (saved recovery row may have amounts while demand summary is already 0). */
function hasBreakupAmount(amountBreakup, key) {
  const v = amountBreakup?.[key];
  if (v === undefined || v === null || v === "") return false;
  return (parseFloat(v) || 0) !== 0;
}

export default function AmountBreakupForm({
  amountBreakup,
  totalAmount,
  currentMemberSummary,
  currentMember,
  memberLoanTotals,
  onTotalAmountChange,
  onAmountChange,
  onAmountBreakupChange,
  recoveryEditMode = false,
}) {
  const hb = (key) => hasBreakupAmount(amountBreakup, key);

  return (
    <div className="mb-4 sm:mb-6">
      <label className="block text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
        Enter Amount
      </label>
      <div className="space-y-3 sm:space-y-4">
        {/* Total amount: manual reference only; recovery is saved from the fields below */}
        <div className="bg-slate-50 p-3 sm:p-4 rounded-lg border border-slate-200">
          <Input
            label="Total Amount (optional reference)"
            name="totalAmount"
            type="number"
            value={totalAmount}
            handleChange={(e) => onTotalAmountChange(e.target.value)}
            placeholder="Enter total if you use it as reference"
            step="1"
            min="0"
          />
          <p className="text-xs text-slate-600 mt-2">
            Enter each category below manually. Total is not auto-filled from the fields and does not distribute into them.
          </p>
        </div>

        {/* Individual amount fields — manual entry */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {(((parseFloat(currentMemberSummary?.saving?.total ?? 0) || 0) > 0) || hb("saving") || recoveryEditMode) && (
            <Input
              label="Saving"
              name="saving"
              type="number"
              value={amountBreakup.saving}
              handleChange={(e) => onAmountChange("saving", e.target.value)}
              placeholder="Enter saving amount"
              step="1"
            />
          )}
          {(() => {
            const loanTotal = parseFloat(currentMemberSummary?.loan?.total ?? 0) || 0;
            const loanUnpaid = parseFloat(currentMemberSummary?.loan?.unpaid ?? 0) || 0;
            const loanCurr = parseFloat(currentMemberSummary?.loan?.curr ?? 0) || 0;
            const currentLoanTotals = currentMember ? memberLoanTotals[currentMember.id] : null;
            const remainingLoanAmount = currentLoanTotals?.remainingLoanAmount ?? 0;
            const hasLoanDemand =
              loanTotal > 0 || loanUnpaid > 0 || loanCurr > 0 || remainingLoanAmount > 0;
            const showLoan = hasLoanDemand || hb("loan") || recoveryEditMode;
            if (!showLoan) return null;
            const fillRemainingValue = remainingLoanAmount;
            return (
              <div className="relative">
                <Input
                  label="Loan"
                  name="loan"
                  type="number"
                  value={amountBreakup.loan}
                  handleChange={(e) => onAmountChange("loan", e.target.value)}
                  placeholder="Enter loan payment"
                  step="1"
                  max={remainingLoanAmount > 0 ? remainingLoanAmount : undefined}
                />
                {remainingLoanAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const remainingLoanValue = Math.round(fillRemainingValue);
                      onAmountChange("loan", remainingLoanValue.toString());
                    }}
                    className="absolute right-2 top-9 sm:top-10 px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors"
                    title={`Fill up to remaining loan: ₹${Math.round(remainingLoanAmount).toLocaleString()}`}
                  >
                    Fill Remaining
                  </button>
                )}
              </div>
            );
          })()}
          {(((parseFloat(currentMemberSummary?.interest?.total ?? 0) || 0) > 0) ||
            (parseFloat(currentMemberSummary?.interest?.unpaid ?? 0) || 0) > 0 ||
            hb("interest") ||
            recoveryEditMode) && (
            <Input
              label="Interest on Loan"
              name="interest"
              type="number"
              value={amountBreakup.interest}
              handleChange={(e) => onAmountChange("interest", e.target.value)}
              placeholder="Enter interest payment"
              step="1"
              max={
                scalarDemandCap(currentMemberSummary?.interest) > 0
                  ? scalarDemandCap(currentMemberSummary?.interest)
                  : undefined
              }
            />
          )}
          {(() => {
            const fdCap = scalarDemandCap(currentMemberSummary?.fd);
            const showFd =
              fdCap > 0 ||
              hb("fd") ||
              recoveryEditMode ||
              (parseFloat(currentMemberSummary?.fd?.total ?? 0) || 0) > 0 ||
              (parseFloat(currentMemberSummary?.fd?.unpaid ?? 0) || 0) > 0;
            if (!showFd) return null;
            return (
              <Input
                label="FD"
                name="fd"
                type="number"
                value={amountBreakup.fd}
                handleChange={(e) => onAmountChange("fd", e.target.value)}
                placeholder="Enter FD deposit"
                step="1"
                min="0"
                max={fdCap > 0 ? fdCap : undefined}
              />
            );
          })()}
          {(((parseFloat(currentMemberSummary?.yogdan?.total ?? 0) || 0) > 0 ||
            (parseFloat(currentMemberSummary?.yogdan?.unpaid ?? 0) || 0) > 0) ||
            hb("yogdan") ||
            recoveryEditMode) && (
            <Input
              label="Yogdan (when loan is given)"
              name="yogdan"
              type="number"
              value={amountBreakup.yogdan}
              handleChange={(e) => onAmountChange("yogdan", e.target.value)}
              placeholder="Enter yogdan amount"
              step="1"
            />
          )}
          {((parseFloat(currentMemberSummary?.memFeesSHG?.total ?? 0) || 0) > 0 ||
            (parseFloat(currentMemberSummary?.memFeesSHG?.unpaid ?? 0) || 0) > 0 ||
            (parseFloat(currentMemberSummary?.memFeesSHG?.curr ?? 0) || 0) > 0 ||
            hb("memFeesSHG") ||
            recoveryEditMode) && (
            <Input
              label="Member Fees SHG (Yearly)"
              name="memFeesSHG"
              type="number"
              value={amountBreakup.memFeesSHG}
              handleChange={(e) => onAmountChange("memFeesSHG", e.target.value)}
              placeholder="Enter SHG fees"
              step="1"
              max={
                scalarDemandCap(currentMemberSummary?.memFeesSHG) > 0
                  ? scalarDemandCap(currentMemberSummary?.memFeesSHG)
                  : undefined
              }
            />
          )}
          {(((parseFloat(currentMemberSummary?.memFeesSamiti?.total ?? 0) || 0) > 0) ||
            hb("memFeesSamiti") ||
            recoveryEditMode) && (
            <Input
              label="Member Fees Samiti (Yearly)"
              name="memFeesSamiti"
              type="number"
              value={amountBreakup.memFeesSamiti}
              handleChange={(e) => onAmountChange("memFeesSamiti", e.target.value)}
              placeholder="Enter Samiti fees"
              step="1"
            />
          )}
          {((parseFloat(currentMemberSummary?.memFeesGroup?.total ?? 0) || 0) > 0 ||
            (parseFloat(currentMemberSummary?.memFeesGroup?.unpaid ?? 0) || 0) > 0 ||
            (parseFloat(currentMemberSummary?.memFeesGroup?.curr ?? 0) || 0) > 0 ||
            hb("memFeesGroup") ||
            recoveryEditMode) && (
            <Input
              label="Membership Group (Yearly)"
              name="memFeesGroup"
              type="number"
              value={amountBreakup.memFeesGroup}
              handleChange={(e) => onAmountChange("memFeesGroup", e.target.value)}
              placeholder="Enter Membership Group fees"
              step="1"
              max={
                scalarDemandCap(currentMemberSummary?.memFeesGroup) > 0
                  ? scalarDemandCap(currentMemberSummary?.memFeesGroup)
                  : undefined
              }
            />
          )}
          {(((parseFloat(currentMemberSummary?.penalty?.total ?? 0) || 0) > 0) || hb("penalty") || recoveryEditMode) && (
            <Input
              label="Penalty (optional)"
              name="penalty"
              type="number"
              value={amountBreakup.penalty}
              handleChange={(e) => onAmountChange("penalty", e.target.value)}
              placeholder="Enter penalty amount if applicable"
              step="1"
              min="0"
            />
          )}
          {(((parseFloat(currentMemberSummary?.other?.total ?? 0) || 0) > 0) || hb("other") || recoveryEditMode) && (
            <Input
              label="Other"
              name="other"
              type="number"
              value={amountBreakup.other}
              handleChange={(e) => onAmountChange("other", e.target.value)}
              placeholder="Enter other amount"
              step="1"
            />
          )}
          {/* Dynamic Charges - show only when charge due > 0 */}
          {currentMemberSummary?.charges?.chargesDue &&
            Object.keys(currentMemberSummary.charges.chargesDue).length > 0 && (
              <>
                {Object.keys(currentMemberSummary.charges.chargesDue).map((chargeName) => {
                  const chargeDue = parseFloat(currentMemberSummary.charges.chargesDue[chargeName] ?? 0) || 0;
                  if (chargeDue <= 0) return null;
                  return (
                    <Input
                      key={chargeName}
                      label={`${chargeName} (Due: ₹${chargeDue})`}
                      name={`charge-${chargeName}`}
                      type="number"
                      value={amountBreakup.charges?.[chargeName] || ""}
                      handleChange={(e) => {
                        onAmountBreakupChange({
                          ...amountBreakup,
                          charges: {
                            ...amountBreakup.charges,
                            [chargeName]: e.target.value,
                          },
                        });
                      }}
                      placeholder={`Enter ${chargeName} amount`}
                      step="1"
                    />
                  );
                })}
              </>
            )}
        </div>
      </div>
    </div>
  );
}
