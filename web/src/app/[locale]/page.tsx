'use client';

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuthStore } from "@/store/auth-store"
import { useTenantStore, Company, Branch } from "@/store/tenant-store"
import { useState, useEffect, useRef } from "react"
import { useTranslations, useLocale } from 'next-intl';
import { User, Lock, Eye, EyeOff, Users } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useRouter, usePathname } from "@/i18n/routing";
import { authService, CompanyInfo, BranchInfo } from "@/services/auth.service";

import { switchTenant } from "@/services/tenant.service";
import { ApiError } from "@/lib/api-client";
import { DismissibleAlert } from "@/components/ui/dismissible-alert";
import { CompanySelector } from "@/components/company-selector";

export default function LoginPage() {
  const t = useTranslations('Index');
  const locale = useLocale();
  const { login, returnUrl, returnUrlUserId, clearReturnUrl, isAuthenticated, _hasHydrated, updateToken, logout } = useAuthStore()
  const { setCompanies, setBranches, switchTenant: switchTenantStore, clearTenant } = useTenantStore()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string>('')
  const [isChecking, setIsChecking] = useState(true)
  const router = useRouter();
  const pathname = usePathname();
  const hasVerified = useRef(false);


  // Company selection state
  const [showCompanySelector, setShowCompanySelector] = useState(false);
  const [pendingCompanies, setPendingCompanies] = useState<CompanyInfo[]>([]);
  const [pendingBranches, setPendingBranches] = useState<BranchInfo[]>([]);
  const [pendingRedirect, setPendingRedirect] = useState<string>('/dashboard');
  const [version, setVersion] = useState<string>('');



  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/version`)
      .then(res => res.json())
      .then(data => {
         if (data.version) {
             setVersion(data.version.replace(/^v/i, ''))
         }
      })
      .catch(() => setVersion(''))
  }, [])

  useEffect(() => {
    // Wait for hydration to complete
    if (!_hasHydrated) return;

    // Prevent multiple verifications or loops
    if (hasVerified.current) return;

    console.log('[LoginPage] Checking session', { isAuthenticated });

    const verifySession = async () => {
      hasVerified.current = true;

      if (isAuthenticated) {
        try {
          console.log('[LoginPage] Verifying session with HttpOnly cookie');
          // Verify session by refreshing token (uses HttpOnly cookie)
          const response = await authService.refreshToken();
          console.log('[LoginPage] Session verified, updating token');
          
          // Update access token only - refresh token is in HttpOnly cookie
          updateToken(response.accessToken);
          
          const preferredLocale = localStorage.getItem('preferredLocale');
          const targetLocale = (preferredLocale && ['en', 'th', 'my'].includes(preferredLocale)) 
            ? preferredLocale 
            : locale;

          const redirectTo = returnUrl || '/dashboard';
          console.log('[LoginPage] Redirecting to', redirectTo);
          router.replace(redirectTo, { locale: targetLocale as 'en' | 'th' | 'my' });
        } catch (error) {
          console.error('[LoginPage] Session verification failed:', error);
          // If verification fails, logout and show login form
          logout();
          setIsChecking(false);
        }
      } else {
        console.log('[LoginPage] Not authenticated, checking preferred locale');
        
        // Check if we need to redirect to preferred locale
        const preferredLocale = localStorage.getItem('preferredLocale');
        if (preferredLocale && ['en', 'th', 'my'].includes(preferredLocale) && preferredLocale !== locale) {
          console.log('[LoginPage] Redirecting to preferred locale', preferredLocale);
          router.replace(pathname, { locale: preferredLocale as 'en' | 'th' | 'my' });
          return;
        }

        console.log('[LoginPage] Showing login form');
        // Not authenticated, show login form
        setIsChecking(false);
      }
    };

    verifySession();
  }, [_hasHydrated, isAuthenticated, router, returnUrl, returnUrlUserId, locale, updateToken, logout]);

  const formSchema = z.object({
    username: z.string().min(3, {
      message: t('validation.usernameLength'),
    }),
    password: z.string().min(6, {
      message: t('validation.passwordLength'),
    }),
    rememberMe: z.boolean(),
  })

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
      rememberMe: false,
    },
  })

  useEffect(() => {
    const rememberedUsername = localStorage.getItem('rememberedUsername')
    if (rememberedUsername) {
      form.setValue('username', rememberedUsername)
      form.setValue('rememberMe', true)
    }
  }, [form])

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true)
    setError('')
    
    try {
      const response = await authService.login({
        username: values.username,
        password: values.password,
      })
      
      // Debug: Log raw response
      console.log('[Raw API Response]', response);
      
      // Debug: Log response to verify token
      console.log('[Login Response]', {
        hasAccessToken: !!response.accessToken,
        hasUser: !!response.user,
        tokenPreview: response.accessToken?.substring(0, 20) + '...',
      });
      
      // Capture return URL and user ID BEFORE login (in case login clears them)
      const savedReturnUrl = useAuthStore.getState().returnUrl;
      const savedReturnUrlUserId = useAuthStore.getState().returnUrlUserId;
      
      console.log('[Login] Before login - saved state:', { 
        savedReturnUrl, 
        savedReturnUrlUserId,
        newUserId: response.user.id 
      });
      
      // Store authentication data (refreshToken is in HttpOnly cookie)
      login(response.user, response.accessToken)

      // Handle Remember Me
      if (values.rememberMe) {
        localStorage.setItem('rememberedUsername', values.username)
      } else {
        localStorage.removeItem('rememberedUsername')
      }
      
      // Debug: Verify localStorage
      console.log('[After Login]', {
        localStorageToken: localStorage.getItem('token')?.substring(0, 20) + '...',
      });
      
      // Determine redirect destination based on role
      let redirectTo = response.user.role === 'superadmin' ? '/super-admin/companies' : '/dashboard';
      if (response.user.role !== 'superadmin') {
        if (savedReturnUrl && savedReturnUrlUserId && savedReturnUrlUserId === response.user.id) {
          redirectTo = savedReturnUrl;
        } else if (savedReturnUrl && !savedReturnUrlUserId) {
          redirectTo = savedReturnUrl;
        }
      }
      
      clearReturnUrl();
      
      // Check if user has companies to select
      if (response.companies && response.companies.length > 0) {
        console.log('[Login] User has companies, showing selector');
        setPendingCompanies(response.companies);
        setPendingBranches(response.branches || []);
        setPendingRedirect(redirectTo);
        setShowCompanySelector(true);
      } else {
        // No companies (backward compatibility) - redirect directly
        console.log('[Login] No companies, redirecting directly');
        clearTenant();
        router.push(redirectTo);
      }
    } catch (err) {
      const apiError = err as ApiError
      if (apiError.statusCode === 401) {
        setError(t('errors.loginFailed'))
      } else if (apiError.statusCode === 403) {
        setError(t('errors.noActiveCompany'))
      } else {
        setError(apiError.message || t('errors.loginFailed'))
      }
      console.error('Login error:', apiError)
    } finally {
      setLoading(false)
    }
  }

  // Handle company selection
  const handleCompanySelect = async (company: Company, branches: Branch[]) => {
    try {
      setLoading(true);
      
      // Debug: Verify token is available before calling switch
      const tokenFromStorage = localStorage.getItem('token');
      console.log('[handleCompanySelect] Before switch:', {
        hasToken: !!tokenFromStorage,
        tokenPreview: tokenFromStorage?.substring(0, 20) + '...',
      });
      
      // Call switch API to get new tokens with tenant context
      const response = await switchTenant({
        companyId: company.id,
        branchIds: branches.map(b => b.id),
      });
      
      // Update token (refreshToken is in HttpOnly cookie)
      updateToken(response.accessToken);
      
      // Update tenant store
      setCompanies(pendingCompanies.map(c => ({
        id: c.id,
        code: c.code,
        name: c.name,
        status: c.status,
        role: c.role,
      })));
      setBranches(pendingBranches.map(b => ({
        id: b.id,
        companyId: b.companyId,
        code: b.code,
        name: b.name,
        status: b.status,
        isDefault: b.isDefault,
      })));
      // Update tenant store - use first branch since we now expect single branch
      const selectedBranch = response.branches[0];
      if (selectedBranch) {
        switchTenantStore(response.company, selectedBranch);
      }
      
      setShowCompanySelector(false);
      router.push(pendingRedirect);
    } catch (err) {
      console.error('Company selection error:', err);
      setError(t('errors.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <img 
            src="/icon-192x192.png" 
            alt="System Logo" 
            className="mx-auto w-16 h-16 rounded-full object-contain bg-white shadow-md"
          />
          <div>
            <CardTitle className="text-2xl font-bold">{t('welcomeBack')}</CardTitle>
            <CardDescription className="text-sm text-gray-600 mt-1">
              {t('signInDescription')}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <DismissibleAlert
              variant="error"
              className="mb-4"
              onDismiss={() => setError('')}
              autoDismiss={false}
            >
              {error}
            </DismissibleAlert>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('username')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input 
                          placeholder={t('usernamePlaceholder')} 
                          className="pl-10"
                          onFocus={(e) => e.target.select()}
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('password')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input 
                          type={showPassword ? "text" : "password"}
                          placeholder={t('passwordPlaceholder')} 
                          className="pl-10 pr-10"
                          onFocus={(e) => e.target.select()}
                          {...field} 
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rememberMe"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm font-normal cursor-pointer">
                        {t('rememberMe')}
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700" 
                disabled={loading}
              >
                {loading ? t('loggingIn') : t('login')}
              </Button>
            </form>
          </Form>
          <div className="mt-6 text-center text-xs text-gray-500">
            © {new Date().getFullYear()} {process.env.NEXT_PUBLIC_COMPANY_NAME || 'HRMS'}. All Rights Reserved
            {version && <span className="ml-2 text-gray-400">v{version}</span>}
          </div>
        </CardContent>
      </Card>

      {/* Company Selector Dialog */}
      <CompanySelector
        open={showCompanySelector}
        companies={pendingCompanies.map(c => ({
          id: c.id,
          code: c.code,
          name: c.name,
          status: c.status,
          role: c.role,
        }))}
        branches={pendingBranches.map(b => ({
          id: b.id,
          companyId: b.companyId,
          code: b.code,
          name: b.name,
          status: b.status,
          isDefault: b.isDefault,
        }))}
        onSelect={handleCompanySelect}
      />
    </div>
  );
}
