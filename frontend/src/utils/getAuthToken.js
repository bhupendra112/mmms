/**
 * Centralized function to get auth token
 * Checks for group/supervisor token first (if in that context), then admin token
 * This ensures consistency across all HTTP clients
 */
export const getAuthToken = () => {
  const pathname = window.location?.pathname || "";

  if (pathname.startsWith("/supervisor")) {
    const supervisorToken = localStorage.getItem("supervisorToken");
    if (supervisorToken) return supervisorToken;
  }

  if (pathname.startsWith("/group")) {
    const supervisorToken = localStorage.getItem("supervisorToken");
    if (supervisorToken) return supervisorToken;
    const groupToken = localStorage.getItem("groupToken");
    if (groupToken) return groupToken;
  }

  return localStorage.getItem("adminToken");
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

