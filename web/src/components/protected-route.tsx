/**
 * Protected Route Component
 * 
 * Wrapper component that checks authentication before rendering children
 * Redirects to login if not authenticated, saving the current path for return
 * Also handles role-based route restrictions (e.g., superadmin can only access /super-admin/*)
 */

'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from '@/i18n/routing';
import { useAuthStore } from '@/store/auth-store';
import { useTenantStore } from '@/store/tenant-store';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, setReturnUrl, _hasHydrated: authHasHydrated, user, returnUrlUserId } = useAuthStore();
  const { _hasHydrated: tenantHasHydrated } = useTenantStore();
  
  // Wait for both stores to hydrate before making authentication decisions
  const _hasHydrated = authHasHydrated && tenantHasHydrated;

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
    } else if (_hasHydrated && isAuthenticated && user) {
      console.log('[ProtectedRoute] Authenticated, checking role restrictions', { pathname, role: user.role });
      
      // Superadmin can only access /super-admin/* routes AND /profile (for password change)
      if (user.role === 'superadmin') {
        const allowedForSuperadmin = pathname.startsWith('/super-admin') || pathname === '/profile';
        if (!allowedForSuperadmin) {
          console.log('[ProtectedRoute] Superadmin trying to access non-superadmin route, redirecting');
          router.replace('/super-admin/companies');
        }
      } else {
        // Non-superadmin users cannot access /super-admin/* routes
        if (pathname.startsWith('/super-admin')) {
          console.log('[ProtectedRoute] Non-superadmin trying to access superadmin route, redirecting');
          router.replace('/dashboard');
        }
      }
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

  // Block rendering if superadmin on non-superadmin route (or vice versa)
  // Exception: /profile is allowed for superadmin to change password
  const superadminAllowed = pathname.startsWith('/super-admin') || pathname === '/profile';
  if (user?.role === 'superadmin' && !superadminAllowed) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }
  
  if (user?.role !== 'superadmin' && pathname.startsWith('/super-admin')) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return <>{children}</>;
}
