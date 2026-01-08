'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Filter, Plus, Trash2, SquarePen, RotateCcw, MoreHorizontal, Printer } from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ColumnDef } from '@tanstack/react-table';
import { salaryAdvanceService, SalaryAdvance } from '@/services/salary-advance-service';
import { employeeService, Employee } from '@/services/employee.service';
import { format } from 'date-fns';
import { CreateSalaryAdvanceDialog } from './create-salary-advance-dialog';
import { EditSalaryAdvanceDialog } from './edit-salary-advance-dialog';
import { SalaryAdvancePrintDialog } from './salary-advance-print-dialog';
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuthStore } from '@/store/auth-store';
import { EmployeeSelector } from '@/components/common/employee-selector';
import { MobileEmployeeDisplay } from '@/components/common/mobile-employee-display';
import { useBranchChange } from '@/hooks/use-branch-change';
import { EmployeeCellDisplay } from '@/components/common/employee-cell-display';
import { GenericDataTable, ActionConfig } from '@/components/common/generic-data-table';

export function SalaryAdvanceList() {
  const t = useTranslations('SalaryAdvance');
  const tCommon = useTranslations('Common');
  const { toast } = useToast();
  const user = useAuthStore((state) => state.user);
  const searchParams = useSearchParams();
  
  const [data, setData] = useState<SalaryAdvance[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'pending');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<SalaryAdvance | null>(null);
  const [deleteItem, setDeleteItem] = useState<SalaryAdvance | null>(null);
  const [printId, setPrintId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Refetch when branch changes
  useBranchChange(useCallback(() => {
    fetchEmployees();
    setEmployeeFilter('all');
    setStatusFilter('pending');
    setPage(1);
    setData([]);
    // Force refetch by incrementing refreshKey
    setRefreshKey(prev => prev + 1);
  }, []));

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await employeeService.getEmployees({ limit: 100, status: 'active' });
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Failed to fetch employees', error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await salaryAdvanceService.getAll({
        page,
        limit: 10,
        status: statusFilter === 'all' ? undefined : statusFilter,
        employeeId: employeeFilter === 'all' ? undefined : employeeFilter,
      });
      setData(response.data || []);
      setTotalPages(response.meta.totalPages);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: tCommon('error'),
        description: tCommon('errorLoadingData'),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, statusFilter, employeeFilter, refreshKey]);

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      await salaryAdvanceService.delete(deleteItem.id);
      toast({
        title: tCommon('success'),
        description: t('deleteSuccess'),
      });
      fetchData();
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: tCommon('error'),
        description: t('deleteError'),
      });
    } finally {
      setDeleteItem(null);
    }
  };

  const clearFilters = () => {
    setStatusFilter('pending');
    setEmployeeFilter('all');
    setPage(1);
  };

  // Define columns for GenericDataTable
  const columns: ColumnDef<SalaryAdvance>[] = useMemo(() => [
    {
      accessorKey: 'advanceDate',
      header: t('advanceDate'),
      cell: ({ row }) => format(new Date(row.original.advanceDate), 'dd/MM/yyyy'),
    },
    {
      accessorKey: 'amount',
      header: t('amount'),
      cell: ({ row }) => row.original.amount.toLocaleString(),
    },
    {
      accessorKey: 'payrollMonthDate',
      header: t('payrollMonth'),
      cell: ({ row }) => format(new Date(row.original.payrollMonthDate), 'MM/yyyy'),
    },
    {
      accessorKey: 'status',
      header: t('status'),
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'processed' ? 'default' : 'secondary'}>
          {t(`status${row.original.status.charAt(0).toUpperCase() + row.original.status.slice(1)}`)}
        </Badge>
      ),
    },
  ], [t]);

  // Define actions for GenericDataTable
  const actions: ActionConfig<SalaryAdvance>[] = useMemo(() => [
    {
      label: tCommon('edit'),
      icon: <SquarePen className="h-4 w-4" />,
      onClick: (item) => setEditItem(item),
      condition: (item) => item.status === 'pending' && user?.role === 'admin',
      showInDropdown: true,
    },
    {
      label: tCommon('delete'),
      icon: <Trash2 className="h-4 w-4" />,
      variant: 'destructive',
      onClick: (item) => setDeleteItem(item),
      condition: (item) => item.status === 'pending' && user?.role === 'admin',
      showInDropdown: true,
    },
  ], [tCommon, user]);

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

          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{t('create')}</span>
          </Button>
        </div>
      </div>

      <div className={`bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-4 ${!showFilters ? 'hidden md:block' : ''} ${employeeFilter !== 'all' ? 'lg:relative' : ''}`}>
        <div className="grid grid-cols-6 gap-4">
          <div className="col-span-6 lg:col-span-3">
             <EmployeeSelector
              employees={employees}
              selectedEmployeeId={employeeFilter}
              onSelect={setEmployeeFilter}
              placeholder={t('selectEmployee')}
              searchPlaceholder={t('searchEmployee')}
              emptyText={t('noEmployeeFound')}
            />
          </div>

          <div className="col-span-6 lg:col-span-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t('filterStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allStatuses')}</SelectItem>
                <SelectItem value="pending">{t('statusPending')}</SelectItem>
                <SelectItem value="processed">{t('statusProcessed')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(statusFilter !== 'all' || employeeFilter !== 'all') && (
            <div className="col-span-6 lg:absolute lg:top-4 lg:right-4 flex items-center justify-end">
              <button
                onClick={clearFilters}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                title={tCommon('clearFilter')}
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {!showFilters && employeeFilter !== 'all' && (
        <MobileEmployeeDisplay
          employees={employees}
          selectedEmployeeId={employeeFilter}
          onSelect={setEmployeeFilter}
        />
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('employee')}</TableHead>
              <TableHead>{t('advanceDate')}</TableHead>
              <TableHead>{t('amount')}</TableHead>
              <TableHead>{t('payrollMonth')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  {tCommon('loading')}
                </TableCell>
              </TableRow>
            ) : !data || data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  {tCommon('noData')}
                </TableCell>
              </TableRow>
            ) : (
              data.map((item) => {
                const emp = employees.find(e => e.id === item.employeeId);
                return (
                <TableRow key={item.id}>
                  <TableCell>
                    {emp ? <EmployeeCellDisplay employee={emp} /> : '-'}
                  </TableCell>
                  <TableCell>{format(new Date(item.advanceDate), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>{item.amount.toLocaleString()}</TableCell>
                  <TableCell>{format(new Date(item.payrollMonthDate), 'MM/yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant={item.status === 'processed' ? 'default' : 'secondary'}>
                      {t(`status${item.status.charAt(0).toUpperCase() + item.status.slice(1)}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {item.status === 'pending' && user?.role === 'admin' && (
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setEditItem(item)}
                        >
                          <SquarePen className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setPrintId(item.id)}
                          title={t('print')}
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setDeleteItem(item)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <CreateSalaryAdvanceDialog 
        open={createOpen} 
        onOpenChange={setCreateOpen}
        onSuccess={fetchData}
        defaultEmployeeId={employeeFilter !== 'all' ? employeeFilter : undefined}
        onEmployeeSelect={(empId) => {
          if (empId) {
            setEmployeeFilter(empId);
          }
        }}
      />

      {editItem && (
        <EditSalaryAdvanceDialog
          open={!!editItem}
          onOpenChange={(open: boolean) => !open && setEditItem(null)}
          item={editItem}
          onSuccess={fetchData}
        />
      )}

      {printId && (
        <SalaryAdvancePrintDialog
          open={!!printId}
          onOpenChange={(open) => !open && setPrintId(null)}
          salaryAdvanceId={printId}
        />
      )}

      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirm')}
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
