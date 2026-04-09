import { CheckCircle, Camera, X, User, Pencil } from "lucide-react";
import { getImageUrl } from "../../utils/recoveryUtils";
import CashDenominationsSection from "./CashDenominationsSection";

export default function RecoverySummaryStep({
  recoveries,
  allMembers,
  totals,
  cashDenominations,
  groupPhoto,
  activeGroup,
  onCapturePhoto,
  onRemovePhoto,
  onCashDenominationsChange,
  onFinalize,
  onEditMembers,
}) {
  const groupLabel =
    activeGroup?.name ||
    activeGroup?.group_name ||
    activeGroup?.raw?.group_name ||
    "Group";
  const printDate = new Date().toLocaleDateString("en-GB");

  return (
    <div className="space-y-4 sm:space-y-5 md:space-y-6">
      {/* Summary */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-5 md:p-6">
        <div className="mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
            <CheckCircle className="text-green-600 shrink-0 w-6 h-6 sm:w-7 sm:h-7" />
            Recovery Summary
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            {groupLabel} · {printDate}
          </p>
          <p className="text-xs sm:text-sm text-gray-500 mt-2">
            After you add the cash note breakdown (if any) and the group photo, use <strong>Finalize &amp; Save All</strong>. Export Excel, PDF, and Print will appear in the next step.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5 md:gap-6 mb-4 sm:mb-6">
          <div className="p-4 sm:p-5 md:p-6 bg-green-50 rounded-lg border-l-4 border-green-500">
            <p className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">Total Cash</p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-800">₹{Math.round(totals.totalCash).toLocaleString()}</p>
          </div>
          <div className="p-4 sm:p-5 md:p-6 bg-blue-50 rounded-lg border-l-4 border-blue-500">
            <p className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">Total Online</p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-800">₹{Math.round(totals.totalOnline).toLocaleString()}</p>
          </div>
          <div className="p-4 sm:p-5 md:p-6 bg-purple-50 rounded-lg border-l-4 border-purple-500 sm:col-span-2 md:col-span-1">
            <p className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">Grand Total</p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-800">₹{Math.round(totals.totalAmount).toLocaleString()}</p>
          </div>
        </div>

        {/* Cash Denomination Breakdown */}
        {totals.totalCash > 0 && (
          <CashDenominationsSection
            cashDenominations={cashDenominations}
            totals={totals}
            onCashDenominationsChange={onCashDenominationsChange}
          />
        )}

        <div className="mb-4 sm:mb-6">
          <h3 className="font-semibold text-gray-800 mb-3 text-sm sm:text-base">Members Recovery Status ({recoveries.length})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {recoveries.map((recovery) => {
              const member = allMembers.find((m) => m.id === recovery.memberId);
              const memberPhoto = member?.raw?.Member_Photo || member?.Member_Photo;
              const isRecovered = recovery.attendance === "present" || (recovery.attendance === "absent" && recovery.recoveryByOther);
              const amount = isRecovered
                ? (recovery.amounts?.saving || 0) +
                (recovery.amounts?.loan || 0) +
                (recovery.amounts?.fd || 0) +
                (recovery.amounts?.interest || 0) +
                (recovery.amounts?.yogdan || 0) +
                (recovery.amounts?.other || 0) +
                (recovery.amounts?.charges ? Object.values(recovery.amounts.charges).reduce((sum, amount) => sum + (parseFloat(amount) || 0), 0) : 0)
                : 0;
              return (
                <div
                  key={recovery.id}
                  className={`p-3 sm:p-4 rounded-lg border-2 flex flex-col items-center ${isRecovered
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                    }`}
                >
                  {/* Member Photo */}
                  {memberPhoto ? (
                    <div className="mb-2 sm:mb-3 w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-gray-300 shrink-0">
                      <img
                        src={getImageUrl(memberPhoto)}
                        alt={`${member?.name || "Member"} Photo`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.nextSibling?.classList.remove("hidden");
                        }}
                      />
                      <div className="hidden w-full h-full bg-gray-200 flex items-center justify-center">
                        <User size={24} className="text-gray-400" />
                      </div>
                    </div>
                  ) : (
                    <div className="mb-2 sm:mb-3 w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-300 shrink-0">
                      <User size={24} className="text-gray-400" />
                    </div>
                  )}
                  <p className="font-medium text-gray-800 text-center text-xs sm:text-sm truncate w-full px-1">{member?.name}</p>
                  <p className="text-[10px] sm:text-xs text-gray-600 text-center">{member?.code}</p>
                  <p className={`text-[10px] sm:text-xs font-semibold mt-1 ${isRecovered ? "text-green-700" : "text-red-700"}`}>
                    {isRecovered ? `₹${amount.toLocaleString()}` : "Absent - No Recovery"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {onEditMembers && (
          <div className="mb-4 sm:mb-6 rounded-lg border border-amber-200 bg-amber-50/60 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-amber-950">
              Need to correct amounts before finalizing?
            </p>
            <button
              type="button"
              onClick={onEditMembers}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white font-medium text-sm hover:bg-amber-700 shrink-0"
            >
              <Pencil size={18} className="shrink-0" />
              Edit member recoveries
            </button>
          </div>
        )}
      </div>

      {/* Group Photo */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-5 md:p-6">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
          <Camera size={24} className="text-blue-600 shrink-0 w-5 h-5 sm:w-6 sm:h-6" />
          Group Photo *
        </h2>
        <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">
          Please take a group photo with all members
        </p>
        <div className="flex flex-col items-center gap-3 sm:gap-4">
          {groupPhoto ? (
            <div className="relative w-full max-w-full">
              <img
                src={groupPhoto}
                alt="Group Photo"
                className="max-w-full h-auto rounded-lg border-2 border-gray-300"
              />
              <button
                type="button"
                onClick={onRemovePhoto}
                className="absolute top-2 right-2 bg-red-600 text-white p-1.5 sm:p-2 rounded-full hover:bg-red-700"
              >
                <X size={18} className="sm:w-5 sm:h-5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onCapturePhoto}
              className="flex flex-col items-center gap-2 sm:gap-3 p-6 sm:p-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors w-full max-w-md"
            >
              <Camera size={40} className="text-gray-400 sm:w-12 sm:h-12" />
              <span className="font-medium text-gray-700 text-sm sm:text-base">Click to Take Photo</span>
            </button>
          )}
        </div>
      </div>

      {/* Finalize Button */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-5 md:p-6">
        <button
          type="button"
          onClick={onFinalize}
          disabled={!groupPhoto}
          className="w-full px-4 sm:px-8 py-3 sm:py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-base sm:text-lg shadow-md"
        >
          Finalize & Save All
        </button>
      </div>
    </div>
  );
}
