'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { format } from 'date-fns';
import { Loader2, Eye, MoreHorizontal, Filter, Plus, X, Trash2, RotateCcw } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Pagination } from '@/components/ui/pagination';

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

  // ... (rest of state and functions)
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
      
      const response = await salaryRaiseService.getCycles(params);
      setCycles(response.data || []);
      setTotalPages(response.meta?.totalPages || 1);
    } catch (error) {
      console.error('Failed to fetch cycles:', error);
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
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('fields.period')}</TableHead>
              <TableHead>{t('fields.status')}</TableHead>
              <TableHead className="text-right">{t('fields.totalEmployees')}</TableHead>
              <TableHead className="text-right">{t('fields.totalRaiseAmount')}</TableHead>
              <TableHead>{t('fields.createdAt')}</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />
                  {tCommon('loading')}
                </TableCell>
              </TableRow>
            ) : (cycles?.length || 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No cycles found
                </TableCell>
              </TableRow>
            ) : (
              cycles.map((cycle) => (
                <TableRow key={cycle.id}>
                  <TableCell>
                    {format(new Date(cycle.periodStartDate), 'dd/MM/yyyy')} - {format(new Date(cycle.periodEndDate), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>{getStatusBadge(cycle.status)}</TableCell>
                  <TableCell className="text-right">{cycle.totalEmployees || 0}</TableCell>
                  <TableCell className="text-right">
                    {cycle.totalRaiseAmount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                  </TableCell>
                  <TableCell>
                    {format(new Date(cycle.createdAt), 'dd/MM/yyyy HH:mm')}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>{t('actions.view')}</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => router.push(`/salary-raise/${cycle.id}`)}>
                          <Eye className="mr-2 h-4 w-4" />
                          {t('actions.view')}
                        </DropdownMenuItem>
                        {(cycle.status === 'pending' || cycle.status === 'rejected') && (
                          <DropdownMenuItem 
                            onClick={() => handleDeleteClick(cycle)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
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
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
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
