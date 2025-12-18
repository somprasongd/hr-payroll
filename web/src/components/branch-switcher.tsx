'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Building2, ChevronDown } from 'lucide-react';
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
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export function BranchSwitcher() {
  const t = useTranslations('Tenant');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  const { 
    currentCompany, 
    currentBranches, 
    availableBranches,
    switchTenant: switchTenantStore 
  } = useTenantStore();
  
  const { updateTokens } = useAuthStore();

  // If no tenant context, don't render
  if (!currentCompany) {
    return null;
  }

  const handleBranchToggle = async (branch: Branch) => {
    setIsLoading(true);
    try {
      // Toggle branch selection
      const currentIds = currentBranches.map(b => b.id);
      let newBranchIds: string[];
      
      if (currentIds.includes(branch.id)) {
        // Remove branch (but keep at least one)
        if (currentIds.length === 1) {
          toast({
            title: t('error'),
            description: t('mustSelectOneBranch'),
            variant: 'destructive',
          });
          return;
        }
        newBranchIds = currentIds.filter(id => id !== branch.id);
      } else {
        // Add branch
        newBranchIds = [...currentIds, branch.id];
      }

      // Call API to switch tenant
      const response = await switchTenant({
        companyId: currentCompany.id,
        branchIds: newBranchIds,
      });

      // Update auth tokens
      updateTokens(response.accessToken, response.refreshToken);

      // Update tenant store
      switchTenantStore(response.company, response.branches);

      toast({
        title: t('success'),
        description: t('branchSwitched'),
      });
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

  const selectedBranchNames = currentBranches.length > 0
    ? currentBranches.length === 1
      ? currentBranches[0].name
      : `${currentBranches.length} ${t('branches')}`
    : t('selectBranch');

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
          <span className="truncate">{selectedBranchNames}</span>
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
          {t('selectBranches')}
        </DropdownMenuLabel>
        {availableBranches.map((branch) => {
          const isSelected = currentBranches.some(b => b.id === branch.id);
          return (
            <DropdownMenuCheckboxItem
              key={branch.id}
              checked={isSelected}
              onCheckedChange={() => handleBranchToggle(branch)}
              disabled={isLoading}
            >
              <span className="flex items-center gap-2">
                {branch.name}
                {branch.isDefault && (
                  <span className="text-xs text-muted-foreground">({t('default')})</span>
                )}
              </span>
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
