'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Loader2, Eye, Trash2, X, MoreHorizontal } from 'lucide-react';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CreateCycleDialog } from '@/components/bonus/create-cycle-dialog';
import { bonusService, BonusCycle } from '@/services/bonus-service';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function BonusListPage() {
  const t = useTranslations('Bonus');
  const tCommon = useTranslations('Common');
  const { toast } = useToast();
  const [cycles, setCycles] = useState<BonusCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 13 }, (_, i) => currentYear - 10 + i);

  const fetchCycles = async () => {
    try {
      setLoading(true);
      const params: any = { limit: 100 };
      if (statusFilter && statusFilter !== 'all') {
        params.status = statusFilter;
      }
      if (yearFilter && yearFilter !== 'all') {
        params.year = parseInt(yearFilter);
      }
      const data = await bonusService.getCycles(params);
      setCycles(data || []);
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
  }, [statusFilter, yearFilter]);

  const clearFilters = () => {
    setStatusFilter('all');
    setYearFilter('all');
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
        return <Badge variant="default" className="bg-green-500">{t('status.approved')}</Badge>;
      case 'rejected':
        return <Badge variant="destructive">{t('status.rejected')}</Badge>;
      default:
        return <Badge variant="secondary">{t('status.pending')}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('listTitle')}</h1>
          <p className="text-muted-foreground hidden sm:block">{t('description')}</p>
        </div>
        <CreateCycleDialog onSuccess={fetchCycles} />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder={t('filters.status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tCommon('all')}</SelectItem>
            <SelectItem value="pending">{t('status.pending')}</SelectItem>
            <SelectItem value="approved">{t('status.approved')}</SelectItem>
            <SelectItem value="rejected">{t('status.rejected')}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder={t('filters.year')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tCommon('all')}</SelectItem>
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(statusFilter !== 'all' || yearFilter !== 'all') && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearFilters}
            className="h-10 px-4 w-full sm:w-auto"
          >
            <X className="h-4 w-4 mr-2" />
            {tCommon('clearFilter')}
          </Button>
        )}
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
                  <TableCell>{format(new Date(cycle.payrollMonthDate), 'MMM yyyy')}</TableCell>
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
