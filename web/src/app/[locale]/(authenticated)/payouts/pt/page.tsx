'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useMemo } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus, Filter, RotateCcw, Eye, Trash2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmployeeSelector } from '@/components/common/employee-selector';
import { MobileEmployeeDisplay } from '@/components/common/mobile-employee-display';
import { EmployeeCellDisplay } from '@/components/common/employee-cell-display';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { payoutPtService, PayoutPt } from '@/services/payout-pt.service';
import { employeeService } from '@/services/employee.service';
import { Employee } from '@/services/employee.service';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Pagination } from '@/components/ui/pagination';
import { useToast } from '@/hooks/use-toast';
import { DateInput } from '@/components/ui/date-input';
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
import { useTenantStore } from '@/store/tenant-store';
import { GenericDataTable, ActionConfig } from '@/components/common/generic-data-table';
import { ColumnDef } from '@tanstack/react-table';


export default function PayoutPtListPage() {
  const t = useTranslations('Payouts.PT');
  const tCommon = useTranslations('Common');
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [payouts, setPayouts] = useState<PayoutPt[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // Get current branch from tenant store
  const { currentBranch } = useTenantStore();
  const currentBranchId = currentBranch?.id;
  
  // Filters - initialize from URL query
  const [status, setStatus] = useState<string>('all');
  const [employeeId, setEmployeeId] = useState<string>(searchParams.get('employeeId') || '');
  const [startDate, setStartDate] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  // Refetch employees when branch changes
  useEffect(() => {
    fetchEmployees();
    // Reset employee selection when branch changes
    setEmployeeId('');
    setPayouts([]);
  }, [currentBranchId]);

  useEffect(() => {
    fetchPayouts();
  }, [status, employeeId, startDate, endDate, currentPage]);

  const fetchEmployees = async () => {
    try {
      const data = await employeeService.getEmployees({ limit: 100, status: 'active', employeeTypeCode: 'pt' });
      setEmployees(data.data);
    } catch (error) {
      console.error('Failed to fetch employees', error);
    }
  };

  const fetchPayouts = async () => {
    setLoading(true);
    try {
      const params: any = {
        limit: 20,
        page: currentPage
      };
      if (status !== 'all') params.status = status;
      if (employeeId) params.employeeId = employeeId;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const data = await payoutPtService.getPayouts(params);
      setPayouts(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
    } catch (error) {
      console.error('Failed to fetch payouts', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'to_pay':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">{t('statuses.to_pay')}</Badge>;
      case 'paid':
        return <Badge variant="default" className="bg-green-100 text-green-800">{t('statuses.paid')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const clearFilters = () => {
    setStatus('all');
    setEmployeeId('');
    setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await payoutPtService.delete(deleteId);
      toast({
        title: tCommon('success'),
        description: t('deleteSuccess'),
      });
      fetchPayouts();
    } catch (error) {
      console.error('Failed to delete payout', error);
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: t('deleteError'),
      });
    } finally {
      setDeleteId(null);
    }
  };

  // Define columns for GenericDataTable
  const columns: ColumnDef<PayoutPt>[] = useMemo(() => [
    {
      accessorKey: 'createdAt',
      header: t('fields.createdAt'),
      cell: ({ row }) => 
        row.original.createdAt && !isNaN(new Date(row.original.createdAt).getTime()) 
          ? format(new Date(row.original.createdAt), 'dd/MM/yyyy HH:mm') 
          : '-',
    },
    {
      accessorKey: 'itemCount',
      header: t('fields.itemCount'),
    },
    {
      accessorKey: 'totalHours',
      header: t('fields.totalHours'),
    },
    {
      accessorKey: 'amount',
      header: t('fields.amountTotal'),
      cell: ({ row }) => (row.original.amount || 0).toLocaleString(),
    },
    {
      accessorKey: 'status',
      header: t('fields.status'),
      cell: ({ row }) => getStatusBadge(row.original.status),
    },
  ], [t]);

  // Define actions for GenericDataTable
  const actions: ActionConfig<PayoutPt>[] = useMemo(() => [
    {
      label: t('actions.view'),
      icon: <Eye className="h-4 w-4" />,
      href: (payout) => `/payouts/pt/${payout.id}`,
    },
    {
      label: tCommon('delete'),
      icon: <Trash2 className="h-4 w-4" />,
      variant: 'destructive',
      onClick: (payout) => setDeleteId(payout.id),
      condition: (payout) => payout.status === 'to_pay',
    },
  ], [t, tCommon]);

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
          <Link href={`/payouts/pt/create${employeeId ? `?employeeId=${employeeId}` : ''}`}>
            <Button>
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('createButton')}</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className={`bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-4 relative ${!showFilters ? 'hidden md:block' : ''}`}>
        <button
          onClick={clearFilters}
          className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          title={tCommon('clearFilter')}
        >
          <RotateCcw className="h-4 w-4" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="col-span-1 md:col-span-6 lg:col-span-4">
            <label className="text-sm font-medium mb-1 block">{t('fields.employee')}</label>
            <EmployeeSelector
              employees={employees}
              selectedEmployeeId={employeeId}
              onSelect={setEmployeeId}
              placeholder={t('filters.selectEmployee') || 'Select Employee'}
              searchPlaceholder="Search employee..."
              emptyText="No employee found"
              filterType="pt"
            />
          </div>

          <div className="col-span-1 md:col-span-6 lg:col-span-2">
            <label className="text-sm font-medium mb-1 block">{t('fields.status')}</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder={t('filters.allStatuses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.allStatuses') || 'All Statuses'}</SelectItem>
                <SelectItem value="to_pay">{t('statuses.to_pay')}</SelectItem>
                <SelectItem value="paid">{t('statuses.paid')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-1 md:col-span-3 lg:col-span-3">
            <label className="text-sm font-medium mb-1 block">{t('filters.startDate')}</label>
            <DateInput value={startDate} onValueChange={setStartDate} />
          </div>

          <div className="col-span-1 md:col-span-3 lg:col-span-3">
            <label className="text-sm font-medium mb-1 block">{t('filters.endDate')}</label>
            <DateInput value={endDate} onValueChange={setEndDate} />
          </div>
        </div>
      </div>

      {/* Mobile Employee Display */}
      {!showFilters && employeeId && (
        <MobileEmployeeDisplay
          employees={employees}
          selectedEmployeeId={employeeId}
          onSelect={setEmployeeId}
        />
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('fields.employee')}</TableHead>
              <TableHead>{t('fields.createdAt')}</TableHead>
              <TableHead>{t('fields.itemCount')}</TableHead>
              <TableHead>{t('fields.totalHours')}</TableHead>
              <TableHead>{t('fields.amountTotal')}</TableHead>
              <TableHead>{t('fields.status')}</TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  {tCommon('loading')}
                </TableCell>
              </TableRow>
            ) : payouts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  {t('noData')}
                </TableCell>
              </TableRow>
            ) : (
              payouts.map((payout) => {
                const emp = employees.find(e => e.id === payout.employeeId);
                return (
                  <TableRow key={payout.id}>
                    <TableCell>
                      {emp ? <EmployeeCellDisplay employee={emp} /> : '-'}
                    </TableCell>
                    <TableCell>
                      {payout.createdAt && !isNaN(new Date(payout.createdAt).getTime()) 
                        ? format(new Date(payout.createdAt), 'dd/MM/yyyy HH:mm') 
                        : '-'}
                    </TableCell>
                    <TableCell>{payout.itemCount}</TableCell>
                    <TableCell>{payout.totalHours}</TableCell>
                    <TableCell>{(payout.amount || 0).toLocaleString()}</TableCell>
                    <TableCell>{getStatusBadge(payout.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/payouts/pt/${payout.id}`}>
                          <Button variant="ghost" size="icon" title={t('actions.view')}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {payout.status === 'to_pay' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(payout.id)}
                            title={tCommon('delete')}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tCommon('confirmDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tCommon('confirmDeleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
