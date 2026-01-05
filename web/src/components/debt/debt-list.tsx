'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter, Plus, Trash2, Eye, RotateCcw, Wallet, Clock, Pencil } from "lucide-react";
import { debtService, DebtTxn } from '@/services/debt.service';
import { employeeService, Employee } from '@/services/employee.service';
import { format } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { Combobox } from "@/components/ui/combobox";
import { useAuthStore } from '@/store/auth-store';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { accumulationService } from '@/services/accumulation.service';
import { GenericDataTable } from '@/components/common/generic-data-table';
import { FilterBar } from '@/components/common/filter-bar';
import { ConfirmationDialog } from '@/components/common/confirmation-dialog';
import { ActionDropdown } from '@/components/common/action-dropdown';
import { EmployeeSelector } from '@/components/common/employee-selector';
import { MobileEmployeeDisplay } from '@/components/common/mobile-employee-display';
import { EmployeeCellDisplay } from '@/components/common/employee-cell-display';
import { AccumulationAdjustDialog } from '@/components/employees/accumulation-adjust-dialog';

import { CreateRepaymentDialog } from './create-repayment-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useBranchChange } from '@/hooks/use-branch-change';

export function DebtList() {
  const t = useTranslations('Debt');
  const tCommon = useTranslations('Common');
  const { toast } = useToast();
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  
  const [data, setData] = useState<DebtTxn[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>(searchParams.get('employeeId') || 'all');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [deleteItem, setDeleteItem] = useState<DebtTxn | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [repaymentOpen, setRepaymentOpen] = useState(false);
  const [outstandingDebt, setOutstandingDebt] = useState(0);
  const [pendingInstallments, setPendingInstallments] = useState(0);
  const [hasOutstandingFilter, setHasOutstandingFilter] = useState(true);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);


  // Refetch when branch changes
  useBranchChange(useCallback(() => {
    fetchEmployees();
    setEmployeeFilter('all');
    setStatusFilter('all');
    setTypeFilter('all');
    setHasOutstandingFilter(true);
    setPage(1);
    setData([]);
    setOutstandingDebt(0);
    setPendingInstallments(0);
    // Force refetch by incrementing refreshKey
    setRefreshKey(prev => prev + 1);
  }, []));

  useEffect(() => {
    fetchEmployees();
  }, [hasOutstandingFilter]);

  const fetchEmployees = async () => {
    try {
      const response = await employeeService.getEmployees({ 
        limit: 100, 
        status: 'active',
        hasOutstandingDebt: hasOutstandingFilter || undefined
      });
      setEmployees(response.data || []);
      // Reset employee filter if current selection is not in the new list
      if (employeeFilter !== 'all') {
        const employeeExists = response.data?.some(e => e.id === employeeFilter);
        if (!employeeExists) {
          setEmployeeFilter('all');
        }
      }
    } catch (error) {
      console.error('Failed to fetch employees', error);
    }
  };

  const fetchDebtSummary = async (empId: string) => {
    try {
      const response = await accumulationService.getAccumulations(empId);
      const loanRecord = response.data.find(r => r.accumType === 'loan_outstanding');
      setOutstandingDebt(loanRecord?.amount || 0);
    } catch (error) {
      console.error('Failed to fetch debt summary', error);
      setOutstandingDebt(0);
    }
  };

  const fetchPendingInstallments = async (empId: string) => {
    try {
      const response = await debtService.getOutstandingInstallments(empId);
      setPendingInstallments(response.outstandingAmount || 0);
    } catch (error) {
      console.error('Failed to fetch pending installments', error);
      setPendingInstallments(0);
    }
  };

  const fetchData = async () => {
    // Allow fetching all employees when no filter is selected
    if (employeeFilter === 'all') {
      setOutstandingDebt(0);
      setPendingInstallments(0);
    }

    try {
      setLoading(true);
      
      // Fetch debt summary and pending installments only when employee is selected
      if (employeeFilter !== 'all') {
        await Promise.all([
          fetchDebtSummary(employeeFilter),
          fetchPendingInstallments(employeeFilter)
        ]);
      }
      
      const response = await debtService.getDebtTxns({
        page,
        limit: 10,
        status: statusFilter === 'all' ? undefined : statusFilter,
        type: typeFilter === 'all' ? undefined : typeFilter,
        employeeId: employeeFilter === 'all' ? undefined : employeeFilter,
      });
      // Filter out installment type transactions as they are child records
      const filteredData = (response.data || []).filter(item => item.txnType !== 'installment');
      setData(filteredData);
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
  }, [page, statusFilter, typeFilter, employeeFilter, refreshKey]);

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      await debtService.deleteDebtTxn(deleteItem.id);
      toast({
        title: tCommon('success'),
        description: tCommon('deleteSuccess'),
      });
      fetchData();
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: tCommon('error'),
        description: tCommon('error'),
      });
    } finally {
      setDeleteItem(null);
    }
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setEmployeeFilter('all');
    setHasOutstandingFilter(false);
    setPage(1);
  };

  const columns = [
    {
      id: 'employee',
      header: () => t('fields.employee'),
      accessorFn: (row: DebtTxn) => row,
      cell: (info: any) => {
        const item = info.getValue() as DebtTxn;
        const emp = employees.find(e => e.id === item.employeeId);
        if (!emp) return '-';
        return <EmployeeCellDisplay employee={emp} />;
      },
    },
    {
      id: 'txnDate',
      header: () => t('fields.txnDate'),
      accessorFn: (row: DebtTxn) => format(new Date(row.txnDate), 'dd/MM/yyyy'),
      cell: (info: any) => info.getValue(),
    },
    {
      id: 'txnType',
      header: () => t('fields.txnType'),
      accessorFn: (row: DebtTxn) => row,
      cell: (info: any) => {
        const item = info.getValue() as DebtTxn;
        return (
          <Badge variant="outline">
            {t(`types.${item.txnType}`)}
            {item.installments && item.installments.length > 0 && ` (${t('types.installment')})`}
          </Badge>
        );
      },
    },
    {
      id: 'amount',
      header: () => t('fields.amount'),
      accessorFn: (row: DebtTxn) => row.amount.toLocaleString(),
      cell: (info: any) => info.getValue(),
    },
    {
      id: 'status',
      header: () => t('fields.status'),
      accessorFn: (row: DebtTxn) => row.status,
      cell: (info: any) => {
        const status = info.getValue();
        return (
          <Badge variant={status === 'approved' ? 'default' : 'secondary'}>
            {t(`status.${status}`)}
          </Badge>
        );
      },
    },
  ];

  const actions = [
    {
      label: t('actions.view'),
      icon: <Eye className="w-4 h-4" />,
      onClick: (item: DebtTxn) => router.push(`/${locale}/debt/${item.id}`),
    },
    {
      label: t('actions.delete'),
      icon: <Trash2 className="w-4 h-4" />,
      variant: 'destructive' as const,
      onClick: (item: DebtTxn) => setDeleteItem(item),
      condition: (item: DebtTxn) => item.status === 'pending' && user?.role === 'admin'
    }
  ];

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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{t('createButton')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/${locale}/debt/create${employeeFilter !== 'all' ? `?employeeId=${employeeFilter}` : ''}`)}>
                {t('types.loan')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setRepaymentOpen(true)}>
                {t('actions.repay')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className={`bg-white p-4 rounded-lg border border-gray-200 shadow-sm ${!showFilters ? 'hidden md:block' : ''} ${employeeFilter !== 'all' ? 'lg:relative' : ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-full lg:w-auto lg:min-w-[400px]">
               <EmployeeSelector
                employees={employees}
                selectedEmployeeId={employeeFilter}
                onSelect={setEmployeeFilter}
                placeholder={t('fields.employee')}
                searchPlaceholder={tCommon('search')}
                emptyText={tCommon('noData')}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="hasOutstanding"
                checked={hasOutstandingFilter}
                onCheckedChange={(checked) => setHasOutstandingFilter(checked === true)}
              />
              <label
                htmlFor="hasOutstanding"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 whitespace-nowrap"
              >
                {t('filters.hasOutstanding')}
              </label>
            </div>

            <div className="w-full sm:w-[150px]">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t('status.allStatuses')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('status.allStatuses')}</SelectItem>
                  <SelectItem value="pending">{t('status.pending')}</SelectItem>
                  <SelectItem value="approved">{t('status.approved')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-[150px]">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t('status.allTypes')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('status.allTypes')}</SelectItem>
                  <SelectItem value="loan">{t('types.loan')}</SelectItem>
                  <SelectItem value="other">{t('types.other')}</SelectItem>
                  <SelectItem value="repayment">{t('types.repayment')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {(statusFilter !== 'all' || typeFilter !== 'all' || employeeFilter !== 'all' || hasOutstandingFilter) && (
            <button
              onClick={clearFilters}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              title={tCommon('clearFilter')}
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Mobile Employee Display */}
      {!showFilters && employeeFilter !== 'all' && (
        <MobileEmployeeDisplay
          employees={employees}
          selectedEmployeeId={employeeFilter}
          onSelect={setEmployeeFilter}
        />
      )}

      {employeeFilter !== 'all' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                {t('summary.outstandingDebt')}
              </CardTitle>
              <div className="flex items-center gap-2">
                {user?.role === 'admin' && (
                  <button
                    onClick={() => setAdjustDialogOpen(true)}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    title={tCommon('edit')}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                <Wallet className="h-4 w-4 text-gray-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{outstandingDebt.toLocaleString()}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                {t('summary.pendingInstallments')}
              </CardTitle>
              <Clock className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{pendingInstallments.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <GenericDataTable
        data={data}
        columns={columns}
        loading={loading}
        emptyStateText={tCommon('noData')}
        actions={actions}
        pagination={{
          currentPage: page,
          totalPages,
          onPageChange: setPage
        }}
      />


      <ConfirmationDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        title={tCommon('delete')}
        description={tCommon('confirm')}
        onConfirm={handleDelete}
        confirmText={tCommon('delete')}
        cancelText={tCommon('cancel')}
      />

      <CreateRepaymentDialog 
        open={repaymentOpen} 
        onOpenChange={setRepaymentOpen} 
        onSuccess={fetchData} 
        selectedEmployeeId={employeeFilter}
      />

      {employeeFilter !== 'all' && (
        <AccumulationAdjustDialog
          open={adjustDialogOpen}
          onOpenChange={setAdjustDialogOpen}
          employeeId={employeeFilter}
          type="loan_outstanding"
          currentAmount={outstandingDebt}
          onSuccess={() => {
            fetchDebtSummary(employeeFilter);
            fetchEmployees();
          }}
        />
      )}
    </div>
  );
}
