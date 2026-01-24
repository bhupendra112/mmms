import { Wallet } from "lucide-react";

export default function CashDenominationsSection({
  cashDenominations,
  totals,
  onCashDenominationsChange,
}) {
  const notes = [
    { key: 'note500', value: 500, label: '₹500 Notes' },
    { key: 'note200', value: 200, label: '₹200 Notes' },
    { key: 'note100', value: 100, label: '₹100 Notes' },
    { key: 'note50', value: 50, label: '₹50 Notes' },
    { key: 'note20', value: 20, label: '₹20 Notes' },
    { key: 'note10', value: 10, label: '₹10 Notes' },
    { key: 'note5', value: 5, label: '₹5 Notes' },
    { key: 'note2', value: 2, label: '₹2 Coins/Notes' },
    { key: 'note1', value: 1, label: '₹1 Coins/Notes' },
  ];

  const calculatedTotal = (parseFloat(cashDenominations.note200) || 0) * 200 +
    (parseFloat(cashDenominations.note500) || 0) * 500 +
    (parseFloat(cashDenominations.note100) || 0) * 100 +
    (parseFloat(cashDenominations.note50) || 0) * 50 +
    (parseFloat(cashDenominations.note20) || 0) * 20 +
    (parseFloat(cashDenominations.note10) || 0) * 10 +
    (parseFloat(cashDenominations.note5) || 0) * 5 +
    (parseFloat(cashDenominations.note2) || 0) * 2 +
    (parseFloat(cashDenominations.note1) || 0) * 1;

  const roundedTotalCash = totals.totalCash >= 0
    ? Math.floor(totals.totalCash) + (totals.totalCash % 1 >= 0.5 ? 1 : 0)
    : Math.ceil(totals.totalCash) - (Math.abs(totals.totalCash) % 1 >= 0.5 ? 1 : 0);
  const roundedCalculatedTotal = Math.round(calculatedTotal);
  const isValid = Math.abs(roundedCalculatedTotal - roundedTotalCash) <= 1;

  const totalQuantity = Object.values(cashDenominations).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);

  const handleChange = (key, value) => {
    onCashDenominationsChange({ ...cashDenominations, [key]: value });
  };

  return (
    <div className="bg-gray-50 rounded-xl p-3 sm:p-4 md:p-6 mb-4 sm:mb-5 md:mb-6 border-2 border-gray-200">
      <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
        <Wallet size={18} className="text-green-600 shrink-0 w-4 h-4 sm:w-5 sm:h-5" />
        <span>Cash Denomination Breakdown</span>
      </h3>

      {/* Mobile: Card/list layout – no horizontal scroll */}
      <div className="block md:hidden space-y-2 sm:space-y-3">
        {notes.map((note, index) => {
          const quantity = parseFloat(cashDenominations[note.key]) || 0;
          const amount = quantity * note.value;
          return (
            <div
              key={note.key}
              className={`flex items-center justify-between gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg border border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
            >
              <span className="text-xs sm:text-sm font-medium text-gray-900 shrink-0 min-w-[80px] sm:min-w-[90px]">
                {note.label}
              </span>
              <input
                type="number"
                value={cashDenominations[note.key] || ""}
                onChange={(e) => handleChange(note.key, e.target.value)}
                placeholder="0"
                min="0"
                className="w-16 sm:w-20 flex-1 max-w-[88px] px-2 sm:px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm text-center"
              />
              <span className="text-xs sm:text-sm font-semibold text-gray-700 shrink-0 min-w-[60px] sm:min-w-[72px] text-right">
                ₹{amount.toLocaleString('en-IN')}
              </span>
            </div>
          );
        })}
        <div className="flex items-center justify-between gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg bg-gradient-to-r from-gray-100 to-gray-200 border-2 border-gray-300 font-semibold">
          <span className="text-xs sm:text-sm font-bold text-gray-900 uppercase">Total</span>
          <span className="text-xs sm:text-sm text-gray-700">{totalQuantity.toLocaleString('en-IN')} notes</span>
          <span className={`text-sm sm:text-base font-bold min-w-[64px] sm:min-w-[80px] text-right ${isValid ? "text-green-600" : "text-red-600"}`}>
            ₹{roundedCalculatedTotal.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* Tablet / Laptop: Table layout */}
      <div className="hidden md:block w-full overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-[320px] w-full border-collapse">
          <thead>
            <tr className="bg-gradient-to-r from-green-500 to-green-600 text-white">
              <th className="px-4 lg:px-6 py-3 lg:py-4 text-left font-semibold text-xs lg:text-sm uppercase tracking-wider border-b-2 border-green-700">
                Note Value
              </th>
              <th className="px-4 lg:px-6 py-3 lg:py-4 text-left font-semibold text-xs lg:text-sm uppercase tracking-wider border-b-2 border-green-700">
                Quantity
              </th>
              <th className="px-4 lg:px-6 py-3 lg:py-4 text-right font-semibold text-xs lg:text-sm uppercase tracking-wider border-b-2 border-green-700">
                Amount (₹)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {notes.map((note, index) => {
              const quantity = parseFloat(cashDenominations[note.key]) || 0;
              const amount = quantity * note.value;
              return (
                <tr key={note.key} className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-4 lg:px-6 py-3 lg:py-4 text-sm font-medium text-gray-900">
                    {note.label}
                  </td>
                  <td className="px-4 lg:px-6 py-3 lg:py-4">
                    <input
                      type="number"
                      value={cashDenominations[note.key] || ""}
                      onChange={(e) => handleChange(note.key, e.target.value)}
                      placeholder="0"
                      min="0"
                      className="w-full max-w-28 lg:max-w-32 px-2 lg:px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                    />
                  </td>
                  <td className="px-4 lg:px-6 py-3 lg:py-4 text-right text-sm font-semibold text-gray-700">
                    ₹{amount.toLocaleString('en-IN')}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gradient-to-r from-gray-100 to-gray-200 border-t-4 border-gray-400">
              <td className="px-4 lg:px-6 py-3 lg:py-4 text-sm font-bold text-gray-900 uppercase">Total</td>
              <td className="px-4 lg:px-6 py-3 lg:py-4 text-sm font-semibold text-gray-700">
                {totalQuantity.toLocaleString('en-IN')}
              </td>
              <td className="px-4 lg:px-6 py-3 lg:py-4 text-right">
                <span className={`text-base lg:text-lg font-bold ${isValid ? "text-green-600" : "text-red-600"}`}>
                  ₹{roundedCalculatedTotal.toLocaleString('en-IN')}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {!isValid && (
        <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-red-600">
          Cash denominations total (₹{roundedCalculatedTotal.toLocaleString()}) does not match total cash amount (₹{roundedTotalCash.toLocaleString()})
        </p>
      )}
    </div>
  );
}
