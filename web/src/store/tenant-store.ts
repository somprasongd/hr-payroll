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
  currentBranch: Branch | null;  // Changed from currentBranches: Branch[]

  // Available options
  availableCompanies: Company[];
  availableBranches: Branch[];

  // Hydration state
  _hasHydrated: boolean;

  // Actions
  setCompanies: (companies: Company[]) => void;
  setBranches: (branches: Branch[]) => void;
  selectCompany: (company: Company) => void;
  selectBranch: (branch: Branch | null) => void;  // Changed from selectBranches
  switchTenant: (company: Company, branch: Branch) => void;  // Changed signature
  clearTenant: () => void;
  setHasHydrated: (state: boolean) => void;
  refreshAvailableBranches: (branches: Branch[]) => void;
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set) => ({
      currentCompany: null,
      currentBranch: null,  // Changed from currentBranches: []
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

      selectBranch: (branch) => {  // Changed from selectBranches
        set({ currentBranch: branch });
      },

      switchTenant: (company, branch) => {  // Changed signature
        if (typeof window !== "undefined") {
          localStorage.setItem("tenantCompanyId", company.id);
          localStorage.setItem("tenantBranchId", branch.id);  // Changed from tenantBranchIds
        }
        set({
          currentCompany: company,
          currentBranch: branch,  // Changed from currentBranches: branches
        });
      },

      clearTenant: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("tenantCompanyId");
          localStorage.removeItem("tenantBranchId");  // Changed from tenantBranchIds
        }
        set({
          currentCompany: null,
          currentBranch: null,  // Changed from currentBranches: []
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
          
          // Keep current branch if still valid
          let finalCurrentBranch: Branch | null = null;
          
          if (state.currentBranch && activeBranches.some(b => b.id === state.currentBranch?.id)) {
            // Current branch is still valid
            finalCurrentBranch = state.currentBranch;
          } else if (activeBranches.length > 0) {
            // Select default branch or first branch
            finalCurrentBranch = activeBranches.find(b => b.isDefault) || activeBranches[0];
          }
          
          return {
            availableBranches: activeBranches,
            currentBranch: finalCurrentBranch,
          };
        });
      },
    }),
    {
      name: "tenant-storage",
      partialize: (state) => ({
        currentCompany: state.currentCompany,
        currentBranch: state.currentBranch,  // Changed from currentBranches
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

  if (store.currentBranch) {  // Changed from currentBranches
    headers["X-Branch-ID"] = store.currentBranch.id;  // Single value, not joined
  }

  return headers;
}

export function getCurrentCompanyId(): string | null {
  return useTenantStore.getState().currentCompany?.id ?? null;
}

export function getCurrentBranchId(): string | null {  // Changed from getCurrentBranchIds
  return useTenantStore.getState().currentBranch?.id ?? null;
}
