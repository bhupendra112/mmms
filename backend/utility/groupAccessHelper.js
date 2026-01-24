import { GroupMaster } from "../model/index.js";
import { Admin } from "../model/index.js";


/**
 * Gets admin place from token or database
 * @param {Object} req - Express request object
 * @returns {Promise<string|null>} - Admin place or null if not found
 */
export const getAdminPlace = async (req) => {
    // First try to get from token (already set by middleware for group tokens)
    let adminPlace = req.user?.place || req.admin?.place;

    // If not in token, fetch from database
    if (!adminPlace && (req.user?.id || req.admin?.id)) {
        try {
            const id = req.user?.id || req.admin?.id;
            
            // Check if this is a group token
            if (req.user?.type === "group" || req.admin?.type === "group") {
                // Fetch place from group document
                const group = await GroupMaster.findById(id).select('place').lean();
                if (group && group.place) {
                    adminPlace = group.place;
                    // Update req.user and req.admin for subsequent use
                    if (req.user) req.user.place = adminPlace;
                    if (req.admin) req.admin.place = adminPlace;
                }
            } else {
                // Fetch place from admin document
                const admin = await Admin.findById(id).select('place').lean();
                if (admin && admin.place) {
                    adminPlace = admin.place;
                    // Update req.user and req.admin for subsequent use
                    if (req.user) req.user.place = adminPlace;
                    if (req.admin) req.admin.place = adminPlace;
                }
            }
        } catch (error) {
            console.error("[getAdminPlace] Error fetching place:", error);
        }
    }

    return adminPlace;
};
/**
 * Verifies that a group exists and belongs to the admin's assigned place
 * @param {string|ObjectId} groupId - The group ID to verify
 * @param {string} adminPlace - The admin's assigned place/location
 * @returns {Promise<{valid: boolean, group: Object|null, error: string|null}>}
 */
export const verifyGroupAccess = async (groupId, adminPlace) => {
    if (!groupId) {
        return { valid: false, group: null, error: "Group ID is required" };
    }

    if (!adminPlace) {
        return { valid: false, group: null, error: "Admin place not found. Please ensure you are logged in." };
    }

    try {
        const group = await GroupMaster.findById(groupId).lean();

        if (!group) {
            return { valid: false, group: null, error: "Group not found" };
        }

        if (group.place !== adminPlace) {
            return {
                valid: false,
                group: null,
                error: `Group belongs to different location. You can only access groups from: ${adminPlace}`
            };
        }

        return { valid: true, group, error: null };
    } catch (error) {
        return { valid: false, group: null, error: error.message || "Error verifying group access" };
    }
};

/**
 * Verifies that a group exists and belongs to the admin's assigned place by group code
 * @param {string} groupCode - The group code to verify
 * @param {string} adminPlace - The admin's assigned place/location
 * @param {string} village - Optional village filter
 * @param {string} clusterName - Optional cluster name filter
 * @returns {Promise<{valid: boolean, group: Object|null, error: string|null}>}
 */
export const verifyGroupAccessByCode = async (groupCode, adminPlace, village = null, clusterName = null) => {
    if (!groupCode) {
        return { valid: false, group: null, error: "Group code is required" };
    }

    if (!adminPlace) {
        return { valid: false, group: null, error: "Admin place not found. Please ensure you are logged in." };
    }

    try {
        const query = { group_code: groupCode, place: adminPlace };

        if (village) {
            query.village = village;
        } else if (clusterName) {
            query.cluster_name = clusterName;
        }

        const group = await GroupMaster.findOne(query).lean();

        if (!group) {
            return {
                valid: false,
                group: null,
                error: "Group not found or you don't have access to this group"
            };
        }

        return { valid: true, group, error: null };
    } catch (error) {
        return { valid: false, group: null, error: error.message || "Error verifying group access" };
    }
};

/**
 * Verifies that a group exists and belongs to the admin's assigned place by group name
 * @param {string} groupName - The group name to verify
 * @param {string} adminPlace - The admin's assigned place/location
 * @returns {Promise<{valid: boolean, group: Object|null, error: string|null}>}
 */
export const verifyGroupAccessByName = async (groupName, adminPlace) => {
    if (!groupName) {
        return { valid: false, group: null, error: "Group name is required" };
    }

    if (!adminPlace) {
        return { valid: false, group: null, error: "Admin place not found. Please ensure you are logged in." };
    }

    try {
        const group = await GroupMaster.findOne({ group_name: groupName, place: adminPlace }).lean();

        if (!group) {
            return {
                valid: false,
                group: null,
                error: "Group not found or you don't have access to this group"
            };
        }

        return { valid: true, group, error: null };
    } catch (error) {
        return { valid: false, group: null, error: error.message || "Error verifying group access" };
    }
};
