'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GenericDataTable } from '@/components/common/generic-data-table';
import { Button } from '@/components/ui/button';
import { SquarePen, Trash2 } from 'lucide-react';
import { masterDataService, type MasterData } from '@/services/master-data.service';
import { useToast } from '@/hooks/use-toast';
import { MasterDataForm } from './master-data-form';
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

interface MasterDataListProps {
  type: 'department' | 'position';
  refreshKey?: number;
}

export function MasterDataList({ type, refreshKey = 0 }: MasterDataListProps) {
  const t = useTranslations(type === 'department' ? 'Departments' : 'Positions');
  const tCommon = useTranslations('Common');
  const { toast } = useToast();
  
  const [data, setData] = useState<MasterData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<MasterData | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const response = type === 'department' 
        ? await masterDataService.getDepartments()
        : await masterDataService.getPositions();
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

  const handleUpdate = async (formData: { code: string; name: string }) => {
    if (!selectedItem) return;
    if (type === 'department') {
      await masterDataService.updateDepartment(selectedItem.id, formData);
    } else {
      await masterDataService.updatePosition(selectedItem.id, formData);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    try {
      if (type === 'department') {
        await masterDataService.deleteDepartment(selectedItem.id);
      } else {
        await masterDataService.deletePosition(selectedItem.id);
      }
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

  const columns = [
    {
      id: 'code',
      header: t('fields.code'),
      accessorFn: (row: MasterData) => row.code || row.Code,
      cell: (info: any) => <span className="font-mono">{info.getValue()}</span>,
    },
    {
      id: 'name',
      header: t('fields.name'),
      accessorFn: (row: MasterData) => row.name || row.Name,
    },
  ];

  const actions = [
    {
      label: tCommon('edit'),
      icon: <SquarePen className="h-4 w-4" />,
      onClick: (item: MasterData) => {
        setSelectedItem(item);
        setIsEditOpen(true);
      },
    },
    {
      label: tCommon('delete'),
      icon: <Trash2 className="h-4 w-4" />,
      variant: 'destructive' as const,
      onClick: (item: MasterData) => {
        setSelectedItem(item);
        setIsDeleteOpen(true);
      },
    },
  ];

  return (
    <>
      <GenericDataTable
        data={data}
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
              <MasterDataForm
                type={type}
                initialData={{
                  code: selectedItem.code || selectedItem.Code || '',
                  name: selectedItem.name || selectedItem.Name || '',
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
                  {tCommon('confirmDeleteDescription')}
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
