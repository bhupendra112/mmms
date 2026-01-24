import { ArrowLeft } from "lucide-react";

export default function RecoveryProgressBar({
  activeGroup,
  isAdminMode,
  currentMemberIndex,
  allMembers,
  recoveries,
  onBack,
}) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-5 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 min-w-0">
          {isAdminMode && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-sm sm:text-base self-start"
            >
              <ArrowLeft size={18} className="shrink-0" />
              Back to Groups
            </button>
          )}
          <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 truncate">
            {activeGroup.name} - Recovery Entry
          </h2>
        </div>
        <div className="text-xs sm:text-sm text-gray-600 shrink-0">
          Member {currentMemberIndex + 1} of {allMembers.length}
        </div>
      </div>

      {/* Progress */}
      <div>
        <div className="flex justify-between text-xs text-gray-600 mb-2">
          <span>Progress</span>
          <span>{recoveries.length} / {allMembers.length} Processed</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 sm:h-3">
          <div
            className="bg-green-600 h-2 sm:h-3 rounded-full transition-all"
            style={{ width: `${allMembers.length ? (recoveries.length / allMembers.length) * 100 : 0}%` }}
          />
        </div>
      </div>
    </div>
  );
}
