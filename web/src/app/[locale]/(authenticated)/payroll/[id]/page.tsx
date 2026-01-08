'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { format } from 'date-fns';
import { ArrowLeft, Banknote, Search, Edit, Eye, Filter, RotateCcw, CheckCircle, Printer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GenericDataTable } from '@/components/common/generic-data-table';
import { PayslipEditDialog } from '@/components/payroll/payslip-edit-dialog';
import { PaymentCoverSheetDialog } from '@/components/payroll/payment-cover-sheet-dialog';
import { BatchPrintDialog } from '@/components/payroll/batch-print-dialog';


import { ActionDropdown } from '@/components/common/action-dropdown';
import { EmployeeTypeBadge } from '@/components/common/employee-type-badge';
import { ConfirmationDialog } from '@/components/common/confirmation-dialog';
import { EmployeePhoto } from '@/components/common/employee-photo';
import { useAuthStore } from '@/store/auth-store';
import { 
  payrollService, 
  PayrollRunDetail, 
  PayrollItem,
} from '@/services/payroll.service';

export default function PayrollDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('Payroll');
  const tCommon = useTranslations('Common');
  const tEmployees = useTranslations('Employees');
  const locale = useLocale();
  const { user } = useAuthStore();
  
  const runId = params.id as string;
  
  const [run, setRun] = useState<PayrollRunDetail | null>(null);
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filters
  const [employeeTypeFilter, setEmployeeTypeFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number>(-1);

  // Approve dialog state
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [approving, setApproving] = useState(false);

  // Batch print dialog state
  const [batchPrintDialogOpen, setBatchPrintDialogOpen] = useState(false);
  // Payment Cover Sheet dialog state
  const [paymentCoverSheetDialogOpen, setPaymentCoverSheetDialogOpen] = useState(false);

  const fetchRunDetail = useCallback(async () => {
    try {
      const data = await payrollService.getPayrollRunDetail(runId);
      setRun(data);
    } catch (error) {
      console.error('Failed to fetch payroll run detail:', error);
    }
  }, [runId]);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const response = await payrollService.getPayrollItems(runId, {
        page: currentPage,
        limit: 20,
        search: searchQuery || undefined,
        employeeTypeCode: employeeTypeFilter === 'all' ? undefined : employeeTypeFilter,
      });
      setItems(response.data || []);
      setTotalPages(response.meta?.totalPages || 1);
    } catch (error) {
      console.error('Failed to fetch payroll items:', error);
    } finally {
      setLoading(false);
    }
  }, [runId, currentPage, searchQuery, employeeTypeFilter]);

  useEffect(() => {
    fetchRunDetail();
  }, [fetchRunDetail]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchItems();
  };

  const clearFilters = () => {
    setSearchQuery('');
    setEmployeeTypeFilter('all');
    setCurrentPage(1);
  };

  const handleOpenEdit = (index: number) => {
    setSelectedItemIndex(index);
    setEditDialogOpen(true);
  };

  const handleNavigateItem = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && selectedItemIndex > 0) {
      setSelectedItemIndex(selectedItemIndex - 1);
    } else if (direction === 'next' && selectedItemIndex < items.length - 1) {
      setSelectedItemIndex(selectedItemIndex + 1);
    }
  };

  const handleEditSuccess = () => {
    fetchItems();
    fetchRunDetail();
  };

  const handleApprove = async () => {
    try {
      setApproving(true);
      await payrollService.approvePayrollRun(runId);
      await fetchRunDetail();
      setApproveDialogOpen(false);
    } catch (error) {
      console.error('Failed to approve payroll run:', error);
    } finally {
      setApproving(false);
    }
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

  const getEmployeeTypeBadge = (typeCode: string) => {
    return <EmployeeTypeBadge typeCode={typeCode} />;
  };

  const isPending = run?.status === 'pending';
  const isApproved = run?.status === 'approved';
  const isAdmin = user?.role === 'admin';
  const canApprove = isPending && isAdmin;

  const columns = [
    {
      id: 'employee',
      header: t('payslip.fields.employee'),
      accessorFn: (row: PayrollItem) => row.employeeName,
      cell: (info: any) => (
        <div className="flex items-center gap-2">
          {getEmployeeTypeBadge(info.row.original.employeeTypeCode)}
          <EmployeePhoto 
            photoId={info.row.original.photoId}
            firstName={info.row.original.firstName}
            lastName={info.row.original.lastName}
            size="sm"
            className="shrink-0"
          />
          <span>{info.row.original.employeeNumber} - {info.getValue()}</span>
        </div>
      ),
    },
    {
      id: 'salary',
      header: () => <div className="text-right">{t('payslip.fields.salary')}</div>,
      accessorFn: (row: PayrollItem) => row.salaryAmount,
      cell: (info: any) => (
        <div className="text-right">
          {info.getValue()?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      id: 'incomeTotal',
      header: () => <div className="text-right">{t('payslip.fields.incomeTotal')}</div>,
      accessorFn: (row: PayrollItem) => row.incomeTotal,
      cell: (info: any) => (
        <div className="text-right text-green-600">
          {info.getValue()?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      id: 'deductionTotal',
      header: () => <div className="text-right">{t('payslip.fields.deductionTotal')}</div>,
      accessorFn: (row: PayrollItem) => row.deductionTotal,
      cell: (info: any) => (
        <div className="text-right text-red-600">
          {info.getValue()?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      id: 'netPay',
      header: () => <div className="text-right">{t('payslip.fields.netPay')}</div>,
      accessorFn: (row: PayrollItem) => row.netPay,
      cell: (info: any) => (
        <div className="text-right font-semibold">
          {info.getValue()?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
  ];

  const actions = [
    {
      label: isPending ? tCommon('edit') : tCommon('view'),
      icon: isPending ? <Edit className="h-4 w-4" /> : <Eye className="h-4 w-4" />,
      onClick: (item: PayrollItem) => {
        const index = items.findIndex(i => i.id === item.id);
        if (index >= 0) handleOpenEdit(index);
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-row items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/${locale}/payroll`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Banknote className="h-6 w-6" />
            {t('detail.title')}
          </h1>
          {run && (
            <div className="text-gray-500 flex items-center gap-2">
              {format(new Date(run.payrollMonthDate), 'MM/yyyy')} • {getStatusBadge(run.status)}
            </div>
          )}
        </div>
        {/* Mobile Filter Toggle */}
        <Button
          variant="outline"
          size="icon"
          className="md:hidden"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-4 w-4" />
        </Button>
        {/* Approve Button - Admin Only */}
        {canApprove && (
          <Button onClick={() => setApproveDialogOpen(true)}>
            <CheckCircle className="h-4 w-4 mr-2" />
            {t('actions.approve')}
          </Button>
        )}
        {/* Batch Print Button - Available for pending and approved */}
        <Button variant="outline" onClick={() => setBatchPrintDialogOpen(true)}>
          <Printer className="h-4 w-4 mr-2" />
          {t('print.batchButton')}
        </Button>
        {/* Payment Cover Sheet Button */}
        <Button variant="outline" onClick={() => setPaymentCoverSheetDialogOpen(true)}>
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            {t('print.paymentCoverSheet')}
          </div>
        </Button>
      </div>

      {/* Summary Cards */}
      {run && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">{t('fields.payDate')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">
                {format(new Date(run.payDate), 'dd/MM/yyyy')}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">{t('fields.totalEmployees')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">
                {run.totalEmployees || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">{t('fields.totalNetPay')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold text-green-600">
                {(run.totalNetPay || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">{t('fields.totalTax')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold text-red-600">
                {(run.totals?.totalTax || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">{t('fields.totalSocialSecurity')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold text-red-600">
                {(run.totals?.totalSocialSecurity || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">{t('fields.totalProvidentFund')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold text-red-600">
                {(run.totals?.totalProvidentFund || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter Card */}
      <Card className={`${showFilters ? 'block' : 'hidden'} md:block`}>
        <CardContent className="py-4">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder={t('detail.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            {/* Employee Type Filter */}
            <Select value={employeeTypeFilter} onValueChange={setEmployeeTypeFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder={tEmployees('fields.employeeType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tEmployees('employeeTypes.allTypes')}</SelectItem>
                <SelectItem value="full_time">{tEmployees('employeeTypes.full_time')}</SelectItem>
                <SelectItem value="part_time">{tEmployees('employeeTypes.part_time')}</SelectItem>
              </SelectContent>
            </Select>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button type="submit" variant="outline">
                {tCommon('search')}
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={clearFilters}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Employee List Table */}
      <GenericDataTable
        data={items}
        columns={columns}
        loading={loading}
        emptyStateText={tCommon('noData')}
        actions={actions}
        pagination={{
          currentPage,
          totalPages,
          onPageChange: handlePageChange,
        }}
      />

      {/* Edit Dialog */}
      {selectedItemIndex >= 0 && items[selectedItemIndex] && run && (
        <PayslipEditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          itemId={items[selectedItemIndex].id}
          employeeName={items[selectedItemIndex].employeeName}
          employeeNumber={items[selectedItemIndex].employeeNumber}
          employeeTypeName={items[selectedItemIndex].employeeTypeName}
          canEdit={isPending}
          hasPrevious={selectedItemIndex > 0}
          hasNext={selectedItemIndex < items.length - 1}
          onNavigate={handleNavigateItem}
          onSuccess={handleEditSuccess}
          orgProfile={run.orgProfileSnapshot}
          bonusYear={run.bonusYear}
          payrollMonthDate={run.payrollMonthDate}
          periodStartDate={run.periodStartDate}
          isApproved={isApproved}
        />
      )}

      {/* Approve Confirmation Dialog */}
      <ConfirmationDialog
        open={approveDialogOpen}
        onOpenChange={setApproveDialogOpen}
        title={t('approve.title')}
        description={t('approve.description')}
        confirmText={t('actions.approve')}
        onConfirm={handleApprove}
        loading={approving}
      />

      {/* Batch Print Dialog */}
      {run && (
        <BatchPrintDialog
          open={batchPrintDialogOpen}
          onOpenChange={setBatchPrintDialogOpen}
          runId={runId}
          orgProfile={run.orgProfileSnapshot}
          bonusYear={run.bonusYear}
          payrollMonthDate={run.payrollMonthDate}
          periodStartDate={run.periodStartDate}
          isPending={isPending}
        />
      )}

      {/* Payment Cover Sheet Dialog */}
      {run && (
        <PaymentCoverSheetDialog
          open={paymentCoverSheetDialogOpen}
          onOpenChange={setPaymentCoverSheetDialogOpen}
          runId={runId}
          orgProfile={run.orgProfileSnapshot}
          payrollMonthDate={run.payrollMonthDate}
          isPending={isPending}
        />
      )}
    </div>
  );
}
