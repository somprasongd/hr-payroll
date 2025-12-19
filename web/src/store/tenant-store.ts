import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Company {
  id: string;
  code: string;
  name: string;
  status: string;
  role: string;
}

export interface Branch {
  id: string;
  companyId: string;
  code: string;
  name: string;
  status: string;
  isDefault: boolean;
}

interface TenantState {
  // Current selection
  currentCompany: Company | null;
  currentBranches: Branch[];

  // Available options
  availableCompanies: Company[];
  availableBranches: Branch[];

  // Hydration state
  _hasHydrated: boolean;

  // Actions
  setCompanies: (companies: Company[]) => void;
  setBranches: (branches: Branch[]) => void;
  selectCompany: (company: Company) => void;
  selectBranches: (branches: Branch[]) => void;
  switchTenant: (company: Company, branches: Branch[]) => void;
  clearTenant: () => void;
  setHasHydrated: (state: boolean) => void;
  refreshAvailableBranches: (branches: Branch[]) => void;
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set) => ({
      currentCompany: null,
      currentBranches: [],
      availableCompanies: [],
      availableBranches: [],
      _hasHydrated: false,

      setCompanies: (companies) => {
        set({ availableCompanies: companies });
      },

      setBranches: (branches) => {
        set({ availableBranches: branches });
      },

      selectCompany: (company) => {
        set({ currentCompany: company });
      },

      selectBranches: (branches) => {
        set({ currentBranches: branches });
      },

      switchTenant: (company, branches) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("tenantCompanyId", company.id);
          localStorage.setItem(
            "tenantBranchIds",
            branches.map((b) => b.id).join(",")
          );
        }
        set({
          currentCompany: company,
          currentBranches: branches,
        });
      },

      clearTenant: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("tenantCompanyId");
          localStorage.removeItem("tenantBranchIds");
        }
        set({
          currentCompany: null,
          currentBranches: [],
          availableCompanies: [],
          availableBranches: [],
        });
      },

      setHasHydrated: (state) => {
        set({ _hasHydrated: state });
      },

      refreshAvailableBranches: (branches) => {
        set((state) => {
          // Filter only active branches for available selection
          const activeBranches = branches.filter(b => b.status === 'active');
          
          // Keep currentBranches in sync - remove deleted/archived branches
          const validCurrentBranches = state.currentBranches.filter(
            current => activeBranches.some(active => active.id === current.id)
          );
          
          // If no valid current branches, select default branch
          let finalCurrentBranches = validCurrentBranches;
          if (validCurrentBranches.length === 0 && activeBranches.length > 0) {
            const defaultBranch = activeBranches.find(b => b.isDefault) || activeBranches[0];
            finalCurrentBranches = [defaultBranch];
          }
          
          return {
            availableBranches: activeBranches,
            currentBranches: finalCurrentBranches,
          };
        });
      },
    }),
    {
      name: "tenant-storage",
      partialize: (state) => ({
        currentCompany: state.currentCompany,
        currentBranches: state.currentBranches,
        availableCompanies: state.availableCompanies,
        availableBranches: state.availableBranches,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) {
          console.error('[TenantStore] Hydration failed:', error);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('tenant-storage');
          }
          useTenantStore.setState({ _hasHydrated: true });
        } else {
          state.setHasHydrated(true);
        }
      },
    }
  )
);

// Helper functions
export function getTenantHeaders(): Record<string, string> {
  const store = useTenantStore.getState();
  const headers: Record<string, string> = {};

  if (store.currentCompany) {
    headers["X-Company-ID"] = store.currentCompany.id;
  }

  if (store.currentBranches.length > 0) {
    headers["X-Branch-ID"] = store.currentBranches.map((b) => b.id).join(",");
  }

  return headers;
}

export function getCurrentCompanyId(): string | null {
  return useTenantStore.getState().currentCompany?.id ?? null;
}

export function getCurrentBranchIds(): string[] {
  return useTenantStore.getState().currentBranches.map((b) => b.id);
}
