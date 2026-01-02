'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { format } from 'date-fns';
import { Eye, Filter, Plus, Trash2, RotateCcw } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GenericDataTable, ActionConfig } from '@/components/common/generic-data-table';
import { CreateCycleDialog } from './create-cycle-dialog';
import { salaryRaiseService, SalaryRaiseCycle } from '@/services/salary-raise.service';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useToast } from '@/hooks/use-toast';
import { useBranchChange } from '@/hooks/use-branch-change';

export function SalaryRaiseCycleList() {
  const t = useTranslations('SalaryRaise');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const { toast } = useToast();
  const [cycles, setCycles] = useState<SalaryRaiseCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYear - i);

  const fetchCycles = async () => {
    try {
      setLoading(true);
      const params: any = { 
        limit: 20,
        page: currentPage
      };
      if (statusFilter && statusFilter !== 'all') {
        params.status = statusFilter;
      }
      if (yearFilter && yearFilter !== 'all') {
        params.year = parseInt(yearFilter);
      }
      
      const response = await salaryRaiseService.getCycles(params);
      setCycles(response.data || []);
      setTotalPages(response.meta?.totalPages || 1);
    } catch (error) {
      console.error('Failed to fetch cycles:', error);
    } finally {
      setLoading(false);
    }
  };

  // Refetch when branch changes
  const currentBranchId = useBranchChange(useCallback(() => {
    setStatusFilter('all');
    setYearFilter('all');
    setCurrentPage(1);
  }, []));

  useEffect(() => {
    fetchCycles();
  }, [statusFilter, yearFilter, currentPage, currentBranchId]);

  const clearFilters = () => {
    setStatusFilter('all');
    setYearFilter('all');
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
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

  const handleCreateSuccess = (newCycleId?: string) => {
    fetchCycles();
    if (newCycleId) {
      router.push(`/salary-raise/${newCycleId}`);
    }
  };

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cycleToDelete, setCycleToDelete] = useState<SalaryRaiseCycle | null>(null);

  const handleDeleteClick = (cycle: SalaryRaiseCycle) => {
    setCycleToDelete(cycle);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!cycleToDelete) return;

    try {
      await salaryRaiseService.deleteCycle(cycleToDelete.id);
      toast({
        title: t('delete.success'),
        variant: 'default',
      });
      fetchCycles();
    } catch (error) {
      console.error('Failed to delete cycle:', error);
      toast({
        title: tCommon('error'),
        description: t('delete.error'),
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setCycleToDelete(null);
    }
  };

  // Define columns for GenericDataTable
  const columns: ColumnDef<SalaryRaiseCycle>[] = useMemo(() => [
    {
      accessorKey: 'period',
      header: t('fields.period'),
      cell: ({ row }) => (
        <span>
          {format(new Date(row.original.periodStartDate), 'dd/MM/yyyy')} - {format(new Date(row.original.periodEndDate), 'dd/MM/yyyy')}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: t('fields.status'),
      cell: ({ row }) => getStatusBadge(row.original.status),
    },
    {
      accessorKey: 'totalEmployees',
      header: () => <div className="text-right">{t('fields.totalEmployees')}</div>,
      cell: ({ row }) => <div className="text-right">{row.original.totalEmployees || 0}</div>,
    },
    {
      accessorKey: 'totalRaiseAmount',
      header: () => <div className="text-right">{t('fields.totalRaiseAmount')}</div>,
      cell: ({ row }) => (
        <div className="text-right">
          {row.original.totalRaiseAmount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
        </div>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: t('fields.createdAt'),
      cell: ({ row }) => format(new Date(row.original.createdAt), 'dd/MM/yyyy HH:mm'),
    },
  ], [t]);

  // Define actions for GenericDataTable
  const actions: ActionConfig<SalaryRaiseCycle>[] = useMemo(() => [
    {
      label: t('actions.view'),
      icon: <Eye className="h-4 w-4" />,
      onClick: (cycle) => router.push(`/salary-raise/${cycle.id}`),
    },
    {
      label: t('actions.delete'),
      icon: <Trash2 className="h-4 w-4" />,
      variant: 'destructive',
      onClick: handleDeleteClick,
      condition: (cycle) => cycle.status === 'pending' || cycle.status === 'rejected',
    },
  ], [t, router]);

  return (
    <div className="space-y-6">

      <div className="flex flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('listTitle')}</h1>
          <p className="text-gray-500 hidden sm:block">{t('description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
          </Button>
          <CreateCycleDialog 
            onSuccess={handleCreateSuccess} 
            latestCycleEndDate={cycles.length > 0 
              ? cycles.reduce((max, cycle) => cycle.periodEndDate > max ? cycle.periodEndDate : max, cycles[0].periodEndDate)
              : undefined
            }
            trigger={
              <Button>
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{t('createButton')}</span>
              </Button>
            }
          />
        </div>
      </div>

      <div className={`bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-4 relative ${!showFilters ? 'hidden md:block' : ''}`}>
        {(statusFilter !== 'all' || yearFilter !== 'all') && (
          <button
            onClick={clearFilters}
            className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            title={tCommon('clearFilter')}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}

        <div className="flex flex-col md:flex-row gap-4 md:w-auto lg:w-fit">
          <div className="w-full md:w-48">
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t('fields.year')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('status.allYears')}</SelectItem>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full md:w-48">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t('fields.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('status.allStatuses')}</SelectItem>
                <SelectItem value="pending">{t('status.pending')}</SelectItem>
                <SelectItem value="approved">{t('status.approved')}</SelectItem>
                <SelectItem value="rejected">{t('status.rejected')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <GenericDataTable
        data={cycles}
        columns={columns}
        loading={loading}
        emptyStateText={t('noData')}
        actions={actions}
        pagination={{
          currentPage,
          totalPages,
          onPageChange: handlePageChange,
        }}
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
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
