import { Upload } from "lucide-react";
import { Input, Select } from "../forms/FormComponents";

export default function PaymentModeSection({
  paymentMode,
  selectedBankId,
  onlineRef,
  screenshot,
  groupBanks,
  onPaymentModeChange,
  onBankIdChange,
  onOnlineRefChange,
  onFileUpload,
}) {
  return (
    <div className="mb-4 sm:mb-6">
      <label className="block text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
        Payment Mode *
      </label>
      <div className="flex flex-wrap gap-3 sm:gap-4 mb-3 sm:mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="paymentMode"
            checked={paymentMode.cash}
            onChange={() => onPaymentModeChange("cash")}
            className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600"
          />
          <span className="font-medium text-gray-700 text-sm sm:text-base">Cash</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="paymentMode"
            checked={paymentMode.online}
            onChange={() => onPaymentModeChange("online")}
            className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600"
          />
          <span className="font-medium text-gray-700 text-sm sm:text-base">Online</span>
        </label>
      </div>

      {paymentMode.online && (
        <div className="p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3 sm:space-y-4">
          <Select
            label="Select Bank *"
            name="selectedBankId"
            value={selectedBankId}
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
            name="onlineRef"
            value={onlineRef}
            handleChange={(e) => onOnlineRefChange(e.target.value)}
            placeholder="Enter reference number"
            required
          />
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Screenshot (Optional)
            </label>
            <label className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-sm">
              <Upload size={18} className="text-gray-600 shrink-0 sm:w-5 sm:h-5" />
              <span className="text-xs sm:text-sm text-gray-700">Choose File</span>
              <input
                type="file"
                accept="image/*"
                onChange={onFileUpload}
                className="hidden"
              />
            </label>
            {screenshot && (
              <img src={screenshot} alt="Screenshot" className="mt-2 max-w-full sm:max-w-xs rounded-lg" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
