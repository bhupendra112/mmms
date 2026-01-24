import { Image as ImageIcon } from "lucide-react";
import { getImageUrl } from "../../utils/memberUtils";

export default function MemberPhoto({ photoPath, imageErrors, onImageError }) {
  if (!photoPath) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 md:p-6 mb-3 sm:mb-4 md:mb-6 w-full box-border overflow-x-hidden">
      <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 mb-2 sm:mb-3 md:mb-4 flex flex-wrap items-center gap-2">
        <ImageIcon size={18} className="sm:w-5 sm:h-5 shrink-0" />
        <span className="break-words">Member Photo</span>
      </h2>
      <div className="flex justify-center member-photo-container w-full box-border">
        <div className="relative w-full max-w-[180px] sm:max-w-[240px] md:max-w-[300px] box-border">
          {imageErrors[photoPath] ? (
            <div className="flex items-center justify-center bg-gray-100 rounded-lg w-full aspect-[3/4] box-border">
              <div className="text-center p-2 sm:p-4">
                <ImageIcon size={32} className="sm:w-10 sm:h-10 mx-auto text-gray-400 mb-2" />
                <p className="text-xs md:text-sm text-gray-500">Photo not available</p>
              </div>
            </div>
          ) : (
            <img
              src={getImageUrl(photoPath)}
              alt="Member Photo"
              className="member-photo-image w-full aspect-[3/4] object-cover rounded-lg border-2 sm:border-4 border-gray-300 shadow-lg box-border"
              onError={() => onImageError(photoPath)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
