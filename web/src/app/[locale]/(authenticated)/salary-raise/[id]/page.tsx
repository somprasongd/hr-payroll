'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { SalaryRaiseCycleDetail } from '@/components/salary-raise/salary-raise-cycle-detail';
import { SalaryRaiseItemsTable } from '@/components/salary-raise/salary-raise-items-table';
import { salaryRaiseService, SalaryRaiseCycle, SalaryRaiseItem } from '@/services/salary-raise.service';
import { useRouter } from '@/i18n/routing';
import { useToast } from '@/hooks/use-toast';
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

export default function SalaryRaiseDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const tCommon = useTranslations('Common');
  const t = useTranslations('SalaryRaise');
  const router = useRouter();
  const { toast } = useToast();
  
  const [cycle, setCycle] = useState<SalaryRaiseCycle | null>(null);
  const [items, setItems] = useState<SalaryRaiseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [cycleRes, itemsRes] = await Promise.all([
        salaryRaiseService.getCycle(id),
        salaryRaiseService.getCycleItems(id)
      ]);
      
      // Handle API response structure (unwrapped by apiClient)
      setCycle(cycleRes as unknown as SalaryRaiseCycle);
      setItems((itemsRes as any).data || []);
    } catch (error) {
      console.error('Failed to fetch cycle details:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id, fetchData]);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!cycle) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-muted-foreground">
        Cycle not found
      </div>
    );
  }

  const totalEmployees = items.length;
  const totalRaiseAmount = items.reduce((sum, item) => sum + (item.raiseAmount || 0), 0);

  const displayCycle = cycle ? {
    ...cycle,
    totalEmployees,
    totalRaiseAmount
  } : null;



  const handleDeleteConfirm = async () => {
    try {
      await salaryRaiseService.deleteCycle(id);
      toast({
        title: t('delete.success'),
        variant: 'default',
      });
      router.push('/salary-raise');
    } catch (error) {
      console.error('Failed to delete cycle:', error);
      toast({
        title: tCommon('error'),
        description: t('delete.error'),
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <SalaryRaiseCycleDetail 
        cycle={displayCycle!} 
        onRefresh={fetchData} 
        onDelete={() => setDeleteDialogOpen(true)}
      />
      <SalaryRaiseItemsTable 
        items={items} 
        cycleStatus={cycle.status} 
        onRefresh={fetchData} 
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              {t('actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
