'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Building2, MoreHorizontal, Pencil, Star, Pause, Archive, Play, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  getBranches, 
  createBranch, 
  updateBranch, 
  setDefaultBranch,
  changeBranchStatus,
  getBranchEmployeeCount,
  deleteBranch,
} from '@/services/tenant.service';
import { Branch, useTenantStore } from '@/store/tenant-store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

type StatusAction = 'suspend' | 'archive' | 'activate';

export default function BranchesPage() {
  const t = useTranslations('Branches');
  const tCommon = useTranslations('Common');
  const { toast } = useToast();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [statusAction, setStatusAction] = useState<StatusAction>('suspend');
  const [employeeCount, setEmployeeCount] = useState(0);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState({ code: '', name: '' });
  const [saving, setSaving] = useState(false);

  const { refreshAvailableBranches } = useTenantStore();

  const fetchBranches = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getBranches();
      setBranches(data);
      // Refresh the branch switcher dropdown with latest branches
      refreshAvailableBranches(data);
    } catch {
      toast({ title: tCommon('error'), description: t('fetchError'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, tCommon, t, refreshAvailableBranches]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const handleCreate = async () => {
    if (!formData.code || !formData.name) return;
    setSaving(true);
    try {
      await createBranch(formData);
      toast({ title: tCommon('success'), description: t('createSuccess') });
      setIsCreateOpen(false);
      setFormData({ code: '', name: '' });
      fetchBranches();
    } catch {
      toast({ title: tCommon('error'), description: t('createError'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedBranch || !formData.code || !formData.name) return;
    setSaving(true);
    try {
      await updateBranch(selectedBranch.id, { ...formData, status: selectedBranch.status });
      toast({ title: tCommon('success'), description: t('updateSuccess') });
      setIsEditOpen(false);
      setSelectedBranch(null);
      fetchBranches();
    } catch {
      toast({ title: tCommon('error'), description: t('updateError'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (branch: Branch) => {
    try {
      await setDefaultBranch(branch.id);
      toast({ title: tCommon('success'), description: t('setDefaultSuccess') });
      fetchBranches();
    } catch {
      toast({ title: tCommon('error'), description: t('setDefaultError'), variant: 'destructive' });
    }
  };

  const handleStatusChange = async () => {
    if (!selectedBranch) return;
    setSaving(true);
    try {
      const newStatus = statusAction === 'suspend' ? 'suspended' 
        : statusAction === 'archive' ? 'archived' 
        : 'active';
      await changeBranchStatus(selectedBranch.id, newStatus);
      toast({ title: tCommon('success'), description: t('statusChange.success') });
      setIsStatusOpen(false);
      setSelectedBranch(null);
      fetchBranches();
    } catch {
      toast({ title: tCommon('error'), description: t('statusChange.error'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (branch: Branch) => {
    // Rule 2: Cannot edit suspended or archived branches
    if (branch.status === 'suspended' || branch.status === 'archived') {
      toast({ title: tCommon('error'), description: t('cannotEdit'), variant: 'destructive' });
      return;
    }
    setSelectedBranch(branch);
    setFormData({ code: branch.code, name: branch.name });
    setIsEditOpen(true);
  };

  const openStatusChange = async (branch: Branch, action: StatusAction) => {
    // Rule 1: Cannot change status of default branch
    if (branch.isDefault && action !== 'activate') {
      toast({ title: tCommon('error'), description: t('statusChange.cannotChangeDefault'), variant: 'destructive' });
      return;
    }

    setSelectedBranch(branch);
    setStatusAction(action);
    setEmployeeCount(0);
    
    // For archive action, get employee count first
    if (action === 'archive') {
      try {
        const count = await getBranchEmployeeCount(branch.id);
        setEmployeeCount(count);
      } catch {
        // Ignore error here, will show confirmation anyway
      }
    }
    
    setIsStatusOpen(true);
  };

  const getStatusConfirmMessage = () => {
    if (!selectedBranch) return '';
    const name = selectedBranch.name;
    
    switch (statusAction) {
      case 'suspend':
        return t('statusChange.confirmSuspend', { name });
      case 'archive':
        return employeeCount > 0 
          ? t('statusChange.confirmArchiveWithEmployees', { name, count: employeeCount })
          : t('statusChange.confirmArchive', { name });
      case 'activate':
        return t('statusChange.confirmActivate', { name });
      default:
        return '';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'suspended': return 'outline';
      case 'archived': return 'secondary';
      default: return 'default';
    }
  };

  const canEdit = (branch: Branch) => branch.status === 'active';
  const canSuspend = (branch: Branch) => branch.status === 'active' && !branch.isDefault;
  const canArchive = (branch: Branch) => (branch.status === 'active' || branch.status === 'suspended') && !branch.isDefault;
  const canActivate = (branch: Branch) => branch.status === 'suspended' || branch.status === 'archived';
  const canDelete = (branch: Branch) => branch.status === 'archived' && !branch.isDefault;

  const openDeleteConfirm = (branch: Branch) => {
    setSelectedBranch(branch);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedBranch) return;
    setSaving(true);
    try {
      await deleteBranch(selectedBranch.id);
      toast({ title: tCommon('success'), description: t('deleteSuccess') });
      setIsDeleteOpen(false);
      setSelectedBranch(null);
      fetchBranches();
    } catch {
      toast({ title: tCommon('error'), description: t('deleteError'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-muted-foreground hidden sm:block">{t('description')}</p>
          </div>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setFormData({ code: '', name: '' })}>
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('createButton')}</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('createTitle')}</DialogTitle>
              <DialogDescription>{t('createDescription')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="code">{t('fields.code')}</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder={t('placeholders.code')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">{t('fields.name')}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('placeholders.name')}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                {tCommon('cancel')}
              </Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? tCommon('saving') : tCommon('create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('fields.code')}</TableHead>
              <TableHead>{t('fields.name')}</TableHead>
              <TableHead>{t('fields.status')}</TableHead>
              <TableHead className="w-[100px]">{tCommon('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  {tCommon('loading')}
                </TableCell>
              </TableRow>
            ) : branches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  {t('noData')}
                </TableCell>
              </TableRow>
            ) : (
              branches.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell className="font-medium">{branch.code}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {branch.name}
                      {branch.isDefault && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="h-3 w-3 mr-1" />
                          {t('default')}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(branch.status)}>
                      {t(`status.${branch.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canEdit(branch) && (
                          <DropdownMenuItem onClick={() => openEdit(branch)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            {tCommon('edit')}
                          </DropdownMenuItem>
                        )}
                        {!branch.isDefault && branch.status === 'active' && (
                          <DropdownMenuItem onClick={() => handleSetDefault(branch)}>
                            <Star className="h-4 w-4 mr-2" />
                            {t('setDefault')}
                          </DropdownMenuItem>
                        )}
                        
                        <DropdownMenuSeparator />
                        
                        {/* Status change options */}
                        {canSuspend(branch) && (
                          <DropdownMenuItem onClick={() => openStatusChange(branch, 'suspend')}>
                            <Pause className="h-4 w-4 mr-2" />
                            {t('statusChange.suspend')}
                          </DropdownMenuItem>
                        )}
                        {canArchive(branch) && (
                          <DropdownMenuItem onClick={() => openStatusChange(branch, 'archive')}>
                            <Archive className="h-4 w-4 mr-2" />
                            {t('statusChange.archive')}
                          </DropdownMenuItem>
                        )}
                        {canActivate(branch) && (
                          <DropdownMenuItem onClick={() => openStatusChange(branch, 'activate')}>
                            <Play className="h-4 w-4 mr-2" />
                            {t('statusChange.activate')}
                          </DropdownMenuItem>
                        )}
                        {canDelete(branch) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => openDeleteConfirm(branch)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {tCommon('delete')}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editTitle')}</DialogTitle>
            <DialogDescription>{t('editDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-code">{t('fields.code')}</Label>
              <Input
                id="edit-code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">{t('fields.name')}</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving ? tCommon('saving') : tCommon('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Confirmation */}
      <AlertDialog open={isStatusOpen} onOpenChange={setIsStatusOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('statusChange.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {getStatusConfirmMessage()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleStatusChange} disabled={saving}>
              {saving ? tCommon('saving') : tCommon('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteDescription', { name: selectedBranch?.name || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? tCommon('saving') : tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

