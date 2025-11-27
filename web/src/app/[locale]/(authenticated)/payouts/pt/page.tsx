'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Plus, Search, Filter, X, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
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
import { format } from 'date-fns';
import { Pagination } from '@/components/ui/pagination';


export default function PayoutPtListPage() {
  const t = useTranslations('Payouts.PT');
  const tCommon = useTranslations('Common');
  const [payouts, setPayouts] = useState<PayoutPt[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filters
  const [status, setStatus] = useState<string>('all');
  const [employeeId, setEmployeeId] = useState<string>('');

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (employeeId) {
      fetchPayouts();
    } else {
      setPayouts([]);
    }
  }, [status, employeeId, currentPage]);

  const fetchEmployees = async () => {
    try {
      const data = await employeeService.getEmployees({ limit: 100, status: 'active', employeeTypeCode: 'pt' });
      setEmployees(data.data);
    } catch (error) {
      console.error('Failed to fetch employees', error);
    }
  };

  const fetchPayouts = async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const params: any = {
        limit: 20,
        page: currentPage
      };
      if (status !== 'all') params.status = status;
      params.employeeId = employeeId;

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
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

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
          <Link href="/payouts/pt/create">
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
            <Combobox
              options={employees.map(emp => ({
                value: emp.id || emp.ID || '',
                label: `${emp.employeeNumber || emp.EmployeeNumber || ''} - ${emp.fullNameTh || `${emp.firstName || emp.FirstName || ''} ${emp.lastName || emp.LastName || ''}`}`.trim(),
                searchText: `${emp.employeeNumber || emp.EmployeeNumber || ''} ${emp.fullNameTh || ''} ${emp.firstName || emp.FirstName || ''} ${emp.lastName || emp.LastName || ''}`.toLowerCase(),
              }))}
              value={employeeId}
              onValueChange={setEmployeeId}
              placeholder={t('filters.selectEmployee') || 'Select Employee'}
              searchPlaceholder="Search employee..."
              emptyText="No employee found"
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
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('fields.createdAt')}</TableHead>
              <TableHead>{t('fields.itemCount')}</TableHead>
              <TableHead>{t('fields.totalHours')}</TableHead>
              <TableHead>{t('fields.amountTotal')}</TableHead>
              <TableHead>{t('fields.status')}</TableHead>
              <TableHead className="text-right">{t('actions.view')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!employeeId ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  {t('filters.selectEmployee') || 'Please select an employee to view payouts'}
                </TableCell>
              </TableRow>
            ) : loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  {tCommon('loading')}
                </TableCell>
              </TableRow>
            ) : payouts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  {t('noData')}
                </TableCell>
              </TableRow>
            ) : (
              payouts.map((payout) => {
                return (
                  <TableRow key={payout.id}>
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
                      <Link href={`/payouts/pt/${payout.id}`}>
                        <Button variant="ghost" size="sm">
                          {t('actions.view')}
                        </Button>
                      </Link>
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
    </div>
  );
}
