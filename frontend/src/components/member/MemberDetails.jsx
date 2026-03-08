import { User } from "lucide-react";
import { formatDate } from "../../utils/memberUtils";

export default function MemberDetails({ memberDoc, formatDate: formatDateFn = formatDate }) {
  if (!memberDoc) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm p-2 sm:p-3 md:p-4 lg:p-6 mb-2 sm:mb-3 md:mb-4 w-full min-w-0 box-border overflow-x-hidden">
      <h2 className="text-sm sm:text-base md:text-lg font-semibold text-gray-800 mb-2 sm:mb-3 flex flex-wrap items-center gap-2">
        <User size={18} className="sm:w-5 sm:h-5 shrink-0" />
        <span className="break-words">Complete Member & Spouse Details</span>
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
        {/* Member Details Column */}
        <div className="bg-blue-50 rounded-lg p-3 md:p-4 border-2 border-blue-200">
          <h3 className="text-base md:text-lg font-bold text-blue-800 mb-3 md:mb-4 pb-2 border-b-2 border-blue-300">Member Details</h3>
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-blue-200 pb-1">
              <span className="text-xs md:text-sm font-semibold text-gray-700">Member Code:</span>
              <span className="text-xs md:text-sm text-gray-800 break-words">{memberDoc?.Member_Id || "-"}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-blue-200 pb-1">
              <span className="text-xs md:text-sm font-semibold text-gray-700">Member Name:</span>
              <span className="text-xs md:text-sm text-gray-800 break-words">{memberDoc?.Member_Nm || "-"}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-blue-200 pb-1">
              <span className="text-xs md:text-sm font-semibold text-gray-700">Date of Birth:</span>
              <span className="text-xs md:text-sm text-gray-800">{formatDateFn(memberDoc?.dt_birth) || "-"}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-blue-200 pb-1">
              <span className="text-xs md:text-sm font-semibold text-gray-700">Age:</span>
              <span className="text-xs md:text-sm text-gray-800">{memberDoc?.Age || "-"}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-blue-200 pb-1">
              <span className="text-xs md:text-sm font-semibold text-gray-700">Aadhar Number:</span>
              <span className="text-xs md:text-sm text-gray-800 break-words">{memberDoc?.Adhar_Id || "-"}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-blue-200 pb-1">
              <span className="text-xs md:text-sm font-semibold text-gray-700">Mobile Number:</span>
              <span className="text-xs md:text-sm text-gray-800">{memberDoc?.cell_phone || "-"}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-blue-200 pb-1">
              <span className="text-xs md:text-sm font-semibold text-gray-700">Bank Account:</span>
              <span className="text-xs md:text-sm text-gray-800 break-words">{memberDoc?.Bank_Ac || "-"}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-blue-200 pb-1">
              <span className="text-xs md:text-sm font-semibold text-gray-700">Samagra ID:</span>
              <span className="text-xs md:text-sm text-gray-800 break-words">{memberDoc?.Samagra_Id || "-"}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-blue-200 pb-1">
              <span className="text-xs md:text-sm font-semibold text-gray-700">Voter ID:</span>
              <span className="text-xs md:text-sm text-gray-800 break-words">{memberDoc?.Voter_Id || "-"}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-blue-200 pb-1">
              <span className="text-xs md:text-sm font-semibold text-gray-700">Date of Joining:</span>
              <span className="text-xs md:text-sm text-gray-800">{formatDateFn(memberDoc?.Dt_Join) || "-"}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-blue-200 pb-1">
              <span className="text-xs md:text-sm font-semibold text-gray-700">Father/Husband Name:</span>
              <span className="text-xs md:text-sm text-gray-800 break-words">{memberDoc?.F_H_Name || "-"}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-blue-200 pb-1">
              <span className="text-xs md:text-sm font-semibold text-gray-700">Bank Name:</span>
              <span className="text-xs md:text-sm text-gray-800 break-words">{memberDoc?.Bank_Name || "-"}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-blue-200 pb-1">
              <span className="text-xs md:text-sm font-semibold text-gray-700">IFSC Code:</span>
              <span className="text-xs md:text-sm text-gray-800 break-words">{memberDoc?.Ifsc_No || "-"}</span>
            </div>
          </div>
        </div>

        {/* Spouse (Pati) Details Column */}
        <div className="bg-pink-50 rounded-lg p-3 md:p-4 border-2 border-pink-200">
          <h3 className="text-base md:text-lg font-bold text-pink-800 mb-3 md:mb-4 pb-2 border-b-2 border-pink-300">Spouse (Pati) Details</h3>
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-pink-200 pb-1">
              <span className="text-xs md:text-sm font-semibold text-gray-700">Spouse Name:</span>
              <span className="text-xs md:text-sm text-gray-800 break-words">{memberDoc?.F_H_Name || "-"}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-pink-200 pb-1">
              <span className="text-xs md:text-sm font-semibold text-gray-700">Date of Birth:</span>
              <span className="text-xs md:text-sm text-gray-800">{formatDateFn(memberDoc?.dt_birth_pati) || "-"}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-pink-200 pb-1">
              <span className="text-xs md:text-sm font-semibold text-gray-700">Age:</span>
              <span className="text-xs md:text-sm text-gray-800">{memberDoc?.Age_Pati || "-"}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-pink-200 pb-1">
              <span className="text-xs md:text-sm font-semibold text-gray-700">Aadhar Number:</span>
              <span className="text-xs md:text-sm text-gray-800 break-words">{memberDoc?.Adhar_Id_Pati || "-"}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-pink-200 pb-1">
              <span className="text-xs md:text-sm font-semibold text-gray-700">Mobile Number:</span>
              <span className="text-xs md:text-sm text-gray-800">{memberDoc?.cell_phone_pati || "-"}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-pink-200 pb-1">
              <span className="text-xs md:text-sm font-semibold text-gray-700">Bank Account:</span>
              <span className="text-xs md:text-sm text-gray-800 break-words">{memberDoc?.Bank_Ac_Pati || "-"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Member Details */}
      <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-gray-200">
        <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4">Additional Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-gray-200 pb-2">
            <span className="text-xs md:text-sm font-semibold text-gray-700">Ration Card:</span>
            <span className="text-xs md:text-sm text-gray-800 break-words">{memberDoc?.Ration_Card || "-"}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-gray-200 pb-2">
            <span className="text-xs md:text-sm font-semibold text-gray-700">Job Card:</span>
            <span className="text-xs md:text-sm text-gray-800 break-words">{memberDoc?.Job_Card || "-"}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-gray-200 pb-2">
            <span className="text-xs md:text-sm font-semibold text-gray-700">Education:</span>
            <span className="text-xs md:text-sm text-gray-800 break-words">{memberDoc?.Edu_Qual || "-"}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-gray-200 pb-2">
            <span className="text-xs md:text-sm font-semibold text-gray-700">Profession:</span>
            <span className="text-xs md:text-sm text-gray-800 break-words">{memberDoc?.Profession || "-"}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-gray-200 pb-2">
            <span className="text-xs md:text-sm font-semibold text-gray-700">Annual Income:</span>
            <span className="text-xs md:text-sm text-gray-800 break-words">{memberDoc?.Anual_Income ? `₹${memberDoc.Anual_Income.toLocaleString()}` : "-"}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-gray-200 pb-2">
            <span className="text-xs md:text-sm font-semibold text-gray-700">Caste:</span>
            <span className="text-xs md:text-sm text-gray-800 break-words">{memberDoc?.Caste || "-"}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-gray-200 pb-2">
            <span className="text-xs md:text-sm font-semibold text-gray-700">Religion:</span>
            <span className="text-xs md:text-sm text-gray-800 break-words">{memberDoc?.Religion || "-"}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-gray-200 pb-2">
            <span className="text-xs md:text-sm font-semibold text-gray-700">APL/BPL:</span>
            <span className="text-xs md:text-sm text-gray-800 break-words">{memberDoc?.Apl_Bpl_Etc || "-"}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-gray-200 pb-2">
            <span className="text-xs md:text-sm font-semibold text-gray-700">Designation:</span>
            <span className="text-xs md:text-sm text-gray-800 break-words">{memberDoc?.Desg || "-"}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-gray-200 pb-2">
            <span className="text-xs md:text-sm font-semibold text-gray-700">Village:</span>
            <span className="text-xs md:text-sm text-gray-800 break-words">{memberDoc?.Village || "-"}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-gray-200 pb-2">
            <span className="text-xs md:text-sm font-semibold text-gray-700">Address:</span>
            <span className="text-xs md:text-sm text-gray-800 break-words">{memberDoc?.res_add1 || "-"}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 border-b border-gray-200 pb-2">
            <span className="text-xs md:text-sm font-semibold text-gray-700">Group Name:</span>
            <span className="text-xs md:text-sm text-gray-800 break-words">{memberDoc?.Group_Name || "-"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
