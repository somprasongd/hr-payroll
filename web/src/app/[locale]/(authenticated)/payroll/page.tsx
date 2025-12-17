'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { Eye, Plus, Banknote, Filter, RotateCcw, Trash2 } from 'lucide-react';

import { GenericDataTable } from '@/components/common/generic-data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreateCycleDialog } from '@/components/payroll/create-cycle-dialog';
import { payrollService, PayrollRun } from '@/services/payroll.service';
import { ConfirmationDialog } from '@/components/common/confirmation-dialog';

export default function PayrollPage() {
  const router = useRouter();
  const t = useTranslations('Payroll');
  const tCommon = useTranslations('Common');
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [showFilters, setShowFilters] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [runToDelete, setRunToDelete] = useState<PayrollRun | null>(null);

  const fetchRuns = async () => {
    try {
      setLoading(true);
      const response = await payrollService.getPayrollRuns({ 
        page: currentPage,
        limit: 20,
        year: yearFilter,
        status: statusFilter === 'all' ? undefined : statusFilter
      });
      setRuns(response.data || []);
      setTotalPages(response.meta?.totalPages || 1);
    } catch (error) {
      console.error('Failed to fetch payroll runs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, [currentPage, yearFilter, statusFilter]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleCreateSuccess = (cycleId?: string) => {
    if (cycleId) {
      router.push(`/payroll/${cycleId}`);
    } else {
      fetchRuns();
    }
  };

  const clearFilters = () => {
    setYearFilter(new Date().getFullYear());
    setStatusFilter('all');
    setCurrentPage(1);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default">{t('status.approved')}</Badge>;
      case 'paid':
        return <Badge variant="secondary">{t('status.paid')}</Badge>;
      default:
        return <Badge variant="secondary">{t('status.pending')}</Badge>;
    }
  };

  const columns = [
    {
      id: 'month',
      header: t('fields.month'),
      accessorFn: (row: PayrollRun) => row.payrollMonthDate,
      cell: (info: any) => format(new Date(info.getValue()), 'MM/yyyy'),
    },
    {
      id: 'period',
      header: t('fields.period'),
      accessorFn: (row: PayrollRun) => row.periodStartDate,
      cell: (info: any) => format(new Date(info.getValue()), 'dd/MM/yyyy'),
    },
    {
      id: 'payDate',
      header: t('fields.payDate'),
      accessorFn: (row: PayrollRun) => row.payDate,
      cell: (info: any) => info.getValue() ? format(new Date(info.getValue()), 'dd/MM/yyyy') : '-',
    },
    {
      id: 'status',
      header: t('fields.status'),
      accessorFn: (row: PayrollRun) => row.status,
      cell: (info: any) => getStatusBadge(info.getValue()),
    },
    {
      id: 'totalEmployees',
      header: () => <div className="text-right">{t('fields.totalEmployees')}</div>,
      accessorFn: (row: PayrollRun) => row.totalEmployees,
      cell: (info: any) => <div className="text-right">{info.getValue() || '-'}</div>,
    },
    {
      id: 'totalNetPay',
      header: () => <div className="text-right">{t('fields.totalNetPay')}</div>,
      accessorFn: (row: PayrollRun) => row.totalNetPay,
      cell: (info: any) => <div className="text-right">{info.getValue() ? info.getValue().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</div>,
    },
  ];

  const actions: any[] = [
    {
      label: t('actions.view'),
      icon: <Eye className="h-4 w-4" />,
      onClick: (run: PayrollRun) => {
        router.push(`/payroll/${run.id}`);
      },
    },
    {
      label: tCommon('delete'),
      icon: <Trash2 className="h-4 w-4" />,
      variant: 'destructive',
      condition: (run: PayrollRun) => run.status === 'pending' || run.status === 'processing',
      onClick: (run: PayrollRun) => {
        setRunToDelete(run);
        setDeleteDialogOpen(true);
      },
    }
  ];

  const handleConfirmDelete = async () => {
    if (runToDelete) {
      try {
        await payrollService.deletePayrollRun(runToDelete.id);
        fetchRuns();
      } catch (error) {
        console.error('Failed to delete payroll run', error);
      } finally {
        setDeleteDialogOpen(false);
        setRunToDelete(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Banknote className="h-6 w-6" />
            {t('title')}
          </h1>
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
            trigger={
              <Button>
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{tCommon('create')}</span>
              </Button>
            }
          />
        </div>
      </div>

      <div className={`bg-white p-4 rounded-lg border border-gray-200 shadow-sm ${!showFilters ? 'hidden md:block' : ''}`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="text-sm font-medium mb-2 block">{t('filters.year')}</label>
            <Input 
              type="number" 
              value={yearFilter} 
              onChange={(e) => setYearFilter(parseInt(e.target.value) || new Date().getFullYear())}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">{t('filters.status')}</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
              <SelectValue placeholder={t('filters.allStatuses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.allStatuses')}</SelectItem>
                <SelectItem value="pending">{t('status.pending')}</SelectItem>
                <SelectItem value="processing">{t('status.processing')}</SelectItem>
                <SelectItem value="approved">{t('status.approved')}</SelectItem>
                <SelectItem value="paid">{t('status.paid')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-start-4 flex justify-end">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={clearFilters} 
              title={tCommon('clearFilter')}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <GenericDataTable
        data={runs}
        columns={columns}
        loading={loading}
        emptyStateText={tCommon('noData')}
        actions={actions}
        pagination={{
          currentPage,
          totalPages,
          onPageChange: handlePageChange
        }}
      />

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={tCommon('confirmDeleteTitle')}
        description={tCommon('confirmDeleteDescription')}
        onConfirm={handleConfirmDelete}
        confirmText={tCommon('delete')}
        variant="destructive"
      />
    </div>
  );
}
