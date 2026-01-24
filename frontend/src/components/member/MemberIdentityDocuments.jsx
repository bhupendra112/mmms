import { IdCard, Image as ImageIcon } from "lucide-react";
import { getImageUrl } from "../../utils/memberUtils";

const DocCard = ({
  title,
  valueLabel,
  value,
  filePath,
  imageErrors,
  onImageError,
  alt,
}) => {
  if (!filePath) return null;

  const isBroken = !!imageErrors?.[filePath];
  const url = getImageUrl(filePath);

  return (
    // ✅ On phone: keep card not too wide and left aligned
    <div className="w-full max-w-[360px] sm:max-w-full min-w-0 overflow-hidden border border-gray-200 rounded-lg p-3 md:p-4 bg-white mr-auto">
      <h3 className="text-sm md:text-base font-semibold text-gray-700 mb-2 break-words">
        {title}
      </h3>

      {valueLabel ? (
        <p className="text-xs md:text-sm text-gray-600 mb-2 md:mb-3 break-words">
          {valueLabel}: {value || "-"}
        </p>
      ) : null}

      <div className="w-full min-w-0 overflow-hidden">
        {isBroken ? (
          <div className="flex items-center justify-center bg-gray-100 rounded-lg h-36 sm:h-40 md:h-48">
            <div className="text-center">
              <ImageIcon size={40} className="mx-auto text-gray-400 mb-2" />
              <p className="text-xs md:text-sm text-gray-500">Image not available</p>
            </div>
          </div>
        ) : (
          <div className="w-full overflow-hidden rounded-lg border border-gray-300 bg-white">
            {/* ✅ Reduce height on phone + never overflow */}
            <img
              src={url}
              alt={alt}
              loading="lazy"
              className="block w-full max-w-full h-36 sm:h-40 md:h-48 object-contain bg-white"
              onError={() => onImageError?.(filePath)}
            />
          </div>
        )}

        {!isBroken && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-xs md:text-sm font-medium break-words"
          >
            <ImageIcon size={14} />
            View Full Size
          </a>
        )}
      </div>
    </div>
  );
};

export default function MemberIdentityDocuments({
  memberDoc,
  imageErrors = {},
  onImageError,
}) {
  const hasMemberDocs =
    !!memberDoc?.Voter_Id_File ||
    !!memberDoc?.Adhar_Id_File ||
    !!memberDoc?.Bank_File ||
    !!memberDoc?.Ration_Card_File ||
    !!memberDoc?.Job_Card_File;

  const hasSpouseDocs =
    !!memberDoc?.Adhar_Id_Pati_File ||
    !!memberDoc?.Voter_Id_Pati_File ||
    !!memberDoc?.Bank_Pati_File;

  if (!memberDoc || (!hasMemberDocs && !hasSpouseDocs)) return null;

  return (
    // ✅ Hard block: no horizontal overflow
    <div className="w-full max-w-full min-w-0 overflow-x-hidden">
      {/* ✅ Left align always (phone too): mx-0 + mr-auto */}
      <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 md:p-6 mb-4 md:mb-6 w-full mx-0 mr-auto sm:max-w-[720px] lg:max-w-[900px]">
        <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 mb-3 md:mb-4 flex items-center gap-2">
          <IdCard size={20} className="shrink-0" />
          <span className="break-words">Member Identity Documents</span>
        </h2>

        {/* ✅ On phone: single column but left aligned; grid items won't stretch beyond max-w */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-6 w-full min-w-0 justify-items-start">
          <DocCard
            title="Voter ID Document"
            valueLabel="Voter ID"
            value={memberDoc?.Voter_Id}
            filePath={memberDoc?.Voter_Id_File}
            imageErrors={imageErrors}
            onImageError={onImageError}
            alt="Voter ID Document"
          />

          <DocCard
            title="Aadhar Document"
            valueLabel="Aadhar Number"
            value={memberDoc?.Adhar_Id}
            filePath={memberDoc?.Adhar_Id_File}
            imageErrors={imageErrors}
            onImageError={onImageError}
            alt="Aadhar Document"
          />

          <DocCard
            title="Bank Document"
            valueLabel="Account"
            value={memberDoc?.Bank_Ac}
            filePath={memberDoc?.Bank_File}
            imageErrors={imageErrors}
            onImageError={onImageError}
            alt="Bank Document"
          />

          <DocCard
            title="Ration Card Document"
            valueLabel="Ration Card"
            value={memberDoc?.Ration_Card}
            filePath={memberDoc?.Ration_Card_File}
            imageErrors={imageErrors}
            onImageError={onImageError}
            alt="Ration Card Document"
          />

          <DocCard
            title="Job Card Document"
            valueLabel="Job Card"
            value={memberDoc?.Job_Card}
            filePath={memberDoc?.Job_Card_File}
            imageErrors={imageErrors}
            onImageError={onImageError}
            alt="Job Card Document"
          />

          {hasSpouseDocs && (
            <div className="md:col-span-2 w-full min-w-0 overflow-hidden">
              <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 mt-4 mb-3 flex items-center gap-2">
                <IdCard size={20} className="shrink-0" />
                <span className="break-words">Spouse (Pati) Document Attachments</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-6 w-full min-w-0 justify-items-start">
                <DocCard
                  title="Spouse Aadhar Document"
                  valueLabel="Aadhar Number"
                  value={memberDoc?.Adhar_Id_Pati}
                  filePath={memberDoc?.Adhar_Id_Pati_File}
                  imageErrors={imageErrors}
                  onImageError={onImageError}
                  alt="Spouse Aadhar Document"
                />

                <DocCard
                  title="Spouse Voter ID Document"
                  valueLabel=""
                  value=""
                  filePath={memberDoc?.Voter_Id_Pati_File}
                  imageErrors={imageErrors}
                  onImageError={onImageError}
                  alt="Spouse Voter ID Document"
                />

                <DocCard
                  title="Spouse Bank Document"
                  valueLabel="Account"
                  value={memberDoc?.Bank_Ac_Pati}
                  filePath={memberDoc?.Bank_Pati_File}
                  imageErrors={imageErrors}
                  onImageError={onImageError}
                  alt="Spouse Bank Document"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
