import { Building2, LayoutGrid } from "lucide-react";

export default function GroupClusterSelector({
  groups,
  groupsLoading,
  selectedCluster,
  selectedGroup,
  onSelectCluster,
  onBackToClusters,
  onSelectGroup,
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 flex items-center gap-2">
          <Building2 size={20} className="text-blue-600 shrink-0 w-5 h-5 sm:w-5 sm:h-5" />
          <span className="truncate">{selectedCluster ? `Groups in ${selectedCluster.name}` : "Select Cluster"}</span>
        </h2>
        {selectedCluster && (
          <button
            onClick={onBackToClusters}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium self-start sm:self-auto"
          >
            ← Back to Clusters
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {groupsLoading && (
          <div className="col-span-full text-center py-6 sm:py-8 text-gray-500 text-sm sm:text-base">
            <p>Loading...</p>
          </div>
        )}

        {/* Show Clusters */}
        {!groupsLoading && !selectedCluster && (() => {
          const clusterKeys = Array.from(new Set(groups.map(g => `${g.cluster_name || ""}|${g.cluster_code || ""}`)));
          return clusterKeys.map((clusterKey) => {
            const [name, code] = clusterKey.split('|');
            const clusterGroups = groups.filter(g => (g.cluster_name || "") === name && (g.cluster_code || "") === code);
            if (clusterGroups.length === 0) return null; // Skip clusters with no groups
            const displayName = (name || code) ? (name || "No Name") : "Unassigned";
            const displayCode = code || (name ? "" : "No Code");
            return (
              <div
                key={clusterKey}
                onClick={() => onSelectCluster({ name: name || "", code: code || "" })}
                className="p-4 sm:p-5 md:p-6 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
              >
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <LayoutGrid className="text-blue-600 shrink-0 w-7 h-7 sm:w-8 sm:h-8" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-800 text-base sm:text-lg truncate">{displayName}</p>
                    <p className="text-xs sm:text-sm text-gray-600">Code: {displayCode}</p>
                  </div>
                </div>
                <div className="text-xs sm:text-sm text-gray-600">
                  <p>Groups: {clusterGroups.length}</p>
                </div>
              </div>
            );
          }).filter(Boolean);
        })()}

        {/* Show Groups in Selected Cluster */}
        {!groupsLoading && selectedCluster && (() => {
          const clusterGroups = groups.filter(g => (g.cluster_name || "") === (selectedCluster.name || "") && (g.cluster_code || "") === (selectedCluster.code || ""));
          return clusterGroups.length > 0 ? (
            clusterGroups.map((group) => (
              <div
                key={group.id}
                onClick={() => onSelectGroup(group)}
                className={`p-4 sm:p-5 md:p-6 border-2 rounded-lg cursor-pointer transition-colors ${selectedGroup?.id === group.id
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-blue-500 hover:bg-blue-50"
                  }`}
              >
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <Building2 className="text-blue-600 shrink-0 w-7 h-7 sm:w-8 sm:h-8" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-800 text-base sm:text-lg truncate">{group.name}</p>
                    <p className="text-xs sm:text-sm text-gray-600">Code: {group.code || group.id}</p>
                  </div>
                </div>
                <div className="text-xs sm:text-sm text-gray-600">
                  <p className="truncate">Village: {group.village}</p>
                  <p className="mt-1">Members: {group.memberCount ?? 0}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-6 sm:py-8 text-gray-500 text-sm sm:text-base">
              <p>No groups found in this cluster.</p>
            </div>
          );
        })()}

        {!groupsLoading && !selectedCluster && groups.length === 0 && (
          <div className="col-span-full text-center py-6 sm:py-8 text-gray-500 text-sm sm:text-base">
            <p>No clusters found.</p>
          </div>
        )}
        {!groupsLoading && selectedCluster && groups.filter(g => (g.cluster_name || "") === (selectedCluster.name || "") && (g.cluster_code || "") === (selectedCluster.code || "")).length === 0 && (
          <div className="col-span-full text-center py-6 sm:py-8 text-gray-500 text-sm sm:text-base">
            <p>No groups found in this cluster.</p>
          </div>
        )}
      </div>
    </div>
  );
}
