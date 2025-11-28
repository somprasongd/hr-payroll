import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  username: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  returnUrl: string | null;
  _hasHydrated: boolean;
  login: (user: User, token: string, refreshToken: string) => void;
  logout: () => void;
  setReturnUrl: (url: string | null) => void;
  updateToken: (token: string) => void;
  updateTokens: (token: string, refreshToken: string) => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      returnUrl: null,
      _hasHydrated: false,
      login: (user, token, refreshToken) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('token', token);
          localStorage.setItem('refreshToken', refreshToken);
        }
        set({ user, token, refreshToken, isAuthenticated: true });
      },
      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
        }
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false, returnUrl: null });
      },
      setReturnUrl: (url) => {
        set({ returnUrl: url });
      },
      updateToken: (token) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('token', token);
        }
        set({ token });
      },
      updateTokens: (token, refreshToken) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('token', token);
          localStorage.setItem('refreshToken', refreshToken);
        }
        set({ token, refreshToken });
      },
      setHasHydrated: (state) => {
        set({ _hasHydrated: state });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token, 
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        returnUrl: state.returnUrl,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
