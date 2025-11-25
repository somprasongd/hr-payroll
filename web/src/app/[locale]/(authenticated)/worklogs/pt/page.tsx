'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DateInput } from '@/components/ui/date-input';
import { PTWorklogForm } from '@/components/pt-worklog-form';
import { ptWorklogService, PTWorklog, CreatePTWorklogRequest, UpdatePTWorklogRequest } from '@/services/pt-worklog.service';
import { employeeService, Employee } from '@/services/employee.service';
import { Plus, Search, Edit, Trash2, X, MoreHorizontal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
      const response = await employeeService.getEmployees({ limit: 1000, status: 'active' });
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          {t('createButton')}
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <label className="text-sm font-medium mb-2 block">{t('filters.employee')}</label>
            <Combobox
              options={employees
                .filter(emp => emp.employeeTypeName?.includes('พาร์ท') || emp.employeeTypeName?.toLowerCase().includes('part'))
                .map(emp => ({
                  value: emp.id,
                  label: `${emp.employeeNumber || ''} - ${emp.fullNameTh || `${emp.firstName} ${emp.lastName}`}`.trim(),
                  searchText: `${emp.employeeNumber || ''} ${emp.fullNameTh || ''} ${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase(),
                }))}
              value={employeeFilter}
              onValueChange={setEmployeeFilter}
              placeholder={t('placeholders.selectEmployee')}
              searchPlaceholder="ค้นหารหัสหรือชื่อพนักงาน..."
              emptyText="ไม่พบพนักงาน"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="text-sm font-medium mb-2 block">{t('filters.status')}</label>
            <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder={t('filters.allStatuses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.allStatuses')}</SelectItem>
                <SelectItem value="pending">{t('statuses.pending')}</SelectItem>
                <SelectItem value="approved">{t('statuses.approved')}</SelectItem>

              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">{t('filters.startDate')}</label>
            <DateInput value={startDateFilter} onValueChange={setStartDateFilter} />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">{t('filters.endDate')}</label>
            <DateInput value={endDateFilter} onValueChange={setEndDateFilter} />
          </div>

          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={handleClearFilters} className="w-full">
              <X className="w-4 h-4 mr-2" />
              {tCommon('clearFilters')}
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-x-auto">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">{tCommon('loading')}</div>
        ) : !employeeFilter ? (
          <div className="p-12 text-center text-muted-foreground">{t('placeholders.selectEmployee')}</div>
        ) : !worklogs || worklogs.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">{t('noData')}</div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.workDate')}</TableHead>
                  <TableHead className="text-center">{t('table.morningShift')}</TableHead>
                  <TableHead className="text-center">{t('table.eveningShift')}</TableHead>
                  <TableHead className="text-center">{t('table.totalHours')}</TableHead>
                  <TableHead>{t('table.status')}</TableHead>
                  <TableHead className="text-right">{t('table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {worklogs.map((worklog) => (
                  <TableRow key={worklog.id}>
                    <TableCell>{format(new Date(worklog.workDate), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-center">
                      {worklog.morningIn && worklog.morningOut ? (
                        <span className="text-sm">
                          {formatTime(worklog.morningIn)} - {formatTime(worklog.morningOut)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {worklog.eveningIn && worklog.eveningOut ? (
                        <span className="text-sm">
                          {formatTime(worklog.eveningIn)} - {formatTime(worklog.eveningOut)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {worklog.totalHours.toFixed(2)} {t('units.hours')}
                    </TableCell>
                    <TableCell>{getStatusBadge(worklog.status)}</TableCell>
                    <TableCell className="text-right">
                      {worklog.status === 'pending' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">{t('table.actions')}</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{t('table.actions')}</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleEdit(worklog)}>
                              <Edit className="mr-2 h-4 w-4" />
                              {t('editTitle')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDelete(worklog)} className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              {tCommon('delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <div className="text-sm text-muted-foreground">
                  {t('pagination.page')} {currentPage} {t('pagination.of')} {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    {t('pagination.previous')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    {t('pagination.next')}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

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
