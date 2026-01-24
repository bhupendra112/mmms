import { X, CreditCard, Wallet, Upload, Check } from "lucide-react";
import { Input, Select } from "../forms/FormComponents";

export default function FullLoanRecoveryModal({
  show,
  currentMember,
  loanTotals,
  loadingLoanTotals,
  loading,
  fullLoanRecoveryPaymentMode,
  fullLoanRecoveryBankId,
  fullLoanRecoveryOnlineRef,
  fullLoanRecoveryScreenshot,
  groupBanks,
  onClose,
  onPaymentModeChange,
  onBankIdChange,
  onOnlineRefChange,
  onFileUpload,
  onSubmit,
}) {
  if (!show || !currentMember) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white rounded-lg md:rounded-xl shadow-xl w-full h-[100dvh] md:h-auto md:max-w-2xl md:max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 md:p-6 flex items-center justify-between z-10">
          <h2 className="text-lg md:text-2xl font-bold text-gray-800 flex items-center gap-2">
            <CreditCard size={20} className="text-blue-600 shrink-0" />
            <span className="truncate">Full Loan Recovery</span>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
          {/* Member Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 md:p-4">
            <p className="text-base md:text-lg font-semibold text-gray-800 break-words">
              {currentMember.name} ({currentMember.code})
            </p>
          </div>

          {/* Loan Details Summary */}
          <div className="bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200 rounded-lg p-4 md:p-6">
            <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4 flex items-center gap-2">
              <CreditCard size={18} className="text-blue-600 shrink-0" />
              <span>Loan Details</span>
            </h3>
            {loadingLoanTotals ? (
              <div className="text-center py-4">
                <p className="text-sm md:text-base text-gray-600">Loading loan totals...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                  <p className="text-sm text-gray-600 mb-1">Total Loan Amount</p>
                  <p className="text-2xl font-bold text-gray-800">
                    ₹{Math.round(loanTotals.totalLoanAmount ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    From LoanMaster (all approved loans)
                  </p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                  <p className="text-sm text-gray-600 mb-1">Recovered Amount</p>
                  <p className="text-2xl font-bold text-green-600">
                    ₹{Math.round(loanTotals.totalLoanRecovered ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">From RecoveryMaster (all recoveries)</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                  <p className="text-sm text-gray-600 mb-1">Remaining Amount</p>
                  <p className="text-2xl font-bold text-red-600">
                    ₹{Math.round(loanTotals.remainingLoanAmount ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Full remaining loan (not just installment)</p>
                </div>
              </div>
            )}
          </div>

          {/* Payment Mode */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Payment Mode *
            </label>
            <div className="flex gap-4 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="fullLoanRecoveryPaymentMode"
                  checked={fullLoanRecoveryPaymentMode.cash}
                  onChange={() => onPaymentModeChange("cash")}
                  className="w-5 h-5 text-blue-600"
                />
                <Wallet size={20} className="text-gray-600" />
                <span className="font-medium text-gray-700">Cash</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="fullLoanRecoveryPaymentMode"
                  checked={fullLoanRecoveryPaymentMode.online}
                  onChange={() => onPaymentModeChange("online")}
                  className="w-5 h-5 text-blue-600"
                />
                <CreditCard size={20} className="text-gray-600" />
                <span className="font-medium text-gray-700">Online</span>
              </label>
            </div>

            {fullLoanRecoveryPaymentMode.online && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
                <Select
                  label="Select Bank *"
                  name="fullLoanRecoveryBankId"
                  value={fullLoanRecoveryBankId}
                  handleChange={(e) => onBankIdChange(e.target.value)}
                  options={groupBanks.length > 0
                    ? groupBanks.map((bank) => {
                      const balance = bank.available_balance !== undefined
                        ? bank.available_balance
                        : (bank.current_balance !== undefined
                          ? bank.current_balance
                          : (bank.opening_balance || 0));
                      const balanceFormatted = `₹${balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                      return {
                        value: bank._id || bank.id,
                        label: `${bank.bank_name} - ${bank.account_no}${bank.short_name ? ` (${bank.short_name})` : ""} [Available: ${balanceFormatted}]`
                      };
                    })
                    : [{ value: "", label: "No banks available" }]
                  }
                  required
                />
                {groupBanks.length === 0 && (
                  <p className="text-sm text-red-600 mt-1">
                    No banks found for this group. Please add a bank account first.
                  </p>
                )}
                <Input
                  label="Reference Number / Transaction ID *"
                  name="fullLoanRecoveryOnlineRef"
                  value={fullLoanRecoveryOnlineRef}
                  handleChange={(e) => onOnlineRefChange(e.target.value)}
                  placeholder="Enter reference number"
                  required
                />
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Screenshot (Optional)
                  </label>
                  <label className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                    <Upload size={20} className="text-gray-600" />
                    <span className="text-sm text-gray-700">Choose File</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={onFileUpload}
                      className="hidden"
                    />
                  </label>
                  {fullLoanRecoveryScreenshot && (
                    <img src={fullLoanRecoveryScreenshot} alt="Screenshot" className="mt-2 max-w-xs rounded-lg" />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 sm:px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors text-sm sm:text-base"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              disabled={loading || loanTotals.remainingLoanAmount <= 0}
              className="w-full sm:w-auto px-4 sm:px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors text-sm sm:text-base"
            >
              {loading ? (
                <span>Processing...</span>
              ) : (
                <>
                  <Check size={18} className="shrink-0" />
                  <span className="truncate">Recover Full Loan (₹{Math.round(loanTotals.remainingLoanAmount ?? 0).toLocaleString()})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
