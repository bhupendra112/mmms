// Helper function to get full image URL
export const getImageUrl = (imagePath) => {
  if (!imagePath) return null;

  // Get backend origin - extract only protocol://host:port (no API paths)
  const rawBaseURL = import.meta.env.VITE_BASE_URL || (import.meta.env.PROD ? "https://api.mmms.online" : "http://localhost:8080");

  let baseURL;
  try {
    // Try to parse as URL and extract origin (protocol://host:port)
    const url = new URL(rawBaseURL);
    baseURL = `${url.protocol}//${url.host}`; // Gets protocol://host:port
  } catch {
    // If parsing fails, extract origin manually
    const match = rawBaseURL.match(/^(https?:\/\/[^/]+)/i);
    baseURL = match ? match[1] : (import.meta.env.PROD ? "https://api.mmms.online" : "http://localhost:8080");
  }

  // Ensure imagePath starts with /
  const cleanImagePath = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
  const fullUrl = `${baseURL}${cleanImagePath}`;

  return fullUrl;
};

// Helper function to format currency values (round to 2 decimal places and format)
export const formatCurrency = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return 0;
  // Round to 2 decimal places
  const rounded = Math.round(numValue * 100) / 100;
  return rounded;
};

// Helper function to format date strings
export const formatDate = (dateString) => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch (error) {
    return "";
  }
};
