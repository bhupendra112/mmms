import { CheckCircle, XCircle } from "lucide-react";
import { Select } from "../forms/FormComponents";

export default function AttendanceSection({
  attendance,
  recoveryByOther,
  otherMemberId,
  allMembers,
  currentMember,
  onAttendanceChange,
  onRecoveryByOtherChange,
  onOtherMemberIdChange,
}) {
  return (
    <div className="mb-4 sm:mb-6">
      <label className="block text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
        Attendance *
      </label>
      <div className="flex flex-wrap gap-2 sm:gap-4">
        <button
          type="button"
          onClick={() => onAttendanceChange("present")}
          className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium transition-colors text-sm sm:text-base ${attendance === "present"
            ? "bg-green-600 text-white"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
        >
          <CheckCircle size={20} className="shrink-0" />
          Present
        </button>
        <button
          type="button"
          onClick={() => onAttendanceChange("absent")}
          className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium transition-colors text-sm sm:text-base ${attendance === "absent"
            ? "bg-red-600 text-white"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
        >
          <XCircle size={20} className="shrink-0" />
          Absent
        </button>
      </div>

      {attendance === "absent" && (
        <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Recovery brought by another member?
          </label>
          <div className="flex flex-wrap gap-2 sm:gap-4 mb-3 sm:mb-4">
            <button
              type="button"
              onClick={() => onRecoveryByOtherChange(true)}
              className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base ${recoveryByOther
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700"
                }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => {
                onRecoveryByOtherChange(false);
                onOtherMemberIdChange("");
              }}
              className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base ${!recoveryByOther
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700"
                }`}
            >
              No
            </button>
          </div>
          {recoveryByOther && (
            <Select
              label="Select Member"
              name="otherMemberId"
              value={otherMemberId}
              handleChange={(e) => onOtherMemberIdChange(e.target.value)}
              options={allMembers
                .filter((m) => m.id !== currentMember.id)
                .map((m) => `${m.code} - ${m.name}`)}
              required
            />
          )}
          {!recoveryByOther && (
            <p className="text-sm text-red-600 mt-2">
              Member will be marked as absent without recovery
            </p>
          )}
        </div>
      )}
    </div>
  );
}
