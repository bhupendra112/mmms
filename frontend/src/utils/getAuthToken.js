/**
 * Centralized function to get auth token
 * Checks for group token first (if in group context), then admin token
 * This ensures consistency across all HTTP clients
 */
export const getAuthToken = () => {
  // Check if we're in a group context (group routes start with /group)
  const isGroupRoute = window.location.pathname.startsWith("/group");
  
  // For group routes, prefer group token
  if (isGroupRoute) {
    const groupToken = localStorage.getItem("groupToken");
    if (groupToken) {
      return groupToken;
    }
  }
  
  // Fall back to admin token
  const adminToken = localStorage.getItem("adminToken");
  return adminToken;
};

/**
 * Get token from Redux store (for use inside React components)
 */
export const getTokenFromStore = (store) => {
  if (store && store.getState) {
    return store.getState().auth?.token;
  }
  return getAuthToken();
};

