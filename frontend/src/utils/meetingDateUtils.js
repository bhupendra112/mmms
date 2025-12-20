/**
 * Utility functions for meeting date validation
 * Checks if recovery is allowed only on specified meeting days
 */

/**
 * Check if a given date is a meeting day for the group
 * @param {Date} date - The date to check
 * @param {Object} group - Group object with meeting_date_1_day, meeting_date_2_day
 * @returns {boolean} - True if the date is a meeting day
 */
export const isMeetingDay = (date, group) => {
  if (!group) return false;

  const meetingDay1 = group.meeting_date_1_day || group.raw?.meeting_date_1_day;
  const meetingDay2 = group.meeting_date_2_day || group.raw?.meeting_date_2_day;

  if (!meetingDay1 && !meetingDay2) {
    // If no meeting days configured, allow all days (backward compatibility)
    return true;
  }

  const dayOfMonth = date.getDate();

  return dayOfMonth === meetingDay1 || dayOfMonth === meetingDay2;
};

/**
 * Get the next meeting date for the group
 * @param {Object} group - Group object with meeting_date_1_day, meeting_date_2_day
 * @returns {Date|null} - Next meeting date or null if no meeting days configured
 */
export const getNextMeetingDate = (group) => {
  if (!group) return null;

  const meetingDay1 = group.meeting_date_1_day || group.raw?.meeting_date_1_day;
  const meetingDay2 = group.meeting_date_2_day || group.raw?.meeting_date_2_day;

  if (!meetingDay1 && !meetingDay2) {
    return null;
  }

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();

  const meetingDays = [meetingDay1, meetingDay2].filter(d => d != null);

  // Get all meeting dates for current and next month
  const possibleDates = [];

  // Current month
  meetingDays.forEach(day => {
    const date = new Date(currentYear, currentMonth, day);
    if (date.getDate() === day) { // Valid date (handles cases where day doesn't exist in month)
      possibleDates.push(date);
    }
  });

  // Next month
  meetingDays.forEach(day => {
    const date = new Date(currentYear, currentMonth + 1, day);
    if (date.getDate() === day) { // Valid date
      possibleDates.push(date);
    }
  });

  // Sort dates and find the next one after today
  possibleDates.sort((a, b) => a - b);

  // Set time to start of day for comparison
  const todayStart = new Date(currentYear, currentMonth, currentDay, 0, 0, 0, 0);

  for (const date of possibleDates) {
    if (date >= todayStart) {
      return date;
    }
  }

  // If no date found, return the first date of next month (shouldn't happen, but safety check)
  return possibleDates.length > 0 ? possibleDates[0] : null;
};

/**
 * Format meeting date with time for display
 * @param {Date} date - The meeting date
 * @param {string} time - Time string (HH:MM format)
 * @returns {string} - Formatted date string
 */
export const formatMeetingDateTime = (date, time) => {
  if (!date) return "Not scheduled";

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();

  if (time) {
    return `${day}/${month}/${year} at ${time}`;
  }

  return `${day}/${month}/${year}`;
};

