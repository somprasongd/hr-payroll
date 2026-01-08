'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useRouter } from '@/i18n/routing';
import { ArrowLeft, Loader2, Edit2, CheckCircle, X, Trash2, MoreVertical, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EditBonusItemDialog } from '@/components/bonus/edit-bonus-item-dialog';
import { DismissibleAlert } from '@/components/ui/dismissible-alert';
import { formatTenure } from '@/lib/format-tenure';
import { bonusService, BonusCycle, BonusItem } from '@/services/bonus-service';
import { format } from 'date-fns';

import { useAuthStore } from '@/store/auth-store';
import { EmployeePhoto } from '@/components/common/employee-photo';
import { BonusPrintDialog } from '@/components/bonus/bonus-print-dialog';

export default function BonusDetailPage() {
  const t = useTranslations('Bonus');
  const tCommon = useTranslations('Common');
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const isHr = user?.role === 'hr';

  const [cycle, setCycle] = useState<BonusCycle | null>(null);
  const [items, setItems] = useState<BonusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<BonusItem | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchCycle = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const [cycleData, itemsData] = await Promise.all([
        bonusService.getCycle(id as string),
        bonusService.getBonusItems(id as string),
      ]);
      setCycle(cycleData);
      setItems(itemsData || []);
    } catch (error) {
      console.error(error);
      setErrorMessage(t('create.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCycle();
  }, [id]);

  const handleEditClick = (item: BonusItem) => {
    setEditingItem(item);
    setIsEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    fetchCycle();
    setIsEditDialogOpen(false);
  };

  const handleApprove = async () => {
    try {
      setErrorMessage(null);
      await bonusService.updateCycle(id as string, { status: 'approved' });
      fetchCycle();
    } catch (error: any) {
      // Known error codes from API
      const knownErrorCodes = [
        'BONUS_CYCLE_APPROVED_EXISTS',
        'BONUS_CYCLE_APPROVE_FAILED'
      ];
      const detail = error.detail || '';
      
      if (knownErrorCodes.includes(detail)) {
        setErrorMessage(t(`create.errors.${detail}`));
      } else {
        setErrorMessage(t('create.error'));
      }
    }
  };

  const handleReject = async () => {
    try {
      setErrorMessage(null);
      await bonusService.updateCycle(id as string, { status: 'rejected' });
      fetchCycle();
    } catch (error: any) {
      const detail = error.detail || '';
      const knownErrorCodes = [
        'BONUS_CYCLE_APPROVED_EXISTS',
        'BONUS_CYCLE_APPROVE_FAILED'
      ];
      
      if (knownErrorCodes.includes(detail)) {
        setErrorMessage(t(`create.errors.${detail}`));
      } else {
        setErrorMessage(t('create.error'));
      }
    }
  };

  const handleDelete = async () => {
    try {
      setErrorMessage(null);
      await bonusService.deleteCycle(id as string);
      router.push('/bonuses');
    } catch (error: any) {
      const detail = error.detail || '';
      const knownErrorCodes = [
        'BONUS_CYCLE_APPROVED_EXISTS',
        'BONUS_CYCLE_APPROVE_FAILED'
      ];
      
      if (knownErrorCodes.includes(detail)) {
        setErrorMessage(t(`create.errors.${detail}`));
      } else {
        setErrorMessage(t('create.error'));
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!cycle) {
    return <div className="text-center py-8">{t('cycleNotFound')}</div>;
  }

  const isPending = cycle?.status === 'pending';
  const isDeletable = cycle?.status === 'pending' || cycle?.status === 'rejected';

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

  const totalBonusAmount = items.reduce((sum, item) => sum + (item.bonusAmount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{t('detailTitle')}</h1>
              {getStatusBadge(cycle.status)}
            </div>
            <p className="text-muted-foreground">
              {format(new Date(cycle.payrollMonthDate), 'MM/yyyy')}
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

          {cycle.status === 'approved' && (
             <Button
               variant="outline"
               size="sm"
               onClick={() => setShowPrintDialog(true)}
             >
               <Printer className="mr-2 h-4 w-4" />
               {t('print.button')}
             </Button>
          )}
        </div>
      </div>
      
      {/* Print Dialog */}
      {cycle && (
        <BonusPrintDialog
          open={showPrintDialog}
          onOpenChange={setShowPrintDialog}
          cycle={cycle}
        />
      )}

      {/* Error alert */}
      {errorMessage && (
        <DismissibleAlert
          variant="error"
          onDismiss={() => setErrorMessage(null)}
          autoDismiss={false}
        >
          {errorMessage}
        </DismissibleAlert>
      )}

      {/* Shared dialogs for both mobile and desktop */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('reject.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('reject.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} className="bg-red-600 hover:bg-red-700">
              {t('actions.reject')}
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
            <AlertDialogAction onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
              {t('actions.approve')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation dialog (shared between mobile and desktop) */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('delete.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {t('actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 border rounded-lg bg-white shadow-sm">
          <div className="text-sm text-muted-foreground">{t('fields.bonusYear')}</div>
          <div className="font-medium">
            {cycle.bonusYear || new Date(cycle.payrollMonthDate).getFullYear()}
          </div>
        </div>
        <div className="p-4 border rounded-lg bg-white shadow-sm">
          <div className="text-sm text-muted-foreground">{t('fields.period')}</div>
          <div className="font-medium">
            {format(new Date(cycle.periodStartDate), 'dd/MM/yyyy')} -{' '}
            {format(new Date(cycle.periodEndDate), 'dd/MM/yyyy')}
          </div>
        </div>
        <div className="p-4 border rounded-lg bg-white shadow-sm">
          <div className="text-sm text-muted-foreground">{t('fields.totalEmployees')}</div>
          <div className="font-medium">{items.length}</div>
        </div>
        <div className="p-4 border rounded-lg bg-white shadow-sm">
          <div className="text-sm text-muted-foreground">{t('fields.totalAmount')}</div>
          <div className="text-2xl font-bold text-green-600">
            {totalBonusAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('fields.employeeNumber')}</TableHead>
              <TableHead>{t('fields.employee')}</TableHead>
              <TableHead>{t('fields.tenure')}</TableHead>
              <TableHead>{t('fields.currentSalary')}</TableHead>
              <TableHead>{t('fields.bonusMonths')}</TableHead>
              <TableHead>{t('fields.bonusAmount')}</TableHead>
              <TableHead>{t('fields.stats')}</TableHead>
              {isPending && <TableHead className="text-right">{t('actions.editItem')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium text-muted-foreground">{item.employeeNumber || '-'}</TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <EmployeePhoto
                      photoId={item.photoId}
                      firstName={item.firstName}
                      lastName={item.lastName}
                      size="sm"
                      className="shrink-0"
                    />
                    <span>{item.employeeName}</span>
                  </div>
                </TableCell>
                <TableCell>{formatTenure(item.tenureDays || 0, t)}</TableCell>
                <TableCell>{item.currentSalary?.toLocaleString() || '0'}</TableCell>
                <TableCell>{item.bonusMonths || 0}</TableCell>
                <TableCell className="font-medium text-green-600">
                  {item.bonusAmount?.toLocaleString() || '0'}
                </TableCell>
                <TableCell>
                  <div className="text-xs space-y-1">
                    <div>{t('stats.late')}: {item.stats?.lateMinutes || 0} {t('units.minutes')}</div>
                    <div>{t('stats.leave')}: {item.stats?.leaveDays || 0} {t('units.days')}</div>
                    <div>{t('stats.leaveDouble')}: {item.stats?.leaveDoubleDays || 0} {t('units.days')}</div>
                    <div>{t('stats.leaveHours')}: {item.stats?.leaveHours || 0} {t('units.hours')}</div>
                    <div>{t('stats.ot')}: {item.stats?.otHours || 0} {t('units.hours')}</div>
                  </div>
                </TableCell>
                {isPending && (
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingItem(item);
                        setIsEditDialogOpen(true);
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <EditBonusItemDialog
        item={editingItem}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={fetchCycle}
      />
    </div>
  );
}
