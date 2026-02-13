import { FileText, ArrowRight, ArrowLeft } from "lucide-react";

export default function MemberDashboardHeader({
  member,
  onNextMember,
  hasNext,
  onPrevMember,
  hasPrev,
  onExitMember,
}) {
  return (
    <div className="member-dashboard-header mb-3 sm:mb-4 md:mb-6 w-full box-border">
      <div className="flex items-center justify-between gap-2 md:gap-3 flex-wrap">
        <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-gray-800 flex flex-wrap items-center gap-2 md:gap-3 w-full sm:w-auto box-border">
          <FileText size={20} className="sm:w-6 sm:h-6 shrink-0" />
          <span className="break-words flex-1 min-w-0">Member Dashboard</span>
        </h1>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onExitMember}
            className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-red-600 text-white text-xs sm:text-sm font-medium shadow-sm hover:bg-red-700 transition-colors"
          >
            <span className="hidden sm:inline">Exit / Demand &amp; Recovery</span>
            <span className="sm:hidden">Exit</span>
          </button>
          {hasPrev && (
            <button
              type="button"
              onClick={onPrevMember}
              className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gray-700 text-white text-xs sm:text-sm font-medium shadow-sm hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft size={14} className="sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden sm:inline">Previous member</span>
              <span className="sm:hidden">Prev</span>
            </button>
          )}
          {hasNext && (
            <button
              type="button"
              onClick={onNextMember}
              className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-blue-600 text-white text-xs sm:text-sm font-medium shadow-sm hover:bg-blue-700 transition-colors"
            >
              <span className="hidden sm:inline">Next member</span>
              <span className="sm:hidden">Next</span>
              <ArrowRight size={14} className="sm:w-4 sm:h-4 shrink-0" />
            </button>
          )}
        </div>
      </div>
      <p className="text-xs sm:text-sm md:text-base text-gray-600 mt-1 md:mt-2 break-words w-full box-border">
        {member?.name || "Loading..."} ({member?.code || "-"})
      </p>
    </div>
  );
}
