/**
 * Centralized function to get auth token
 * Checks Redux store first, then falls back to localStorage
 * This ensures consistency across all HTTP clients
 */
export const getAuthToken = () => {
  // Try to get from localStorage (works even outside React components)
  const token = localStorage.getItem("adminToken");
  return token;
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

