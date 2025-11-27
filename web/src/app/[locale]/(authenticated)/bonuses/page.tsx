'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { Loader2, Eye, Trash2, X, MoreHorizontal, Filter, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CreateCycleDialog } from '@/components/bonus/create-cycle-dialog';
import { bonusService, BonusCycle } from '@/services/bonus-service';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Pagination } from '@/components/ui/pagination';

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

  const handleCreateSuccess = () => {
    fetchCycles();
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
                <SelectValue placeholder={t('filters.status')} />
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
                <SelectValue placeholder={t('filters.year')} />
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

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('fields.payrollMonth')}</TableHead>
              <TableHead>{t('fields.period')}</TableHead>
              <TableHead>{t('fields.totalEmployees')}</TableHead>
              <TableHead>{t('fields.totalAmount')}</TableHead>
              <TableHead>{t('fields.status')}</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : (cycles?.length || 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {t('noData')}
                </TableCell>
              </TableRow>
            ) : (
              cycles?.map((cycle) => (
                <TableRow key={cycle.id}>
                  <TableCell>{format(new Date(cycle.payrollMonthDate), 'MM/yyyy')}</TableCell>
                  <TableCell>
                    {format(new Date(cycle.periodStartDate), 'dd/MM/yyyy')} -{' '}
                    {format(new Date(cycle.periodEndDate), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>{cycle.totalEmployees}</TableCell>
                  <TableCell>{cycle.totalBonusAmount?.toLocaleString()}</TableCell>
                  <TableCell>
                    {getStatusBadge(cycle.status)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/bonuses/${cycle.id}`} className="cursor-pointer">
                            <Eye className="h-4 w-4 mr-2" />
                            {t('actions.view')}
                          </Link>
                        </DropdownMenuItem>
                        {cycle.status !== 'approved' && (
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => setDeleteId(cycle.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
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

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('delete.description')}</AlertDialogDescription>
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
