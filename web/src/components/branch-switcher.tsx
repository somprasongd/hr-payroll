'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { useTenantStore, Branch } from '@/store/tenant-store';
import { useAuthStore } from '@/store/auth-store';
import { switchTenant } from '@/services/tenant.service';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export function BranchSwitcher() {
  const t = useTranslations('Tenant');
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  const { 
    currentCompany, 
    currentBranch,  // Changed from currentBranches
    availableBranches,
    switchTenant: switchTenantStore 
  } = useTenantStore();
  
  const { updateTokens } = useAuthStore();

  // If no tenant context, don't render
  if (!currentCompany) {
    return null;
  }

  const handleBranchSelect = async (branch: Branch) => {
    // If same branch, do nothing
    if (currentBranch?.id === branch.id) {
      return;
    }

    setIsLoading(true);
    try {
      // Call API to switch tenant with single branch
      const response = await switchTenant({
        companyId: currentCompany.id,
        branchIds: [branch.id], // Single branch
      });

      // Update auth tokens
      updateTokens(response.accessToken, response.refreshToken);

      // Update tenant store - response.branches[0] since we now expect single branch
      const selectedBranch = response.branches[0];
      if (selectedBranch) {
        switchTenantStore(response.company, selectedBranch);
      }

      toast({
        title: t('success'),
        description: t('branchSwitched'),
      });

      // Reload page data to reflect new branch context
      router.refresh();
    } catch {
      toast({
        title: t('error'),
        description: t('switchFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedBranchName = currentBranch?.name || t('selectBranch');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 max-w-[200px]"
          disabled={isLoading}
        >
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="truncate">{selectedBranchName}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          {currentCompany.name}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t('selectBranch')}
        </DropdownMenuLabel>
        {availableBranches.map((branch) => {
          const isSelected = currentBranch?.id === branch.id;
          return (
            <DropdownMenuItem
              key={branch.id}
              onClick={() => handleBranchSelect(branch)}
              disabled={isLoading}
              className="flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2">
                {branch.name}
                {branch.isDefault && (
                  <span className="text-xs text-muted-foreground">({t('default')})</span>
                )}
              </span>
              {isSelected && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
