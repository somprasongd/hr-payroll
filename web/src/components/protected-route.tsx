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
  const { isAuthenticated, setReturnUrl } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      // Save current path for return after login (without locale prefix)
      setReturnUrl(pathname);
      
      // Redirect to login
      router.push('/');
    }
  }, [isAuthenticated, pathname, router, setReturnUrl]);

  // Show loading while checking authentication
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return <>{children}</>;
}
