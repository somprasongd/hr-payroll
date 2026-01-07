'use client';

import { useEffect, useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GenericDataTable } from '@/components/common/generic-data-table';
import { SquarePen, Trash2, Lock } from 'lucide-react';
import { documentTypeService, type DocumentType } from '@/services/document-type.service';
import { useToast } from '@/hooks/use-toast';
import { DocumentTypeForm } from './document-type-form';
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
import { Badge } from '@/components/ui/badge';

interface DocumentTypeListProps {
  refreshKey?: number;
}

export function DocumentTypeList({ refreshKey = 0 }: DocumentTypeListProps) {
  const t = useTranslations('DocumentTypes');
  const tCommon = useTranslations('Common');
  const locale = useLocale();
  const { toast } = useToast();
  
  const [data, setData] = useState<DocumentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<DocumentType | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const response = await documentTypeService.list();
      // Handle null response from API (Go returns null for empty slices)
      setData(response ?? []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: t('errors.fetchFailed'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshKey]);

  // Group data: system types first, then custom types
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      if (a.isSystem && !b.isSystem) return -1;
      if (!a.isSystem && b.isSystem) return 1;
      return a.code.localeCompare(b.code);
    });
  }, [data]);

  const handleUpdate = async (formData: { code: string; nameTh: string; nameEn: string }) => {
    if (!selectedItem) return;
    await documentTypeService.update(selectedItem.id, formData);
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    try {
      await documentTypeService.delete(selectedItem.id);
      toast({
        title: tCommon('success'),
        description: t('success.deleted'),
      });
      fetchData();
    } catch (error: any) {
      console.error('Failed to delete:', error);
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error.message || t('errors.deleteFailed'),
      });
    } finally {
      setIsDeleteOpen(false);
      setSelectedItem(null);
    }
  };

  const getDisplayName = (item: DocumentType) => {
    return locale === 'th' ? item.nameTh : item.nameEn;
  };

  const columns = [
    {
      id: 'code',
      header: t('fields.code'),
      accessorFn: (row: DocumentType) => row.code,
      cell: (info: any) => {
        const row = info.row.original as DocumentType;
        return (
          <span className="flex items-center gap-2">
            {row.isSystem && <Lock className="h-3 w-3 text-muted-foreground" />}
            <span className="font-mono">{info.getValue()}</span>
          </span>
        );
      },
    },
    {
      id: 'nameTh',
      header: t('fields.nameTh'),
      accessorFn: (row: DocumentType) => row.nameTh,
    },
    {
      id: 'nameEn',
      header: t('fields.nameEn'),
      accessorFn: (row: DocumentType) => row.nameEn,
    },
    {
      id: 'type',
      header: t('fields.type'),
      accessorFn: (row: DocumentType) => row.isSystem,
      cell: (info: any) => {
        const isSystem = info.getValue();
        return isSystem ? (
          <Badge variant="secondary">{t('systemType')}</Badge>
        ) : (
          <Badge variant="outline">{t('customType')}</Badge>
        );
      },
    },
  ];

  const actions = [
    {
      label: tCommon('edit'),
      icon: <SquarePen className="h-4 w-4" />,
      onClick: (item: DocumentType) => {
        setSelectedItem(item);
        setIsEditOpen(true);
      },
      condition: (item: DocumentType) => !item.isSystem,
    },
    {
      label: tCommon('delete'),
      icon: <Trash2 className="h-4 w-4" />,
      variant: 'destructive' as const,
      onClick: (item: DocumentType) => {
        setSelectedItem(item);
        setIsDeleteOpen(true);
      },
      condition: (item: DocumentType) => !item.isSystem,
    },
  ];

  return (
    <>
      <GenericDataTable
        data={sortedData}
        columns={columns}
        loading={isLoading}
        emptyStateText={t('noData')}
        actions={actions}
      />

      {selectedItem && (
        <>
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('editTitle')}</DialogTitle>
                <DialogDescription>{t('editDescription')}</DialogDescription>
              </DialogHeader>
              <DocumentTypeForm
                initialData={{
                  code: selectedItem.code,
                  nameTh: selectedItem.nameTh,
                  nameEn: selectedItem.nameEn,
                }}
                onSuccess={() => {
                  setIsEditOpen(false);
                  setSelectedItem(null);
                  fetchData();
                }}
                onSubmit={handleUpdate}
              />
            </DialogContent>
          </Dialog>

          <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{tCommon('confirmDeleteTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('deleteDescription', { name: getDisplayName(selectedItem) })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>{tCommon('confirm')}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </>
  );
}
