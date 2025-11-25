/**
 * i18n Utilities
 * 
 * Helper functions for internationalization
 */

/**
 * Remove locale prefix from pathname
 * Example: /th/dashboard -> /dashboard
 */
export function removeLocalePrefix(path: string, locales: string[] = ['en', 'th', 'my']): string {
  for (const locale of locales) {
    if (path.startsWith(`/${locale}/`)) {
      return path.substring(locale.length + 1); // Remove '/locale'
    }
    // Handle exact locale match (e.g., /th -> /)
    if (path === `/${locale}`) {
      return '/';
    }
  }
  return path;
}

/**
 * Get current locale from pathname
 * Example: /th/dashboard -> th
 */
export function getLocaleFromPath(path: string, locales: string[] = ['en', 'th', 'my'], defaultLocale: string = 'en'): string {
  for (const locale of locales) {
    if (path.startsWith(`/${locale}/`) || path === `/${locale}`) {
      return locale;
    }
  }
  return defaultLocale;
}
