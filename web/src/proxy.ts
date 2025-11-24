import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';
import { NextRequest } from 'next/server';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  // Check if user has a saved locale preference in cookie
  const savedLocale = request.cookies.get('NEXT_LOCALE')?.value;
  
  // If there's a saved locale and it's valid, use it
  if (savedLocale && routing.locales.includes(savedLocale as any)) {
    const response = intlMiddleware(request);
    return response;
  }
  
  return intlMiddleware(request);
}
 
export const config = {
  // Match only internationalized pathnames
  matcher: ['/', '/(th|en|my)/:path*']
};
