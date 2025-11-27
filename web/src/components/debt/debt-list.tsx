'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Filter, Plus, Trash2, Eye, RotateCcw, Wallet, Clock } from "lucide-react";
import { debtService, DebtTxn } from '@/services/debt.service';
import { employeeService, Employee } from '@/services/employee.service';
import { format } from 'date-fns';
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
import { Combobox } from "@/components/ui/combobox";
import { useAuthStore } from '@/store/auth-store';
import { useRouter, useSearchParams } from 'next/navigation';
import { Pagination } from "@/components/ui/pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { accumulationService } from '@/services/accumulation.service';

import { CreateRepaymentDialog } from './create-repayment-dialog';

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
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>(searchParams.get('employeeId') || 'all');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [deleteItem, setDeleteItem] = useState<DebtTxn | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [repaymentOpen, setRepaymentOpen] = useState(false);
  const [outstandingDebt, setOutstandingDebt] = useState(0);
  const [pendingInstallments, setPendingInstallments] = useState(0);


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
    if (employeeFilter === 'all') {
      setData([]);
      setTotalPages(1);
      setLoading(false);
      setOutstandingDebt(0);
      setPendingInstallments(0);
      return;
    }

    try {
      setLoading(true);
      
      // Fetch debt summary and pending installments in parallel
      await Promise.all([
        fetchDebtSummary(employeeFilter),
        fetchPendingInstallments(employeeFilter)
      ]);
      
      const response = await debtService.getDebtTxns({
        page,
        limit: 10,
        status: statusFilter === 'all' ? undefined : statusFilter,
        type: typeFilter === 'all' ? undefined : typeFilter,
        employeeId: employeeFilter,
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
  }, [page, statusFilter, typeFilter, employeeFilter]);

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
    setPage(1);
  };

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

      <div className={`bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-4 ${!showFilters ? 'hidden md:block' : ''}`}>
        <div className="grid grid-cols-6 gap-4">
          <div className="col-span-6 lg:col-span-2">
             <Combobox
              options={employees.map(emp => ({
                value: emp.id,
                label: `${emp.employeeNumber} - ${emp.fullNameTh || `${emp.firstName} ${emp.lastName}`}`,
                searchText: `${emp.employeeNumber} ${emp.fullNameTh} ${emp.firstName} ${emp.lastName}`
              }))}
              value={employeeFilter === 'all' ? '' : employeeFilter}
              onValueChange={(value) => setEmployeeFilter(value || 'all')}
              placeholder={t('fields.employee')}
              searchPlaceholder={tCommon('search')}
              emptyText={tCommon('noData')}
            />
          </div>

          <div className="col-span-6 md:col-span-3 lg:col-span-1">
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

          <div className="col-span-6 md:col-span-3 lg:col-span-1">
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

          {(statusFilter !== 'all' || employeeFilter !== 'all' || typeFilter !== 'all') && (
            <div className="col-span-6 lg:col-span-2 flex items-center justify-end">
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

      {employeeFilter !== 'all' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                {t('summary.outstandingDebt')}
              </CardTitle>
              <Wallet className="h-4 w-4 text-gray-500" />
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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('fields.txnDate')}</TableHead>
              <TableHead>{t('fields.txnType')}</TableHead>
              <TableHead>{t('fields.amount')}</TableHead>
              <TableHead>{t('fields.status')}</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  {tCommon('loading')}
                </TableCell>
              </TableRow>
            ) : !data || data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  {employeeFilter === 'all' ? t('selectEmployeeToView') : tCommon('noData')}
                </TableCell>
              </TableRow>
            ) : (
              data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{format(new Date(item.txnDate), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                        {t(`types.${item.txnType}`)}
                        {item.installments && item.installments.length > 0 && ` (${t('types.installment')})`}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.amount.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={item.status === 'approved' ? 'default' : 'secondary'}>
                      {t(`status.${item.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/${locale}/debt/${item.id}`)}>
                          <Eye className="w-4 h-4 mr-2" />
                          {t('actions.view')}
                        </DropdownMenuItem>
                        {item.status === 'pending' && user?.role === 'admin' && (
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => setDeleteItem(item)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {t('actions.delete')}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination 
        currentPage={page} 
        totalPages={totalPages} 
        onPageChange={setPage} 
      />

      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tCommon('delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tCommon('confirm')}
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

      <CreateRepaymentDialog 
        open={repaymentOpen} 
        onOpenChange={setRepaymentOpen} 
        onSuccess={fetchData} 
        selectedEmployeeId={employeeFilter}
      />
    </div>
  );
}
