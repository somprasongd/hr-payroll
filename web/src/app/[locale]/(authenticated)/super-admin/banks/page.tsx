'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Plus, Landmark, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { masterDataService, Bank } from '@/services/master-data.service';
import { GenericDataTable, ActionConfig } from '@/components/common/generic-data-table';
import { ColumnDef } from '@tanstack/react-table';
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

export default function SystemBanksPage() {
  const t = useTranslations('SuperAdmin');
  const tBanks = useTranslations('Banks');
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
  const [formData, setFormData] = useState({ code: '', nameTh: '', nameEn: '', isSystem: true });

  const fetchBanks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await masterDataService.getSystemBanks();
      setBanks(data);
    } catch (error) {
      console.error('Failed to fetch banks:', error);
      toast({
        title: tCommon('error'),
        description: tBanks('errors.fetchFailed'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, tCommon, tBanks]);

  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

  const resetForm = () => {
    setFormData({ code: '', nameTh: '', nameEn: '', isSystem: true });
    setSelectedBank(null);
  };

  const openCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const openEdit = (bank: Bank) => {
    setSelectedBank(bank);
    setFormData({ code: bank.code, nameTh: bank.nameTh, nameEn: bank.nameEn, isSystem: true });
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
        description: tBanks('errors.saveFailed'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      await masterDataService.createSystemBank(formData);
      toast({ title: tCommon('success'), description: tBanks('success.created') });
      setIsCreateOpen(false);
      resetForm();
      fetchBanks();
    } catch (error) {
      console.error('Failed to create bank:', error);
      toast({
        title: tCommon('error'),
        description: tBanks('errors.saveFailed'),
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
      await masterDataService.updateSystemBank(selectedBank.id, formData);
      toast({ title: tCommon('success'), description: tBanks('success.updated') });
      setIsEditOpen(false);
      resetForm();
      fetchBanks();
    } catch (error) {
      console.error('Failed to update bank:', error);
      toast({
        title: tCommon('error'),
        description: tBanks('errors.saveFailed'),
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
      await masterDataService.deleteSystemBank(selectedBank.id);
      toast({ title: tCommon('success'), description: tBanks('success.deleted') });
      setIsDeleteOpen(false);
      resetForm();
      fetchBanks();
    } catch (error) {
      console.error('Failed to delete bank:', error);
      toast({
        title: tCommon('error'),
        description: tBanks('errors.deleteFailed'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = useCallback(async (id: string, currentStatus: boolean) => {
    try {
      await masterDataService.toggleSystemBank(id, !currentStatus);
      toast({ title: tCommon('success'), description: tBanks('success.statusChanged') });
      fetchBanks();
    } catch (error) {
      console.error('Failed to toggle bank status:', error);
      toast({
        title: tCommon('error'),
        description: tBanks('errors.toggleFailed'),
        variant: 'destructive',
      });
    }
  }, [fetchBanks, tBanks, tCommon, toast]);

  const getDisplayName = (bank: Bank) => {
    return locale === 'th' ? bank.nameTh : bank.nameEn;
  };

  // Define columns for GenericDataTable
  const columns: ColumnDef<Bank>[] = useMemo(() => [
    {
      accessorKey: 'code',
      header: tBanks('fields.code'),
      cell: ({ row }) => <span className="font-mono">{row.original.code}</span>,
    },
    {
      accessorKey: 'nameTh',
      header: tBanks('fields.nameTh'),
    },
    {
      accessorKey: 'nameEn',
      header: tBanks('fields.nameEn'),
    },
    {
      accessorKey: 'isActive',
      header: tBanks('fields.status'),
      cell: ({ row }) => (
        <Switch
          checked={row.original.isActive}
          onCheckedChange={() => handleToggleActive(row.original.id, row.original.isActive)}
        />
      ),
    },
  ], [tBanks, handleToggleActive]);

  // Define actions for GenericDataTable
  const actions: ActionConfig<Bank>[] = useMemo(() => [
    {
      label: tCommon('edit'),
      icon: <Pencil className="h-4 w-4" />,
      onClick: openEdit,
    },
    {
      label: tCommon('delete'),
      icon: <Trash2 className="h-4 w-4" />,
      variant: 'destructive',
      onClick: openDelete,
    },
  ], [tCommon]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Landmark className="h-8 w-8" />
            {tBanks('title')}
          </h1>
          <p className="text-muted-foreground hidden sm:block">
            {tBanks('systemDescription')}
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
        emptyStateText={tBanks('noData')}
        actions={actions}
      />

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tBanks('createTitle')}</DialogTitle>
            <DialogDescription>{tBanks('createDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">{tBanks('fields.code')}</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder={tBanks('placeholders.code')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nameTh">{tBanks('fields.nameTh')}</Label>
              <Input
                id="nameTh"
                value={formData.nameTh}
                onChange={(e) => setFormData({ ...formData, nameTh: e.target.value })}
                placeholder={tBanks('placeholders.nameTh')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nameEn">{tBanks('fields.nameEn')}</Label>
              <Input
                id="nameEn"
                value={formData.nameEn}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                placeholder={tBanks('placeholders.nameEn')}
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
            <DialogTitle>{tBanks('editTitle')}</DialogTitle>
            <DialogDescription>{tBanks('editDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-code">{tBanks('fields.code')}</Label>
              <Input
                id="edit-code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-nameTh">{tBanks('fields.nameTh')}</Label>
              <Input
                id="edit-nameTh"
                value={formData.nameTh}
                onChange={(e) => setFormData({ ...formData, nameTh: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-nameEn">{tBanks('fields.nameEn')}</Label>
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
