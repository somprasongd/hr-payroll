'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Plus, Landmark, Pencil, Trash2, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { masterDataService, Bank } from '@/services/master-data.service';
import { GenericDataTable, ActionConfig } from '@/components/common/generic-data-table';
import { ColumnDef } from '@tanstack/react-table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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

export default function BanksPage() {
  const t = useTranslations('Banks');
  const tCommon = useTranslations('Common');
  const locale = useLocale();
  const { toast } = useToast();

  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [formData, setFormData] = useState({ code: '', nameTh: '', nameEn: '' });

  const fetchBanks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await masterDataService.getBanks();
      setBanks(data);
    } catch (error) {
      console.error('Failed to fetch banks:', error);
      toast({
        title: tCommon('error'),
        description: t('errors.fetchFailed'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, tCommon, t]);

  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

  const resetForm = () => {
    setFormData({ code: '', nameTh: '', nameEn: '' });
    setSelectedBank(null);
  };

  const openCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const openEdit = (bank: Bank) => {
    setSelectedBank(bank);
    setFormData({ code: bank.code, nameTh: bank.nameTh, nameEn: bank.nameEn });
    setIsEditOpen(true);
  };

  const openDelete = (bank: Bank) => {
    setSelectedBank(bank);
    setIsDeleteOpen(true);
  };

  const handleCreate = async () => {
    if (!formData.code || !formData.nameTh || !formData.nameEn) {
      toast({
        title: tCommon('error'),
        description: t('errors.saveFailed'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      await masterDataService.createBank(formData);
      toast({ title: tCommon('success'), description: t('success.created') });
      setIsCreateOpen(false);
      resetForm();
      fetchBanks();
    } catch (error) {
      console.error('Failed to create bank:', error);
      toast({
        title: tCommon('error'),
        description: t('errors.saveFailed'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedBank || !formData.code || !formData.nameTh || !formData.nameEn) {
      return;
    }

    try {
      setSaving(true);
      await masterDataService.updateBank(selectedBank.id, formData);
      toast({ title: tCommon('success'), description: t('success.updated') });
      setIsEditOpen(false);
      resetForm();
      fetchBanks();
    } catch (error) {
      console.error('Failed to update bank:', error);
      toast({
        title: tCommon('error'),
        description: t('errors.saveFailed'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedBank) return;

    try {
      setSaving(true);
      await masterDataService.deleteBank(selectedBank.id);
      toast({ title: tCommon('success'), description: t('success.deleted') });
      setIsDeleteOpen(false);
      resetForm();
      fetchBanks();
    } catch (error) {
      console.error('Failed to delete bank:', error);
      toast({
        title: tCommon('error'),
        description: t('errors.deleteFailed'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (bank: Bank, checked: boolean) => {
    try {
      // Optimistic update
      setBanks(prev => prev.map(b => b.id === bank.id ? { ...b, isEnabled: checked } : b));
      
      await masterDataService.toggleBank(bank.id, checked);
      toast({ title: tCommon('success'), description: t('success.statusChanged') });
    } catch (error) {
      console.error('Failed to toggle bank:', error);
      toast({
        title: tCommon('error'),
        description: t('errors.toggleFailed'),
        variant: 'destructive',
      });
      // Revert on failure
      setBanks(prev => prev.map(b => b.id === bank.id ? { ...b, isEnabled: !checked } : b));
    }
  };

  const getDisplayName = (bank: Bank) => {
    return locale === 'th' ? bank.nameTh : bank.nameEn;
  };

  // Define columns for GenericDataTable
  const columns: ColumnDef<Bank>[] = useMemo(() => [
    {
      accessorKey: 'code',
      header: t('fields.code'),
      cell: ({ row }) => <span className="font-mono">{row.original.code}</span>,
    },
    {
      accessorKey: 'nameTh',
      header: t('fields.nameTh'),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span>{row.original.nameTh}</span>
          <span className="text-xs text-muted-foreground">{row.original.nameEn}</span>
        </div>
      )
    },
    {
      accessorKey: 'type',
      header: tCommon('type'), // Need to add 'type' to Common or use hardcoded/translated logic
      cell: ({ row }) => (
        <Badge variant={row.original.isSystem ? "secondary" : "outline"}>
          {row.original.isSystem ? t('systemType') : t('customType')}
        </Badge>
      )
    },
    {
      accessorKey: 'status',
      header: t('fields.status'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Switch 
            checked={row.original.isEnabled} 
            onCheckedChange={(checked) => handleToggle(row.original, checked)}
          />
          <span className="text-sm">
            {row.original.isEnabled ? t('status.active') : t('status.inactive')}
          </span>
        </div>
      )
    }
  ], [t, tCommon, locale]);

  // Define actions for GenericDataTable
  const actions: ActionConfig<Bank>[] = useMemo(() => [
    {
      label: tCommon('edit'),
      icon: <Pencil className="h-4 w-4" />,
      onClick: openEdit,
      // Only allow editing custom banks (non-system)
      condition: (bank: Bank) => !bank.isSystem
    },
    {
      label: tCommon('delete'),
      icon: <Trash2 className="h-4 w-4" />,
      variant: 'destructive',
      onClick: openDelete,
      // Only allow deleting custom banks (non-system)
      condition: (bank: Bank) => !bank.isSystem
    },
  ], [tCommon]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Landmark className="h-8 w-8" />
            {t('title')}
          </h1>
          <p className="text-muted-foreground hidden sm:block">
            {t('companyDescription')}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">{tCommon('create')}</span>
        </Button>
      </div>

      <GenericDataTable
        data={banks}
        columns={columns}
        loading={loading}
        emptyStateText={t('noData')}
        actions={actions}
      />

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
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
              <Label htmlFor="nameTh">{t('fields.nameTh')}</Label>
              <Input
                id="nameTh"
                value={formData.nameTh}
                onChange={(e) => setFormData({ ...formData, nameTh: e.target.value })}
                placeholder={t('placeholders.nameTh')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nameEn">{t('fields.nameEn')}</Label>
              <Input
                id="nameEn"
                value={formData.nameEn}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                placeholder={t('placeholders.nameEn')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} type="button">
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={saving} type="button">
              {saving ? tCommon('saving') : tCommon('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <Label htmlFor="edit-nameTh">{t('fields.nameTh')}</Label>
              <Input
                id="edit-nameTh"
                value={formData.nameTh}
                onChange={(e) => setFormData({ ...formData, nameTh: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-nameEn">{t('fields.nameEn')}</Label>
              <Input
                id="edit-nameEn"
                value={formData.nameEn}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)} type="button">
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleUpdate} disabled={saving} type="button">
              {saving ? tCommon('saving') : tCommon('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tCommon('confirmDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tCommon('confirmDeleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={saving}>
              {saving ? tCommon('saving') : tCommon('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
