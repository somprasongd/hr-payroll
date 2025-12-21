"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { Building2, ChevronDown, Check } from "lucide-react";
import { useTenantStore, Branch } from "@/store/tenant-store";
import { useAuthStore } from "@/store/auth-store";
import { switchTenant } from "@/services/tenant.service";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

/**
 * Detail pages that should redirect to their list page when branch is switched
 * Pattern: regex to match the path, listPath: the path to redirect to
 */
const DETAIL_PAGE_PATTERNS = [
  { pattern: /^\/employees\/[^/]+$/, listPath: "/employees" },
  { pattern: /^\/bonuses\/[^/]+$/, listPath: "/bonuses" },
  { pattern: /^\/salary-raise\/[^/]+$/, listPath: "/salary-raise" },
  { pattern: /^\/debt\/[^/]+$/, listPath: "/debt" },
  { pattern: /^\/payroll\/[^/]+$/, listPath: "/payroll" },
  { pattern: /^\/payouts\/pt\/[^/]+$/, listPath: "/payouts/pt" },
];

/**
 * BranchSwitcher component allows users to switch between different branches within a tenant.
 * It's located in the main navigation and handles branch selection, context switching,
 * and redirection if on a detail page.
 */
export function BranchSwitcher() {
  const t = useTranslations("Common");
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  
  const { 
    currentCompany, 
    currentBranch, 
    availableBranches, 
    switchTenant: switchTenantStore 
  } = useTenantStore();
  
  const { updateTokens } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const branches = availableBranches || [];

  const handleBranchSelect = async (branch: Branch) => {
    if (branch.id === currentBranch?.id || !currentCompany) return;

    try {
      setLoading(true);
      const response = await switchTenant({
        companyId: currentCompany.id,
        branchIds: [branch.id]
      });
      
      updateTokens(response.accessToken, response.refreshToken);
      switchTenantStore(response.company, response.branches[0]);
      
      toast({
        title: "Switched branch",
        description: `Successfully switched to ${branch.name}`,
      });

      const listPath = getListPathIfDetailPage(pathname);
      if (listPath) {
        router.push(listPath);
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to switch branch:", error);
      toast({
        variant: "destructive",
        title: "Switch failed",
        description: "Could not switch to selected branch.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!currentCompany) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="flex items-center gap-2 h-10 px-3 min-w-[180px] justify-between border-gray-200 hover:bg-gray-50 bg-white shadow-sm transition-all"
          disabled={loading}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="bg-blue-50 p-1.5 rounded-md">
              <Building2 className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex flex-col items-start leading-none overflow-hidden">
              <span className="text-[10px] text-gray-500 font-medium uppercase tracking-tight truncate w-full text-left">
                {currentCompany.name}
              </span>
              <span className="text-sm font-semibold truncate w-full text-left flex items-center gap-1.5">
                {currentBranch?.name || "Select Branch"}
                {currentBranch?.isDefault && (
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-normal">
                    {t("default")}
                  </span>
                )}
              </span>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[260px] p-1">
        <div className="px-3 py-2 border-b border-gray-100 mb-1">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">
            {t("branch")}
          </p>
          <p className="text-sm font-bold text-gray-900 truncate">
            {currentCompany.name}
          </p>
        </div>
        <div className="max-h-[300px] overflow-y-auto space-y-0.5">
          {branches.map((branch) => (
            <DropdownMenuItem
              key={branch.id}
              onClick={() => handleBranchSelect(branch)}
              className="px-3 py-2.5 cursor-pointer rounded-md focus:bg-blue-50 focus:text-blue-700 transition-colors"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm">{branch.name}</span>
                    {branch.isDefault && (
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 rounded-full font-normal">
                        {t("default")}
                      </span>
                    )}
                  </div>
                </div>
                {branch.id === currentBranch?.id && (
                  <Check className="h-4 w-4 text-blue-600" />
                )}
              </div>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Returns the list view path if the current pathname matches a detail page pattern.
 * Otherwise returns null.
 * 
 * @param pathname Path without locale prefix (e.g., /employees/123)
 */
function getListPathIfDetailPage(pathname: string): string | null {
  for (const { pattern, listPath } of DETAIL_PAGE_PATTERNS) {
    if (pattern.test(pathname)) {
      return listPath;
    }
  }
  return null;
}
