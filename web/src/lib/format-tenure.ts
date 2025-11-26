/**
 * Format tenure in days to a human-readable format
 * @param days - Number of days
 * @param t - Translation function
 * @returns Formatted tenure string (e.g., "8 ปี 10 เดือน", "5 เดือน", "15 วัน")
 */
export function formatTenure(days: number, t: (key: string) => string): string {
  if (days >= 365) {
    const years = Math.floor(days / 365);
    const remainingDays = days % 365;
    const months = Math.floor(remainingDays / 30);
    
    if (months > 0) {
      return `${years} ${t('units.years')} ${months} ${t('units.months')}`;
    }
    return `${years} ${t('units.years')}`;
  }
  
  if (days >= 30) {
    const months = Math.floor(days / 30);
    return `${months} ${t('units.months')}`;
  }
  
  return `${days} ${t('units.days')}`;
}
