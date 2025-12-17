'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { Eye, Trash2, Filter, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreateCycleDialog } from '@/components/bonus/create-cycle-dialog';
import { bonusService, BonusCycle } from '@/services/bonus-service';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { GenericDataTable } from '@/components/common/generic-data-table';
import { FilterBar } from '@/components/common/filter-bar';
import { ConfirmationDialog } from '@/components/common/confirmation-dialog';

export default function BonusListPage() {
  const t = useTranslations('Bonus');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const { toast } = useToast();
  const [cycles, setCycles] = useState<BonusCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 13 }, (_, i) => currentYear - 10 + i);

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
      const response = await bonusService.getCycles(params);
      setCycles(response.data || []);
      setTotalPages(response.meta?.totalPages || 1);
    } catch (error) {
      console.error(error);
      toast({
        title: t('create.error'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCycles();
  }, [statusFilter, yearFilter, currentPage]);

  const clearFilters = () => {
    setStatusFilter('all');
    setYearFilter('all');
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await bonusService.deleteCycle(deleteId);
      toast({
        title: t('delete.success'),
        variant: 'default',
      });
      fetchCycles();
    } catch (error) {
      toast({
        title: t('create.error'),
        variant: 'destructive',
      });
    } finally {
      setDeleteId(null);
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

  const handleCreateSuccess = (cycleId: string) => {
    router.push(`/bonuses/${cycleId}`);
  };

  const columns = [
    {
      id: 'payrollMonth',
      header: () => t('fields.payrollMonth'),
      accessorFn: (row: BonusCycle) => format(new Date(row.payrollMonthDate), 'MM/yyyy'),
      cell: (info: any) => info.getValue(),
    },
    {
      id: 'bonusYear',
      header: () => t('fields.bonusYear'),
      accessorFn: (row: BonusCycle) => row.bonusYear || new Date(row.payrollMonthDate).getFullYear(),
      cell: (info: any) => info.getValue(),
    },
    {
      id: 'period',
      header: () => t('fields.period'),
      accessorFn: (row: BonusCycle) =>
        `${format(new Date(row.periodStartDate), 'dd/MM/yyyy')} - ${format(new Date(row.periodEndDate), 'dd/MM/yyyy')}`,
      cell: (info: any) => info.getValue(),
    },
    {
      id: 'totalEmployees',
      header: () => t('fields.totalEmployees'),
      accessorFn: (row: BonusCycle) => row.totalEmployees,
      cell: (info: any) => info.getValue(),
    },
    {
      id: 'totalAmount',
      header: () => t('fields.totalAmount'),
      accessorFn: (row: BonusCycle) => row.totalBonusAmount?.toLocaleString() || '-',
      cell: (info: any) => info.getValue(),
    },
    {
      id: 'status',
      header: () => t('fields.status'),
      accessorFn: (row: BonusCycle) => row.status,
      cell: (info: any) => {
        const status = info.getValue();
        return getStatusBadge(status);
      },
    },
  ];

  const actions = [
    {
      label: t('actions.view'),
      icon: <Eye className="h-4 w-4" />,
      onClick: (cycle: BonusCycle) => {
        router.push(`/bonuses/${cycle.id}`);
      },
    },
    {
      label: t('actions.delete'),
      icon: <Trash2 className="h-4 w-4" />,
      variant: 'destructive' as const,
      onClick: (cycle: BonusCycle) => setDeleteId(cycle.id),
      condition: (cycle: BonusCycle) => cycle.status !== 'approved'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
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
                <span className="hidden sm:inline">{t('createButton')}</span>
              </Button>
            }
          />
        </div>
      </div>

      <FilterBar
        filters={[
          {
            id: 'status',
            label: t('filters.status'),
            type: 'select' as const,
            options: [
              { value: 'all', label: t('status.allStatuses') },
              { value: 'pending', label: t('status.pending') },
              { value: 'approved', label: t('status.approved') },
              { value: 'rejected', label: t('status.rejected') }
            ]
          },
          {
            id: 'year',
            label: t('filters.year'),
            type: 'select' as const,
            options: [
              { value: 'all', label: t('status.allYears') },
              ...years.map(year => ({ value: year.toString(), label: year.toString() }))
            ]
          }
        ]}
        values={{
          status: statusFilter,
          year: yearFilter
        }}
        onFilterChange={(filterId, value) => {
          if (filterId === 'status') setStatusFilter(value);
          if (filterId === 'year') setYearFilter(value);
        }}
        onClearAll={clearFilters}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
      />

      <GenericDataTable
        data={cycles}
        columns={columns}
        loading={loading}
        emptyStateText={t('noData')}
        actions={actions}
        pagination={{
          currentPage,
          totalPages,
          onPageChange: handlePageChange
        }}
      />


      <ConfirmationDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title={t('delete.title')}
        description={t('delete.description')}
        onConfirm={handleDelete}
        confirmText={tCommon('delete')}
        cancelText={tCommon('cancel')}
      />
    </div>
  );
}
