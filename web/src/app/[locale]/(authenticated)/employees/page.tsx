'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { employeeService, Employee, EmployeeType } from '@/services/employee.service';
import { Plus, Search, Edit, Trash2, MoreHorizontal, Filter, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

import { Pagination } from '@/components/ui/pagination';

export default function EmployeesPage() {
  const t = useTranslations('Employees');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeTypes, setEmployeeTypes] = useState<EmployeeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [employeeTypeFilter, setEmployeeTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchEmployeeTypes();
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [statusFilter, employeeTypeFilter, currentPage]);

  const fetchEmployeeTypes = async () => {
    try {
      const response = await employeeService.getEmployeeTypes();
      console.log('🔍 Employee Types from API:', response);
      setEmployeeTypes(response || []);
    } catch (error) {
      console.error('Failed to fetch employee types', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await employeeService.getEmployees({ 
        search,
        status: statusFilter,
        employeeTypeId: employeeTypeFilter,
        page: currentPage,
        limit: 20
      });
      setEmployees(response.data || []);
      setTotalPages(response.meta?.totalPages || 1);
    } catch (error) {
      console.error('Failed to fetch employees', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page on search
    fetchEmployees();
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleDelete = (employee: Employee) => {
    setEmployeeToDelete(employee);
    setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!employeeToDelete) return;
    
    try {
      await employeeService.deleteEmployee(employeeToDelete.id);
      setIsDeleteOpen(false);
      setEmployeeToDelete(null);
      fetchEmployees();
    } catch (error) {
      console.error('Failed to delete employee', error);
    }
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
          <Button asChild>
            <Link href="/employees/new">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('createButton')}</span>
            </Link>
          </Button>
        </div>
      </div>

      <div className={`bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-4 ${!showFilters ? 'hidden md:block' : ''}`}>
        <div className="grid grid-cols-6 gap-4">
          <div className="col-span-5 lg:col-span-3">
            <form onSubmit={handleSearch} className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button type="submit" variant="secondary">{t('search')}</Button>
            </form>
          </div>

          <div className="col-span-1 lg:order-last flex items-center justify-end">
            <button
              onClick={() => {
                setSearch('');
                setEmployeeTypeFilter('all');
                setStatusFilter('all');
                fetchEmployees();
              }}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              title={t('clearFilters')}
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          <div className="col-span-6 md:col-span-3 lg:col-span-1">
            <Select value={employeeTypeFilter} onValueChange={setEmployeeTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t('fields.employeeType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('employeeTypes.allTypes')}</SelectItem>
                {employeeTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {t(`employeeTypes.${type.code}`) || type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-6 md:col-span-3 lg:col-span-1">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t('fields.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('status.allStatuses')}</SelectItem>
                <SelectItem value="active">{t('status.active')}</SelectItem>
                <SelectItem value="terminated">{t('status.terminated')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="border rounded-md bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('fields.employeeNumber')}</TableHead>
              <TableHead>{t('fields.firstName')} {t('fields.lastName')}</TableHead>
              <TableHead>{t('fields.employeeType')}</TableHead>
              <TableHead>{t('fields.phone')}</TableHead>
              <TableHead>{t('fields.status')}</TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10">
                  {t('loading')}
                </TableCell>
              </TableRow>
            ) : employees?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10">
                  {t('messages.noEmployeesFound')}
                </TableCell>
              </TableRow>
            ) : (
              employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">{employee.employeeNumber}</TableCell>
                  <TableCell>
                    {employee.fullNameTh}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      // Match by name since API sends employeeTypeName, not employeeTypeId
                      const empType = employeeTypes.find(type => type.name === employee.employeeTypeName);
                      console.log('🔍 Debug employee type:', {
                        employeeId: employee.employeeNumber,
                        employeeTypeName: employee.employeeTypeName,
                        foundType: empType,
                        code: empType?.code
                      });
                      
                      if (empType?.code) {
                        const translationKey = `employeeTypes.${empType.code}`;
                        const translated = t(translationKey);
                        console.log('🔍 Translation:', { key: translationKey, translated });
                        return translated;
                      }
                      return employee.employeeTypeName || '-';
                    })()}
                  </TableCell>
                  <TableCell>{employee.phone || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={employee.status === 'active' ? 'default' : 'secondary'}>
                      {employee.status === 'active' ? t('status.active') : t('status.terminated')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">{t('actions.openMenu')}</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>{t('actions.title')}</DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                          <Link href={`/employees/${employee.id}`} className="cursor-pointer">
                            <Edit className="mr-2 h-4 w-4" />
                            {t('actions.edit')}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive cursor-pointer"
                          onClick={() => handleDelete(employee)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t('actions.delete')}
                        </DropdownMenuItem>
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

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('messages.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('messages.confirmDelete')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {t('actions.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
