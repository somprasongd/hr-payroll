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
import { useState, useEffect, useRef } from "react"
import { useTranslations, useLocale } from 'next-intl';
import { User, Lock, Eye, EyeOff, Users, AlertCircle } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useRouter, usePathname } from "@/i18n/routing";
import { authService } from "@/services/auth.service";
import { ApiError } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LoginPage() {
  const t = useTranslations('Index');
  const locale = useLocale();
  const { login, returnUrl, returnUrlUserId, clearReturnUrl, isAuthenticated, _hasHydrated, refreshToken, updateToken, updateTokens, logout } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string>('')
  const [isChecking, setIsChecking] = useState(true)
  const router = useRouter();
  const pathname = usePathname();
  const hasVerified = useRef(false);

  useEffect(() => {
    // Wait for hydration to complete
    if (!_hasHydrated) return;

    // Prevent multiple verifications or loops
    if (hasVerified.current) return;

    console.log('[LoginPage] Checking session', { isAuthenticated, hasRefreshToken: !!refreshToken });

    const verifySession = async () => {
      hasVerified.current = true;

      if (isAuthenticated && refreshToken) {
        try {
          console.log('[LoginPage] Verifying session with refresh token');
          // Verify session by refreshing token
          const response = await authService.refreshToken(refreshToken);
          console.log('[LoginPage] Session verified, updating tokens');
          
          // Update access token and refresh token (if rotated)
          updateTokens(response.accessToken, response.refreshToken || refreshToken);
          
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
  }, [_hasHydrated, isAuthenticated, refreshToken, router, returnUrl, returnUrlUserId, locale, updateToken, updateTokens, logout]);

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
      
      // Debug: Log response to verify token and refreshToken
      console.log('[Login Response]', {
        hasAccessToken: !!response.accessToken,
        hasRefreshToken: !!response.refreshToken,
        hasUser: !!response.user,
        tokenPreview: response.accessToken?.substring(0, 20) + '...',
        refreshTokenPreview: response.refreshToken?.substring(0, 20) + '...',
      });
      
      // Capture return URL and user ID BEFORE login (in case login clears them)
      const savedReturnUrl = useAuthStore.getState().returnUrl;
      const savedReturnUrlUserId = useAuthStore.getState().returnUrlUserId;
      
      console.log('[Login] Before login - saved state:', { 
        savedReturnUrl, 
        savedReturnUrlUserId,
        newUserId: response.user.id 
      });
      
      // Store authentication data (using accessToken as token)
      login(response.user, response.accessToken, response.refreshToken)

      // Handle Remember Me
      if (values.rememberMe) {
        localStorage.setItem('rememberedUsername', values.username)
      } else {
        localStorage.removeItem('rememberedUsername')
      }
      
      // Debug: Verify localStorage
      console.log('[After Login]', {
        localStorageToken: localStorage.getItem('token')?.substring(0, 20) + '...',
        localStorageRefreshToken: localStorage.getItem('refreshToken')?.substring(0, 20) + '...',
      });
      
      // Determine redirect destination
      // If the logged-in user is the same as the one who was redirected to login, use returnUrl
      // Otherwise, redirect to dashboard (different user logged in)
      let redirectTo = '/dashboard';
      if (savedReturnUrl && savedReturnUrlUserId && savedReturnUrlUserId === response.user.id) {
        // Same user - redirect to saved URL
        console.log('[Login] Same user detected, redirecting to saved URL:', savedReturnUrl);
        redirectTo = savedReturnUrl;
      } else if (savedReturnUrl && savedReturnUrlUserId && savedReturnUrlUserId !== response.user.id) {
        // Different user - redirect to dashboard
        console.log('[Login] Different user detected, redirecting to dashboard instead of:', savedReturnUrl);
      } else if (savedReturnUrl && !savedReturnUrlUserId) {
        // No saved user ID (legacy case), use returnUrl
        console.log('[Login] No saved user ID, redirecting to saved URL:', savedReturnUrl);
        redirectTo = savedReturnUrl;
      }
      
      console.log('[Login] Final redirect destination:', redirectTo);
      clearReturnUrl() // Clear return URL and user ID
      router.push(redirectTo)
    } catch (err) {
      const apiError = err as ApiError
      if (apiError.statusCode === 401) {
        setError(t('errors.loginFailed'))
      } else {
        setError(apiError.message || t('errors.loginFailed'))
      }
      console.error('Login error:', apiError)
    } finally {
      setLoading(false)
    }
  }

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
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
            <Users className="w-8 h-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">{t('welcomeBack')}</CardTitle>
            <CardDescription className="text-sm text-gray-600 mt-1">
              {t('signInDescription')}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
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
            {t('copyright')}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
