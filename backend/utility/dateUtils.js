/**
 * Date utility functions for timezone-safe date operations
 */

/**
 * Get start of day (00:00:00.000) for a given date
 * @param {Date|string} date - Date to get start of day for
 * @returns {Date} Date object set to start of day
 */
export const getStartOfDay = (date) => {
    const d = date instanceof Date ? new Date(date) : new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

/**
 * Get end of day (23:59:59.999) for a given date
 * @param {Date|string} date - Date to get end of day for
 * @returns {Date} Date object set to end of day
 */
export const getEndOfDay = (date) => {
    const d = date instanceof Date ? new Date(date) : new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
};

/**
 * Parse date from various formats (DD/MM/YYYY, ISO string, Date object)
 * @param {Date|string} date - Date to parse
 * @returns {Date} Parsed Date object
 */
export const parseDate = (date) => {
    if (!date) {
        return new Date();
    }
    
    if (date instanceof Date) {
        return date;
    }
    
    if (typeof date === 'string' && date.includes('/')) {
        // Handle DD/MM/YYYY format
        const parts = date.split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
            const year = parseInt(parts[2], 10);
            return new Date(year, month, day);
        }
    }
    
    // Try parsing as ISO string or other format
    return new Date(date);
};

/**
 * Get date range for a given date (start and end of day)
 * @param {Date|string} date - Date to get range for
 * @returns {{start: Date, end: Date}} Object with start and end dates
 */
export const getDateRange = (date) => {
    const parsedDate = parseDate(date);
    return {
        start: getStartOfDay(parsedDate),
        end: getEndOfDay(parsedDate)
    };
};
