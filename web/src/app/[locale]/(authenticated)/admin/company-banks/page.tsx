'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Plus, CreditCard, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { companyBankAccountService, CompanyBankAccount } from '@/services/company-bank-account.service';
import { masterDataService, Bank } from '@/services/master-data.service';
import { getBranches } from '@/services/tenant.service';
import { Branch } from '@/store/tenant-store';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FormData {
  bankId: string;
  branchId: string | null;
  accountNumber: string;
  accountName: string;
  isActive: boolean;
}

const emptyFormData: FormData = {
  bankId: '',
  branchId: null,
  accountNumber: '',
  accountName: '',
  isActive: true,
};

export default function CompanyBankAccountsPage() {
  const t = useTranslations('CompanyBankAccounts');
  const tCommon = useTranslations('Common');
  const locale = useLocale();
  const { toast } = useToast();

  const [accounts, setAccounts] = useState<CompanyBankAccount[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<CompanyBankAccount | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyFormData);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await companyBankAccountService.list();
      setAccounts(data);
    } catch (error) {
      console.error('Failed to fetch company bank accounts:', error);
      toast({
        title: tCommon('error'),
        description: t('errors.fetchFailed'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, tCommon, t]);

  const fetchBanks = useCallback(async () => {
    try {
      const data = await masterDataService.getBanks();
      // Filter to only show enabled banks
      setBanks(data.filter(b => b.isEnabled));
    } catch (error) {
      console.error('Failed to fetch banks:', error);
    }
  }, []);

  const fetchBranches = useCallback(async () => {
    try {
      const data = await getBranches();
      setBranches(data);
    } catch (error) {
      console.error('Failed to fetch branches:', error);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
    fetchBanks();
    fetchBranches();
  }, [fetchAccounts, fetchBanks, fetchBranches]);

  const resetForm = () => {
    setFormData(emptyFormData);
    setSelectedAccount(null);
  };

  const openCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const openEdit = (account: CompanyBankAccount) => {
    setSelectedAccount(account);
    setFormData({
      bankId: account.bankId,
      branchId: account.branchId,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      isActive: account.isActive,
    });
    setIsEditOpen(true);
  };

  const openDelete = (account: CompanyBankAccount) => {
    setSelectedAccount(account);
    setIsDeleteOpen(true);
  };

  const handleCreate = async () => {
    if (!formData.bankId || !formData.accountNumber || !formData.accountName) {
      toast({
        title: tCommon('error'),
        description: t('validation.required'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      await companyBankAccountService.create({
        bankId: formData.bankId,
        branchId: formData.branchId || null,
        accountNumber: formData.accountNumber,
        accountName: formData.accountName,
      });
      toast({ title: tCommon('success'), description: t('success.created') });
      setIsCreateOpen(false);
      resetForm();
      fetchAccounts();
    } catch (error) {
      console.error('Failed to create account:', error);
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
    if (!selectedAccount || !formData.bankId || !formData.accountNumber || !formData.accountName) {
      return;
    }

    try {
      setSaving(true);
      await companyBankAccountService.update(selectedAccount.id, {
        bankId: formData.bankId,
        branchId: formData.branchId || null,
        accountNumber: formData.accountNumber,
        accountName: formData.accountName,
        isActive: formData.isActive,
      });
      toast({ title: tCommon('success'), description: t('success.updated') });
      setIsEditOpen(false);
      resetForm();
      fetchAccounts();
    } catch (error) {
      console.error('Failed to update account:', error);
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
    if (!selectedAccount) return;

    try {
      setSaving(true);
      await companyBankAccountService.delete(selectedAccount.id);
      toast({ title: tCommon('success'), description: t('success.deleted') });
      setIsDeleteOpen(false);
      resetForm();
      fetchAccounts();
    } catch (error) {
      console.error('Failed to delete account:', error);
      toast({
        title: tCommon('error'),
        description: t('errors.deleteFailed'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const getBankDisplayName = (account: CompanyBankAccount) => {
    return locale === 'th' ? account.bankNameTh : account.bankNameEn;
  };

  // Define columns for GenericDataTable
  const columns: ColumnDef<CompanyBankAccount>[] = useMemo(() => [
    {
      accessorKey: 'bank',
      header: t('fields.bank'),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{getBankDisplayName(row.original)}</span>
          <span className="text-xs text-muted-foreground font-mono">{row.original.bankCode}</span>
        </div>
      ),
    },
    {
      accessorKey: 'accountNumber',
      header: t('fields.accountNumber'),
      cell: ({ row }) => <span className="font-mono">{row.original.accountNumber}</span>,
    },
    {
      accessorKey: 'accountName',
      header: t('fields.accountName'),
    },
    {
      accessorKey: 'branch',
      header: t('fields.accountType'),
      cell: ({ row }) => (
        <Badge variant={row.original.branchId ? 'outline' : 'secondary'}>
          {row.original.branchId ? row.original.branchName : t('accountTypes.central')}
        </Badge>
      ),
    },
    {
      accessorKey: 'isActive',
      header: t('fields.status'),
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
          {row.original.isActive ? t('status.active') : t('status.inactive')}
        </Badge>
      ),
    },
  ], [t, locale]);

  // Define actions for GenericDataTable
  const actions: ActionConfig<CompanyBankAccount>[] = useMemo(() => [
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
            <CreditCard className="h-8 w-8" />
            {t('title')}
          </h1>
          <p className="text-muted-foreground hidden sm:block">
            {t('description')}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">{tCommon('create')}</span>
        </Button>
      </div>

      <GenericDataTable
        data={accounts}
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
              <Label htmlFor="create-bankId">{t('fields.bank')} *</Label>
              <Select
                value={formData.bankId}
                onValueChange={(value) => setFormData({ ...formData, bankId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('placeholders.selectBank')} />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((bank) => (
                    <SelectItem key={bank.id} value={bank.id}>
                      {locale === 'th' ? bank.nameTh : bank.nameEn} ({bank.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-branchId">{t('fields.accountType')}</Label>
              <Select
                value={formData.branchId || 'central'}
                onValueChange={(value) => setFormData({ ...formData, branchId: value === 'central' ? null : value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="central">{t('accountTypes.central')}</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name} ({t('accountTypes.branch')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t('hints.accountType')}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-accountNumber">{t('fields.accountNumber')} *</Label>
              <Input
                id="create-accountNumber"
                value={formData.accountNumber}
                onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                placeholder={t('placeholders.accountNumber')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-accountName">{t('fields.accountName')} *</Label>
              <Input
                id="create-accountName"
                value={formData.accountName}
                onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter' && !saving) handleCreate(); }}
                placeholder={t('placeholders.accountName')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} type="button">
              {tCommon('cancel')}
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={saving || !formData.bankId || !formData.accountNumber.trim() || !formData.accountName.trim()} 
              type="button"
            >
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
              <Label htmlFor="edit-bankId">{t('fields.bank')} *</Label>
              <Select
                value={formData.bankId}
                onValueChange={(value) => setFormData({ ...formData, bankId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('placeholders.selectBank')} />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((bank) => (
                    <SelectItem key={bank.id} value={bank.id}>
                      {locale === 'th' ? bank.nameTh : bank.nameEn} ({bank.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-branchId">{t('fields.accountType')}</Label>
              <Select
                value={formData.branchId || 'central'}
                onValueChange={(value) => setFormData({ ...formData, branchId: value === 'central' ? null : value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="central">{t('accountTypes.central')}</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name} ({t('accountTypes.branch')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t('hints.accountType')}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-accountNumber">{t('fields.accountNumber')} *</Label>
              <Input
                id="edit-accountNumber"
                value={formData.accountNumber}
                onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                placeholder={t('placeholders.accountNumber')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-accountName">{t('fields.accountName')} *</Label>
              <Input
                id="edit-accountName"
                value={formData.accountName}
                onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter' && !saving) handleUpdate(); }}
                placeholder={t('placeholders.accountName')}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="edit-isActive">{t('fields.isActive')}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)} type="button">
              {tCommon('cancel')}
            </Button>
            <Button 
              onClick={handleUpdate} 
              disabled={saving || !formData.bankId || !formData.accountNumber.trim() || !formData.accountName.trim()} 
              type="button"
            >
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
