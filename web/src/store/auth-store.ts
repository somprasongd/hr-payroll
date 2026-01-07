import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: string;
  username: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  returnUrl: string | null;
  returnUrlUserId: string | null;
  _hasHydrated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  setReturnUrl: (url: string | null, userId?: string | null) => void;
  clearReturnUrl: () => void;
  updateToken: (token: string) => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      returnUrl: null,
      returnUrlUserId: null,
      _hasHydrated: false,
      login: (user, token) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("token", token);
          // Note: refreshToken is stored in HttpOnly cookie, not localStorage
        }
        set({ user, token, isAuthenticated: true });
      },
      logout: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("token");
          // Clean up any legacy refreshToken if it exists
          localStorage.removeItem("refreshToken");
        }
        // Clear returnUrl and returnUrlUserId on manual logout
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          returnUrl: null,
          returnUrlUserId: null,
        });
      },
      setReturnUrl: (url, userId) => {
        set({ returnUrl: url, returnUrlUserId: userId ?? null });
      },
      clearReturnUrl: () => {
        set({ returnUrl: null, returnUrlUserId: null });
      },
      updateToken: (token) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("token", token);
        }
        set({ token });
      },
      setHasHydrated: (state) => {
        set({ _hasHydrated: state });
      },
    }),
    {
      name: 'auth-storage',
      version: 1,
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          // Explicitly remove refreshToken from existing persisted state
          if (persistedState && typeof persistedState === 'object') {
            delete persistedState.refreshToken;
          }
        }
        return persistedState;
      },
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        // refreshToken is NOT here, so it won't be saved anymore
        isAuthenticated: state.isAuthenticated,
        returnUrl: state.returnUrl,
        returnUrlUserId: state.returnUrlUserId,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) {
          console.error('[AuthStore] Hydration failed:', error);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth-storage');
            localStorage.removeItem('refreshToken');
          }
          useAuthStore.setState({ _hasHydrated: true });
        } else {
          // Cleanup legacy standalone refreshToken key
          if (typeof window !== 'undefined') {
            localStorage.removeItem('refreshToken');
          }
          state.setHasHydrated(true);
        }
      },
    }
  )
);
