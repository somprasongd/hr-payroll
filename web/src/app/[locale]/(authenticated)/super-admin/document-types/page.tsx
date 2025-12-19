'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Plus, FileText, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  listSystemDocumentTypes,
  createSystemDocumentType,
  updateSystemDocumentType,
  deleteSystemDocumentType,
  SystemDocumentType,
} from '@/services/superadmin.service';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

export default function SystemDocumentTypesPage() {
  const t = useTranslations('SuperAdmin');
  const tDocTypes = useTranslations('DocumentTypes');
  const tCommon = useTranslations('Common');
  const locale = useLocale();
  const { toast } = useToast();

  const [types, setTypes] = useState<SystemDocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<SystemDocumentType | null>(null);
  const [formData, setFormData] = useState({ code: '', nameTh: '', nameEn: '' });

  const fetchTypes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listSystemDocumentTypes();
      setTypes(data);
    } catch (error) {
      console.error('Failed to fetch document types:', error);
      toast({
        title: tCommon('error'),
        description: tDocTypes('errors.fetchFailed'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, tCommon, tDocTypes]);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  const resetForm = () => {
    setFormData({ code: '', nameTh: '', nameEn: '' });
    setSelectedType(null);
  };

  const openCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const openEdit = (type: SystemDocumentType) => {
    setSelectedType(type);
    setFormData({ code: type.code, nameTh: type.nameTh, nameEn: type.nameEn });
    setIsEditOpen(true);
  };

  const openDelete = (type: SystemDocumentType) => {
    setSelectedType(type);
    setIsDeleteOpen(true);
  };

  const handleCreate = async () => {
    if (!formData.code || !formData.nameTh || !formData.nameEn) {
      toast({
        title: tCommon('error'),
        description: tDocTypes('errors.saveFailed'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      await createSystemDocumentType(formData);
      toast({ title: tCommon('success'), description: tDocTypes('success.created') });
      setIsCreateOpen(false);
      resetForm();
      fetchTypes();
    } catch (error) {
      console.error('Failed to create document type:', error);
      toast({
        title: tCommon('error'),
        description: tDocTypes('errors.saveFailed'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedType || !formData.code || !formData.nameTh || !formData.nameEn) {
      return;
    }

    try {
      setSaving(true);
      await updateSystemDocumentType(selectedType.id, formData);
      toast({ title: tCommon('success'), description: tDocTypes('success.updated') });
      setIsEditOpen(false);
      resetForm();
      fetchTypes();
    } catch (error) {
      console.error('Failed to update document type:', error);
      toast({
        title: tCommon('error'),
        description: tDocTypes('errors.saveFailed'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedType) return;

    try {
      setSaving(true);
      await deleteSystemDocumentType(selectedType.id);
      toast({ title: tCommon('success'), description: tDocTypes('success.deleted') });
      setIsDeleteOpen(false);
      resetForm();
      fetchTypes();
    } catch (error) {
      console.error('Failed to delete document type:', error);
      toast({
        title: tCommon('error'),
        description: tDocTypes('errors.deleteFailed'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const getDisplayName = (type: SystemDocumentType) => {
    return locale === 'th' ? type.nameTh : type.nameEn;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-8 w-8" />
            {t('documentTypes.title')}
          </h1>
          <p className="text-muted-foreground hidden sm:block">
            {t('documentTypes.description')}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">{tCommon('create')}</span>
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tDocTypes('fields.code')}</TableHead>
              <TableHead>{tDocTypes('fields.nameTh')}</TableHead>
              <TableHead>{tDocTypes('fields.nameEn')}</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10">
                  {tCommon('loading')}
                </TableCell>
              </TableRow>
            ) : types.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10">
                  {tDocTypes('noData')}
                </TableCell>
              </TableRow>
            ) : (
              types.map((type) => (
                <TableRow key={type.id}>
                  <TableCell className="font-mono">{type.code}</TableCell>
                  <TableCell>{type.nameTh}</TableCell>
                  <TableCell>{type.nameEn}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(type)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          {tCommon('edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openDelete(type)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {tCommon('delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tDocTypes('createTitle')}</DialogTitle>
            <DialogDescription>{tDocTypes('createDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">{tDocTypes('fields.code')}</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder={tDocTypes('placeholders.code')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nameTh">{tDocTypes('fields.nameTh')}</Label>
              <Input
                id="nameTh"
                value={formData.nameTh}
                onChange={(e) => setFormData({ ...formData, nameTh: e.target.value })}
                placeholder={tDocTypes('placeholders.nameTh')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nameEn">{tDocTypes('fields.nameEn')}</Label>
              <Input
                id="nameEn"
                value={formData.nameEn}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                placeholder={tDocTypes('placeholders.nameEn')}
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
            <DialogTitle>{tDocTypes('editTitle')}</DialogTitle>
            <DialogDescription>{tDocTypes('editDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-code">{tDocTypes('fields.code')}</Label>
              <Input
                id="edit-code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-nameTh">{tDocTypes('fields.nameTh')}</Label>
              <Input
                id="edit-nameTh"
                value={formData.nameTh}
                onChange={(e) => setFormData({ ...formData, nameTh: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-nameEn">{tDocTypes('fields.nameEn')}</Label>
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
              {tDocTypes('deleteDescription', { name: selectedType ? getDisplayName(selectedType) : '' })}
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
