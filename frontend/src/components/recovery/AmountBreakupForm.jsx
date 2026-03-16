import { Input } from "../forms/FormComponents";

export default function AmountBreakupForm({
  amountBreakup,
  totalAmount,
  autoCalculated,
  currentMemberSummary,
  currentMember,
  memberLoanTotals,
  onTotalAmountChange,
  onAmountChange,
  onAmountBreakupChange,
  onSetAutoCalculated,
}) {
  return (
    <div className="mb-4 sm:mb-6">
      <label className="block text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
        Enter Amount
      </label>
      <div className="space-y-3 sm:space-y-4">
        {/* Total Amount Input for Auto-calculation */}
        <div className="bg-blue-50 p-3 sm:p-4 rounded-lg border-2 border-blue-200">
          <Input
            label="Total Amount (Auto-calculate)"
            name="totalAmount"
            type="number"
            value={totalAmount}
            handleChange={(e) => onTotalAmountChange(e.target.value)}
            placeholder="Enter total amount to auto-distribute"
            step="1"
            min="0"
          />
          {autoCalculated && (
            <p className="text-xs text-blue-600 mt-2">
              ✓ Amounts auto-calculated. You can edit individual amounts below.
            </p>
          )}
        </div>

        {/* Individual Amount Fields - Only show fields where demand total > 0 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {(parseFloat(currentMemberSummary?.saving?.total ?? 0) || 0) > 0 && (
            <Input
              label="Saving"
              name="saving"
              type="number"
              value={amountBreakup.saving}
              handleChange={(e) => {
                onAmountBreakupChange({ ...amountBreakup, saving: e.target.value });
                onSetAutoCalculated(false);
              }}
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
            const totalNum = parseFloat(totalAmount) || 0;
            // Loan can go up to total amount (so admin can allocate total to loan); cap by remaining loan
            const effectiveLoanMax =
              remainingLoanAmount > 0 && totalNum > 0
                ? Math.min(remainingLoanAmount, totalNum)
                : remainingLoanAmount > 0
                  ? remainingLoanAmount
                  : (currentMemberSummary?.loan?.total || undefined);
            const hasLoanDemand = loanTotal > 0 || loanUnpaid > 0 || loanCurr > 0 || remainingLoanAmount > 0;
            if (!hasLoanDemand) return null;
            const fillRemainingValue =
              totalNum > 0 ? Math.min(remainingLoanAmount, totalNum) : remainingLoanAmount;
            return (
              <div className="relative">
                <Input
                  label="Loan"
                  name="loan"
                  type="number"
                  value={amountBreakup.loan}
                  handleChange={(e) => onAmountChange('loan', e.target.value)}
                  placeholder="Enter loan payment"
                  step="1"
                  max={effectiveLoanMax}
                />
                {remainingLoanAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const remainingLoanValue = Math.round(fillRemainingValue);
                      onAmountChange('loan', remainingLoanValue.toString());
                      onSetAutoCalculated(false);
                    }}
                    className="absolute right-2 top-9 sm:top-10 px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors"
                    title={
                      totalNum > 0
                        ? `Fill loan up to ₹${Math.round(fillRemainingValue).toLocaleString()} (min of remaining loan and total amount)`
                        : `Fill full remaining loan amount: ₹${Math.round(remainingLoanAmount).toLocaleString()} (same as shown in Loan Details)`
                    }
                  >
                    Fill Remaining
                  </button>
                )}
              </div>
            );
          })()}
          {(parseFloat(currentMemberSummary?.interest?.total ?? 0) || 0) > 0 && (
            <Input
              label="Interest on Loan"
              name="interest"
              type="number"
              value={amountBreakup.interest}
              handleChange={(e) => onAmountChange('interest', e.target.value)}
              placeholder="Enter interest payment"
              step="1"
              max={currentMemberSummary?.interest?.total || undefined}
            />
          )}
          {((parseFloat(currentMemberSummary?.yogdan?.total ?? 0) || 0) > 0 || (parseFloat(currentMemberSummary?.yogdan?.unpaid ?? 0) || 0) > 0) && (
            <Input
              label="Yogdan (when loan is given)"
              name="yogdan"
              type="number"
              value={amountBreakup.yogdan}
              handleChange={(e) => onAmountChange('yogdan', e.target.value)}
              placeholder="Enter yogdan amount"
              step="1"
              max={currentMemberSummary?.yogdan?.total || undefined}
            />
          )}
          {((parseFloat(currentMemberSummary?.memFeesSHG?.total ?? 0) || 0) > 0 || (parseFloat(currentMemberSummary?.memFeesSHG?.unpaid ?? 0) || 0) > 0 || (parseFloat(currentMemberSummary?.memFeesSHG?.curr ?? 0) || 0) > 0) && (
            <Input
              label="Member Fees SHG (Yearly)"
              name="memFeesSHG"
              type="number"
              value={amountBreakup.memFeesSHG}
              handleChange={(e) => onAmountChange('memFeesSHG', e.target.value)}
              placeholder="Enter SHG fees"
              step="1"
              max={currentMemberSummary?.memFeesSHG?.total || undefined}
            />
          )}
          {(parseFloat(currentMemberSummary?.memFeesSamiti?.total ?? 0) || 0) > 0 && (
            <Input
              label="Member Fees Samiti (Yearly)"
              name="memFeesSamiti"
              type="number"
              value={amountBreakup.memFeesSamiti}
              handleChange={(e) => onAmountChange('memFeesSamiti', e.target.value)}
              placeholder="Enter Samiti fees"
              step="1"
              max={currentMemberSummary?.memFeesSamiti?.total || undefined}
            />
          )}
          {((parseFloat(currentMemberSummary?.memFeesGroup?.total ?? 0) || 0) > 0 || (parseFloat(currentMemberSummary?.memFeesGroup?.unpaid ?? 0) || 0) > 0 || (parseFloat(currentMemberSummary?.memFeesGroup?.curr ?? 0) || 0) > 0) && (
            <Input
              label="Membership Group (Yearly)"
              name="memFeesGroup"
              type="number"
              value={amountBreakup.memFeesGroup}
              handleChange={(e) => onAmountChange('memFeesGroup', e.target.value)}
              placeholder="Enter Membership Group fees"
              step="1"
              max={currentMemberSummary?.memFeesGroup?.total || undefined}
            />
          )}
          {(parseFloat(currentMemberSummary?.penalty?.total ?? 0) || 0) > 0 && (
            <Input
              label="Penalty (optional)"
              name="penalty"
              type="number"
              value={amountBreakup.penalty}
              handleChange={(e) => onAmountChange('penalty', e.target.value)}
              placeholder="Enter penalty amount if applicable"
              step="1"
              min="0"
              max={currentMemberSummary?.penalty?.total ?? undefined}
            />
          )}
          {(parseFloat(currentMemberSummary?.other?.total ?? 0) || 0) > 0 && (
            <Input
              label="Other"
              name="other"
              type="number"
              value={amountBreakup.other}
              handleChange={(e) => onAmountChange('other', e.target.value)}
              placeholder="Enter other amount"
              step="1"
              max={currentMemberSummary?.other?.total || undefined}
            />
          )}
          {/* Dynamic Charges - show only when charge due > 0 */}
          {currentMemberSummary?.charges?.chargesDue && Object.keys(currentMemberSummary.charges.chargesDue).length > 0 && (
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
                      const numValue = parseFloat(e.target.value) || 0;
                      if (e.target.value === '' || e.target.value === null || e.target.value === undefined) {
                        onAmountBreakupChange({
                          ...amountBreakup,
                          charges: {
                            ...amountBreakup.charges,
                            [chargeName]: e.target.value,
                          },
                        });
                        onSetAutoCalculated(false);
                      } else if (numValue <= chargeDue) {
                        onAmountBreakupChange({
                          ...amountBreakup,
                          charges: {
                            ...amountBreakup.charges,
                            [chargeName]: e.target.value,
                          },
                        });
                        onSetAutoCalculated(false);
                      } else {
                        alert(`Amount cannot exceed the due amount of ₹${chargeDue.toLocaleString()}`);
                        onAmountBreakupChange({
                          ...amountBreakup,
                          charges: {
                            ...amountBreakup.charges,
                            [chargeName]: chargeDue.toString(),
                          },
                        });
                        onSetAutoCalculated(false);
                      }
                    }}
                    placeholder={`Enter ${chargeName} amount`}
                    step="1"
                    max={chargeDue}
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
