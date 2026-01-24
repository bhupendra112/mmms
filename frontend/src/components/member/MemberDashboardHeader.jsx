import { FileText } from "lucide-react";

export default function MemberDashboardHeader({ member }) {
  return (
    <div className="member-dashboard-header mb-3 sm:mb-4 md:mb-6 w-full box-border">
      <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-gray-800 flex flex-wrap items-center gap-2 md:gap-3 w-full box-border">
        <FileText size={20} className="sm:w-6 sm:h-6 shrink-0" />
        <span className="break-words flex-1 min-w-0">Member Dashboard</span>
      </h1>
      <p className="text-xs sm:text-sm md:text-base text-gray-600 mt-1 md:mt-2 break-words w-full box-border">
        {member?.name || "Loading..."} ({member?.code || "-"})
      </p>
    </div>
  );
}
