'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { format } from 'date-fns';
import { ArrowLeft, CheckCircle, X, Loader2, Trash2, MoreVertical } from 'lucide-react';

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
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { salaryRaiseService, SalaryRaiseCycle } from '@/services/salary-raise.service';
import { useAuthStore } from '@/store/auth-store';

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
  const { user } = useAuthStore();
  const isHr = user?.role === 'hr';
  const [isUpdating, setIsUpdating] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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
      setShowRejectDialog(false);
      setShowApproveDialog(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default">{t('status.approved')}</Badge>;
      case 'rejected':
        return <Badge variant="destructive">{t('status.rejected')}</Badge>;
      default:
        return <Badge variant="secondary">{t('status.pending')}</Badge>;
    }
  };

  const isPending = cycle.status === 'pending';
  const isDeletable = cycle.status === 'pending' || cycle.status === 'rejected';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight">{t('detailTitle')}</h2>
              {getStatusBadge(cycle.status)}
            </div>
            <p className="text-muted-foreground">
              {format(new Date(cycle.periodStartDate), 'dd/MM/yyyy')} - {format(new Date(cycle.periodEndDate), 'dd/MM/yyyy')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPending && (
            <>
              {/* Mobile: Single dropdown menu */}
              <div className="md:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {!isHr && (
                      <>
                        <DropdownMenuItem onClick={() => setShowApproveDialog(true)}>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          {t('actions.approve')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setShowRejectDialog(true)}>
                          <X className="mr-2 h-4 w-4" />
                          {t('actions.reject')}
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-red-600">
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t('actions.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Desktop: Separate buttons */}
              <div className="hidden md:flex md:gap-2">
                {!isHr && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowApproveDialog(true)}
                      className="text-green-600 border-green-600 hover:bg-green-50"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      {t('actions.approve')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRejectDialog(true)}
                      className="text-red-600 border-red-600 hover:bg-red-50"
                    >
                      <X className="mr-2 h-4 w-4" />
                      {t('actions.reject')}
                    </Button>
                  </>
                )}
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
          
          {!isPending && isDeletable && (
            <Button
              variant="destructive"
              size="icon"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Shared dialogs for both mobile and desktop */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('reject.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('reject.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleStatusChange('rejected')} className="bg-red-600 hover:bg-red-700">
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : t('actions.reject')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('approve.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('approve.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleStatusChange('approved')} className="bg-green-600 hover:bg-green-700">
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : t('actions.approve')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('delete.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-red-600 hover:bg-red-700">
              {t('actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <div className="text-sm font-medium text-muted-foreground">{t('fields.totalEmployees')}</div>
          <div className="text-2xl font-bold">{cycle.totalEmployees || 0}</div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <div className="text-sm font-medium text-muted-foreground">{t('fields.totalRaiseAmount')}</div>
          <div className="text-2xl font-bold text-green-600">
            {(cycle.totalRaiseAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
