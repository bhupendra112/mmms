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
              <span className="truncate">{member.code}</span>
              {isRecovered && <Check size={14} className="shrink-0 sm:w-4 sm:h-4" />}
              {isAbsent && <X size={14} className="shrink-0 sm:w-4 sm:h-4" />}
            </div>
            <div className="text-[10px] sm:text-xs mt-1 truncate">{member.name}</div>
          </button>
        );
      })}
    </div>
  );
}
