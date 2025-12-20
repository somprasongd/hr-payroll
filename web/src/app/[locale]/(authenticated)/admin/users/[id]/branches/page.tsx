'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Save, Building2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Link } from '@/i18n/routing';
import { 
  getBranches, 
  getUserBranches, 
  setUserBranches,
  BranchAccess 
} from '@/services/tenant.service';
import { authService } from '@/services/auth.service';
import { userService } from '@/services/user.service';
import { Branch, useTenantStore } from '@/store/tenant-store';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function UserBranchesPage() {
  const params = useParams();
  const userId = params.id as string;
  const t = useTranslations('UserBranches');
  const tCommon = useTranslations('Common');
  const { toast } = useToast();

  const [username, setUsername] = useState<string>('');
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState<Set<string>>(new Set());
  const [initialBranchIds, setInitialBranchIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { user: currentUser } = useAuthStore();
  const { refreshAvailableBranches } = useTenantStore();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch user info
      const users = await userService.getUsers({ page: 1, limit: 100 });
      const user = users.data.find(u => u.id === userId);
      if (user) {
        setUsername(user.username);
      }

      // Fetch all branches
      const branches = await getBranches();
      setAllBranches(branches);

      // Fetch user's current branches
      const userBranches = await getUserBranches(userId);
      const branchIds = new Set((userBranches || []).map(b => b.branchId));
      setSelectedBranchIds(branchIds);
      setInitialBranchIds(new Set(branchIds));
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast({ 
        title: tCommon('error'), 
        description: t('fetchError'), 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  }, [userId, toast, tCommon, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleBranch = (branchId: string) => {
    if (selectedBranchIds.has(branchId)) {
      // Prevent deselecting if only 1 branch remains
      if (selectedBranchIds.size <= 1) {
        toast({ 
          title: tCommon('error'), 
          description: t('mustSelectOne'), 
          variant: 'destructive' 
        });
        return;
      }
      
      const next = new Set(selectedBranchIds);
      next.delete(branchId);
      setSelectedBranchIds(next);
    } else {
      const next = new Set(selectedBranchIds);
      next.add(branchId);
      setSelectedBranchIds(next);
    }
  };

  const handleSelectAll = () => {
    setSelectedBranchIds(new Set(allBranches.map(b => b.id)));
  };

  const handleReset = () => {
    setSelectedBranchIds(new Set(initialBranchIds));
  };

  const handleSave = async () => {
    // Validate at least 1 branch is selected
    if (selectedBranchIds.size === 0) {
      toast({ 
        title: tCommon('error'), 
        description: t('mustSelectOne'), 
        variant: 'destructive' 
      });
      return;
    }
    
    try {
      setSaving(true);
      await setUserBranches(userId, Array.from(selectedBranchIds));
      
      // If saving branches for the currently logged-in user, refresh the branch switcher dropdown
      if (currentUser && currentUser.id === userId) {
        try {
          const userContext = await authService.getUserCompanies();
          if (userContext.branches) {
            refreshAvailableBranches(userContext.branches as Branch[]);
          }
        } catch (e) {
          console.warn('Failed to refresh user branches for dropdown:', e);
        }
      }
      
      toast({ 
        title: tCommon('success'), 
        description: t('saveSuccess') 
      });
    } catch (error) {
      console.error('Failed to save:', error);
      toast({ 
        title: tCommon('error'), 
        description: t('saveError'), 
        variant: 'destructive' 
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('title', { username })}
          </h1>
          <p className="text-muted-foreground hidden sm:block">
            {t('description')}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {t('branchList')}
              </CardTitle>
              <CardDescription>
                {t('selectBranches', { count: selectedBranchIds.size })}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={selectedBranchIds.size === allBranches.length ? handleReset : handleSelectAll}
              >
                {selectedBranchIds.size === allBranches.length ? (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {tCommon('reset')}
                  </>
                ) : (
                  t('selectAll')
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {allBranches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('noBranches')}
            </div>
          ) : (
            <div className="space-y-3">
              {allBranches.map((branch) => (
                <div 
                  key={branch.id}
                  className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer"
                  onClick={() => handleToggleBranch(branch.id)}
                >
                  <Checkbox
                    checked={selectedBranchIds.has(branch.id)}
                    onCheckedChange={() => handleToggleBranch(branch.id)}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{branch.name}</div>
                    <div className="text-sm text-muted-foreground">{branch.code}</div>
                  </div>
                  {branch.isDefault && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                      {t('default')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href="/admin/users">{tCommon('cancel')}</Link>
        </Button>

        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? tCommon('saving') : tCommon('save')}
        </Button>
      </div>
    </div>
  );
}
