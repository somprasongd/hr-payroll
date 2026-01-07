/**
 * Axios Instance with Interceptors
 * 
 * Handles automatic token refresh when access token expires
 * Automatically adds tenant headers (X-Company-ID, X-Branch-ID) to requests
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_CONFIG } from '@/config/api';
import { useAuthStore } from '@/store/auth-store';
import { useTenantStore } from '@/store/tenant-store';
import { removeLocalePrefix } from '@/lib/i18n-utils';

// Create axios instance
export const axiosInstance = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Required for HttpOnly cookies
});

// Track refresh token promise to prevent multiple refresh calls
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });

  failedQueue = [];
};

// Request interceptor - Add token and tenant headers to requests
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    let token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    
    // Fallback to store if not in localStorage (e.g. after hydration but before manual sync?)
    if (!token) {
       token = useAuthStore.getState().token;
    }

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add tenant headers from store
    if (typeof window !== 'undefined' && config.headers) {
      const tenantState = useTenantStore.getState();
      const { currentCompany, currentBranch } = tenantState;
      
      if (currentCompany?.id) {
        config.headers['X-Company-ID'] = currentCompany.id;
      }
      
      if (currentBranch?.id) {
        config.headers['X-Branch-ID'] = currentBranch.id;
      }
    }

    // Debug logging in development
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log('[Axios Request]', {
        method: config.method?.toUpperCase(),
        url: config.url,
        hasToken: !!token,
        tenantHeaders: {
          companyId: config.headers?.['X-Company-ID'],
          branchId: config.headers?.['X-Branch-ID'],
        },
      });
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle 401 and refresh token
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Skip 401 handling for login, refresh, and switch requests
    // (switch needs special handling since it's called right after login)
    if (originalRequest?.url?.includes('/auth/login') || 
        originalRequest?.url?.includes('/auth/refresh') ||
        originalRequest?.url?.includes('/auth/switch')) {
      return Promise.reject(error);
    }

    // If error is not 401 or no config, reject immediately
    if (!originalRequest || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    // If already retried, don't retry again
    if (originalRequest._retry) {
      // Refresh token also failed, logout user
      if (typeof window !== 'undefined') {
        const { logout, setReturnUrl, user } = useAuthStore.getState();
        const currentPath = window.location.pathname;
        const currentUserId = user?.id;
        
        logout();
        
        // Save return URL and user ID AFTER logout (because logout clears them)
        if (currentPath !== '/' && !currentPath.includes('/login')) {
          const pathWithoutLocale = removeLocalePrefix(currentPath);
          setReturnUrl(pathWithoutLocale, currentUserId);
        }
        
        // Redirect to login
        window.location.href = '/';
      }
      return Promise.reject(error);
    }

    // If currently refreshing, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return axiosInstance(originalRequest);
        })
        .catch((err) => {
          return Promise.reject(err);
        });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // Call refresh token endpoint - no body needed, API reads HttpOnly cookie
      const response = await axios.post(
        `${API_CONFIG.baseURL}/auth/refresh`,
        {}, // Empty body - refresh token is in HttpOnly cookie
        { withCredentials: true } // Send cookies
      );

      const { accessToken: newToken } = response.data;

      // Update access token in store and localStorage
      // Note: refresh token is managed via HttpOnly cookie, not stored client-side
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', newToken);
        const { updateToken } = useAuthStore.getState();
        updateToken(newToken);
      }

      // Process queued requests
      processQueue(null, newToken);

      // Retry original request with new token
      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
      }

      isRefreshing = false;
      return axiosInstance(originalRequest);
    } catch (refreshError) {
      // Log detailed refresh error for debugging
      if (axios.isAxiosError(refreshError)) {
        console.error('[Axios] Refresh token failed:', {
          status: refreshError.response?.status,
          data: refreshError.response?.data,
          message: refreshError.message
        });
      } else {
        console.error('[Axios] Refresh token failed with non-axios error:', refreshError);
      }

      processQueue(refreshError, null);
      isRefreshing = false;

      // Refresh failed, logout user
      if (typeof window !== 'undefined') {
        const { logout, setReturnUrl, user } = useAuthStore.getState();
        const currentPath = window.location.pathname;
        const currentUserId = user?.id;
        
        logout();
        
        // Save return URL and user ID AFTER logout (because logout clears them)
        if (currentPath !== '/' && !currentPath.includes('/login')) {
          const pathWithoutLocale = removeLocalePrefix(currentPath);
          setReturnUrl(pathWithoutLocale, currentUserId);
        }
        
        window.location.href = '/';
      }

      return Promise.reject(refreshError);
    }
  }
);

export default axiosInstance;
