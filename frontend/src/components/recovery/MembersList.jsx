import { Check, X } from "lucide-react";

export default function MembersList({
  allMembers,
  recoveries,
  currentMemberIndex,
  onMemberClick,
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
      {allMembers.map((member, index) => {
        const memberRecovery = recoveries.find((r) => r.memberId === member.id);
        const isRecovered = memberRecovery && (memberRecovery.attendance === "present" || (memberRecovery.attendance === "absent" && memberRecovery.recoveryByOther));
        const isAbsent = memberRecovery && memberRecovery.attendance === "absent" && !memberRecovery.recoveryByOther;
        const isCurrent = index === currentMemberIndex;
        return (
          <button
            key={member.id}
            onClick={() => onMemberClick(index)}
            className={`p-2 sm:p-3 rounded-lg text-xs sm:text-sm font-medium transition-colors ${isCurrent
              ? "bg-blue-600 text-white"
              : isRecovered
                ? "bg-green-100 text-green-800 border-2 border-green-500"
                : isAbsent
                  ? "bg-red-100 text-red-800 border-2 border-red-500"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="truncate font-medium sm:font-normal">
                <span className="sm:hidden">{member.name}</span>
                <span className="hidden sm:inline">{member.code}</span>
              </span>
              {isRecovered && <Check size={14} className="shrink-0 sm:w-4 sm:h-4" />}
              {isAbsent && <X size={14} className="shrink-0 sm:w-4 sm:h-4" />}
            </div>
            <div className="text-[10px] sm:text-xs mt-1 truncate hidden sm:block">{member.name}</div>
            {(() => {
              const fh = (member.raw && (member.raw.F_H_Name || member.raw.F_H_FatherName)) || member.fatherOrHusbandName || "";
              const fhStr = (typeof fh === "string" ? fh : String(fh || "")).trim();
              return fhStr ? (
                <div className="text-[9px] sm:text-[10px] mt-0.5 truncate text-gray-500 opacity-90" title="Father/Husband">
                  {fhStr}
                </div>
              ) : null;
            })()}
          </button>
        );
      })}
    </div>
  );
}
