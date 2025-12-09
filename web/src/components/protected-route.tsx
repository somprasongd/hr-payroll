/**
 * Protected Route Component
 * 
 * Wrapper component that checks authentication before rendering children
 * Redirects to login if not authenticated, saving the current path for return
 */

'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from '@/i18n/routing';
import { useAuthStore } from '@/store/auth-store';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, setReturnUrl, _hasHydrated, user, returnUrlUserId } = useAuthStore();

  useEffect(() => {
    if (_hasHydrated && !isAuthenticated) {
      console.log('[ProtectedRoute] Not authenticated, redirecting to login', { pathname, hasUser: !!user, returnUrlUserId });
      // Only save returnUrl if:
      // 1. user is still available (session just expired, not manual logout)
      // 2. AND returnUrlUserId is not already set (axios.ts hasn't saved it yet)
      // If user is null, it means:
      // - Manual logout (shouldn't save returnUrl) OR
      // - Fresh visit without login (shouldn't save returnUrl) OR
      // - axios.ts already handled session expiry and saved returnUrl+userId
      if (user && !returnUrlUserId) {
        setReturnUrl(pathname, user.id);
      }
      
      // Redirect to login
      router.push('/');
    } else if (_hasHydrated && isAuthenticated) {
      console.log('[ProtectedRoute] Authenticated, rendering children', { pathname });
    }
  }, [isAuthenticated, pathname, router, setReturnUrl, _hasHydrated, user, returnUrlUserId]);

  // Show loading while checking authentication or hydrating
  if (!_hasHydrated || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return <>{children}</>;
}
