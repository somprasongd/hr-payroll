'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { format } from 'date-fns';
import { ArrowLeft, CheckCircle, XCircle, Loader2, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { salaryRaiseService, SalaryRaiseCycle } from '@/services/salary-raise.service';

interface SalaryRaiseCycleDetailProps {
  cycle: SalaryRaiseCycle;
  onRefresh: () => void;
  onDelete?: () => void;
}

export function SalaryRaiseCycleDetail({ cycle, onRefresh, onDelete }: SalaryRaiseCycleDetailProps) {
  const t = useTranslations('SalaryRaise');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = async (status: 'approved' | 'rejected') => {
    try {
      setIsUpdating(true);
      await salaryRaiseService.updateCycle(cycle.id, { status });
      
      toast({
        title: status === 'approved' ? t('approve.success') : t('reject.success'),
        variant: 'default',
      });
      
      onRefresh();
    } catch (error) {
      console.error(`Failed to ${status} cycle:`, error);
      toast({
        title: tCommon('error'),
        description: `Failed to ${status} cycle. Please try again.`,
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="bg-green-500">{t('status.approved')}</Badge>;
      case 'rejected':
        return <Badge variant="destructive">{t('status.rejected')}</Badge>;
      default:
        return <Badge variant="secondary">{t('status.pending')}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">{t('detailTitle')}</h2>
            {getStatusBadge(cycle.status)}
          </div>
          <p className="text-muted-foreground">
            {format(new Date(cycle.periodStartDate), 'dd/MM/yyyy')} - {format(new Date(cycle.periodEndDate), 'dd/MM/yyyy')}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {(cycle.status === 'pending' || cycle.status === 'rejected') && onDelete && (
            <Button 
              variant="destructive" 
              onClick={onDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t('actions.delete')}
            </Button>
          )}
          
          {cycle.status === 'pending' && (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive/10">
                    <XCircle className="mr-2 h-4 w-4" />
                    {t('actions.reject')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('reject.title')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('reject.description')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => handleStatusChange('rejected')}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : t('actions.reject')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {t('actions.approve')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('approve.title')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('approve.description')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleStatusChange('approved')}>
                      {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : t('actions.approve')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <div className="text-sm font-medium text-muted-foreground">{t('fields.totalEmployees')}</div>
          <div className="text-2xl font-bold">{cycle.totalEmployees || 0}</div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <div className="text-sm font-medium text-muted-foreground">{t('fields.totalRaiseAmount')}</div>
          <div className="text-2xl font-bold text-green-600">
            {cycle.totalRaiseAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
          </div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <div className="text-sm font-medium text-muted-foreground">{t('fields.createdAt')}</div>
          <div className="text-2xl font-bold text-sm pt-2">
            {format(new Date(cycle.createdAt), 'dd/MM/yyyy HH:mm')}
          </div>
        </div>
      </div>
    </div>
  );
}
