/**
 * Formats a date string from YYYY-MM-DD to DD/MM/YYYY
 * @param dateStr Date string in YYYY-MM-DD format
 * @returns Date string in DD/MM/YYYY format or the original string if invalid
 */
export const formatDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return '';
  
  // Check if it's already in DD/MM/YYYY or similar
  if (dateStr.includes('/') && dateStr.split('/').length === 3) {
    return dateStr;
  }

  // Handle YYYY-MM-DD
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    // Check if parts are valid (e.g. year is 4 digits)
    if (year.length === 4) {
      return `${day}/${month}/${year}`;
    }
  }

  return dateStr;
};
