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
    <div className="member-dashboard-header w-full min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-sm sm:text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-1.5 sm:gap-2 min-w-0">
          <FileText size={18} className="sm:w-5 sm:h-5 shrink-0" />
          <span className="break-words">Member Dashboard</span>
        </h1>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={onExitMember}
            className="inline-flex items-center justify-center gap-1 px-2 sm:px-3 py-2 rounded-full bg-red-600 text-white text-xs sm:text-sm font-medium shadow-sm hover:bg-red-700 transition-colors min-h-[44px] min-w-0"
            title="Exit / Demand & Recovery"
          >
            <span className="hidden sm:inline">Exit / Demand &amp; Recovery</span>
            <span className="sm:hidden">Exit</span>
          </button>
          {hasPrev && (
            <button
              type="button"
              onClick={onPrevMember}
              className="inline-flex items-center justify-center gap-1 px-2 sm:px-3 py-2 rounded-full bg-gray-700 text-white text-xs sm:text-sm font-medium shadow-sm hover:bg-gray-800 transition-colors min-h-[44px] min-w-0"
              title="Previous member"
            >
              <ArrowLeft size={14} className="shrink-0" />
              <span className="hidden sm:inline">Previous member</span>
              <span className="sm:hidden">Prev</span>
            </button>
          )}
          {hasNext && (
            <button
              type="button"
              onClick={onNextMember}
              className="inline-flex items-center justify-center gap-1 px-2 sm:px-3 py-2 rounded-full bg-blue-600 text-white text-xs sm:text-sm font-medium shadow-sm hover:bg-blue-700 transition-colors min-h-[44px] min-w-0"
              title="Next member"
            >
              <span className="hidden sm:inline">Next member</span>
              <span className="sm:hidden">Next</span>
              <ArrowRight size={14} className="shrink-0" />
            </button>
          )}
        </div>
      </div>
      <p className="text-xs sm:text-sm md:text-base text-gray-600 mt-1 w-full min-w-0 break-words" title={member ? `${member.name || ""} (${member.code || ""})` : ""}>
        {member?.name || "Loading..."} ({member?.code || "-"})
      </p>
    </div>
  );
}
