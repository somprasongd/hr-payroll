'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { EmployeeSelector } from '@/components/common/employee-selector';
import { MobileEmployeeDisplay } from '@/components/common/mobile-employee-display';
import { GenericDataTable } from '@/components/common/generic-data-table';
import { Badge } from '@/components/ui/badge';
import { DateInput } from '@/components/ui/date-input';
import { PTWorklogForm } from '@/components/pt-worklog-form';
import { ptWorklogService, PTWorklog, CreatePTWorklogRequest, UpdatePTWorklogRequest } from '@/services/pt-worklog.service';
import { employeeService, Employee } from '@/services/employee.service';
import { Plus, Search, Edit, Trash2, X, MoreHorizontal, Filter, RotateCcw } from 'lucide-react';
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
import { startOfMonth, endOfMonth, format } from 'date-fns';

// Get default date range (current month)
const getDefaultStartDate = () => format(startOfMonth(new Date()), 'yyyy-MM-dd');
const getDefaultEndDate = () => format(endOfMonth(new Date()), 'yyyy-MM-dd');

export default function PTWorklogsPage() {
  const t = useTranslations('Worklogs.PT');
  const tCommon = useTranslations('Common');
  const { toast } = useToast();

  const [worklogs, setWorklogs] = useState<PTWorklog[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [mounted, setMounted] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState(getDefaultStartDate());
  const [endDateFilter, setEndDateFilter] = useState(getDefaultEndDate());

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedWorklog, setSelectedWorklog] = useState<PTWorklog | undefined>();
  const [lastSelectedEmployeeId, setLastSelectedEmployeeId] = useState<string>('');

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [worklogToDelete, setWorklogToDelete] = useState<PTWorklog | null>(null);

  // Ensure component is mounted before rendering portals
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    fetchEmployees();
    fetchWorklogs();
  }, [currentPage, employeeFilter, statusFilter, startDateFilter, endDateFilter]);

  // Cleanup on unmount to prevent portal errors
  useEffect(() => {
    return () => {
      setFormOpen(false);
      setDeleteDialogOpen(false);
    };
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await employeeService.getEmployees({ limit: 1000, status: 'active', employeeTypeCode: 'pt' });
      setEmployees(response.data);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  };

  const fetchWorklogs = async () => {
    if (!employeeFilter) {
      setWorklogs([]);
      setTotalPages(1);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await ptWorklogService.getWorklogs({
        page: currentPage,
        limit: 20,
        employeeId: employeeFilter || undefined,
        status: statusFilter || undefined,
        startDate: startDateFilter || undefined,
        endDate: endDateFilter || undefined,
      });
      setWorklogs(response.data || []);
      setTotalPages(response.meta.totalPages || 1);
    } catch (error) {
      console.error('Failed to fetch worklogs:', error);
      setWorklogs([]);
      toast({
        variant: 'destructive',
        title: t('errors.fetchFailed'),
        description: t('errors.fetchFailedDescription'),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setFormMode('create');
    setSelectedWorklog(undefined);
    setFormOpen(true);
  };

  const handleEdit = (worklog: PTWorklog) => {
    if (worklog.status !== 'pending') {
      toast({
        variant: 'destructive',
        title: t('errors.cannotEdit'),
        description: t('errors.cannotEditDescription'),
      });
      return;
    }
    setFormMode('edit');
    setSelectedWorklog(worklog);
    setFormOpen(true);
  };

  const handleDelete = (worklog: PTWorklog) => {
    if (worklog.status !== 'pending') {
      toast({
        variant: 'destructive',
        title: t('errors.cannotDelete'),
        description: t('errors.cannotDeleteDescription'),
      });
      return;
    }
    setWorklogToDelete(worklog);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!worklogToDelete) return;

    try {
      await ptWorklogService.deleteWorklog(worklogToDelete.id);
      toast({
        title: t('success.deleted'),
        description: t('success.deletedDescription'),
      });
      fetchWorklogs();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('errors.deleteFailed'),
        description: t('errors.deleteFailedDescription'),
      });
    } finally {
      setDeleteDialogOpen(false);
      setWorklogToDelete(null);
    }
  };

  const handleFormSubmit = async (data: CreatePTWorklogRequest | UpdatePTWorklogRequest) => {
    try {
      if (formMode === 'create') {
        const createData = data as CreatePTWorklogRequest;
        // Remember the selected employee
        setLastSelectedEmployeeId(createData.employeeId);
        await ptWorklogService.createWorklog(createData);
        toast({
          title: t('success.created'),
          description: t('success.createdDescription'),
        });
      } else if (selectedWorklog) {
        await ptWorklogService.updateWorklog(selectedWorklog.id, data as UpdatePTWorklogRequest);
        toast({
          title: t('success.updated'),
          description: t('success.updatedDescription'),
        });
      }
      fetchWorklogs();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('errors.saveFailed'),
        description: t('errors.saveFailedDescription'),
      });
      throw error;
    }
  };

  const handleClearFilters = () => {
    setEmployeeFilter('');
    setStatusFilter('');
    setStartDateFilter(getDefaultStartDate());
    setEndDateFilter(getDefaultEndDate());
    setCurrentPage(1);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'outline',
      approved: 'default',
      to_pay: 'secondary',
      paid: 'secondary',
    };
    return <Badge variant={variants[status] || 'outline'}>{t(`statuses.${status}`)}</Badge>;
  };

  const formatTime = (time: string | null) => {
    if (!time) return '-';
    return time.substring(0, 5); // HH:mm
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const columns = [
    {
      id: 'workDate',
      header: t('table.workDate'),
      accessorFn: (row: PTWorklog) => row.workDate,
      cell: (info: any) => format(new Date(info.getValue()), 'dd/MM/yyyy'),
    },
    {
      id: 'morningShift',
      header: t('table.morningShift'),
      accessorFn: (row: PTWorklog) => row,
      cell: (info: any) => {
        const worklog = info.getValue() as PTWorklog;
        return worklog.morningIn && worklog.morningOut ? (
          <span className="text-sm">
            {formatTime(worklog.morningIn)} - {formatTime(worklog.morningOut)}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        );
      },
    },
    {
      id: 'eveningShift',
      header: t('table.eveningShift'),
      accessorFn: (row: PTWorklog) => row,
      cell: (info: any) => {
        const worklog = info.getValue() as PTWorklog;
        return worklog.eveningIn && worklog.eveningOut ? (
          <span className="text-sm">
            {formatTime(worklog.eveningIn)} - {formatTime(worklog.eveningOut)}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        );
      },
    },
    {
      id: 'totalHours',
      header: t('table.totalHours'),
      accessorFn: (row: PTWorklog) => row.totalHours,
      cell: (info: any) => `${info.getValue().toFixed(2)} ${t('units.hours')}`,
    },
    {
      id: 'status',
      header: t('table.status'),
      accessorFn: (row: PTWorklog) => row.status,
      cell: (info: any) => getStatusBadge(info.getValue()),
    },
  ];

  const actions = [
    {
      label: t('editTitle'),
      icon: <Edit className="h-4 w-4" />,
      onClick: (worklog: PTWorklog) => handleEdit(worklog),
      condition: (worklog: PTWorklog) => worklog.status === 'pending',
    },
    {
      label: tCommon('delete'),
      icon: <Trash2 className="h-4 w-4" />,
      variant: 'destructive' as const,
      onClick: (worklog: PTWorklog) => handleDelete(worklog),
      condition: (worklog: PTWorklog) => worklog.status === 'pending',
    },
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
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{t('createButton')}</span>
          </Button>
        </div>
      </div>

      <div className={`bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-4 relative ${!showFilters ? 'hidden md:block' : ''}`}>
        <button
          onClick={handleClearFilters}
          className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          title={tCommon('clearFilter')}
        >
          <RotateCcw className="h-4 w-4" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="col-span-1 md:col-span-6 lg:col-span-4">
            <label className="text-sm font-medium mb-2 block">{t('filters.employee')}</label>
            <EmployeeSelector
              employees={employees}
              selectedEmployeeId={employeeFilter}
              onSelect={setEmployeeFilter}
              placeholder={t('placeholders.selectEmployee')}
              searchPlaceholder="ค้นหารหัสหรือชื่อพนักงาน..."
              emptyText="ไม่พบพนักงาน"
              filterType="pt"
            />
          </div>

          <div className="col-span-1 md:col-span-6 lg:col-span-2">
            <label className="text-sm font-medium mb-2 block">{t('filters.status')}</label>
            <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder={t('filters.allStatuses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.allStatuses')}</SelectItem>
                <SelectItem value="pending">{t('statuses.pending')}</SelectItem>
                <SelectItem value="approved">{t('statuses.approved')}</SelectItem>
                <SelectItem value="to_pay">{t('statuses.to_pay')}</SelectItem>
                <SelectItem value="paid">{t('statuses.paid')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-1 md:col-span-3 lg:col-span-3">
            <label className="text-sm font-medium mb-2 block">{t('filters.startDate')}</label>
            <DateInput value={startDateFilter} onValueChange={setStartDateFilter} />
          </div>

          <div className="col-span-1 md:col-span-3 lg:col-span-3">
            <label className="text-sm font-medium mb-2 block">{t('filters.endDate')}</label>
            <DateInput value={endDateFilter} onValueChange={setEndDateFilter} />
          </div>
        </div>
      </div>

      {/* Mobile Employee Display */}
      {!showFilters && employeeFilter && (
        <MobileEmployeeDisplay
          employees={employees}
          selectedEmployeeId={employeeFilter}
          onSelect={setEmployeeFilter}
        />
      )}

      <GenericDataTable
        data={worklogs}
        columns={columns}
        loading={loading}
        emptyStateText={!employeeFilter ? t('placeholders.selectEmployee') : t('noData')}
        actions={actions}
        pagination={{
          currentPage,
          totalPages,
          onPageChange: handlePageChange
        }}
      />

      {/* Form Dialog */}
      {mounted && (
        <PTWorklogForm
          open={formOpen}
          onOpenChange={setFormOpen}
          onSubmit={handleFormSubmit}
          employees={employees}
          worklog={selectedWorklog}
          mode={formMode}
          lastSelectedEmployeeId={employeeFilter || lastSelectedEmployeeId}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {mounted && (
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
              <AlertDialogDescription>{t('deleteDialog.description')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete}>{tCommon('delete')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
