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
import { Plus, Search, Edit, Trash2, MoreHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function EmployeesPage() {
  const t = useTranslations('Employees');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeTypes, setEmployeeTypes] = useState<EmployeeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [employeeTypeFilter, setEmployeeTypeFilter] = useState('all');
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);

  useEffect(() => {
    fetchEmployeeTypes();
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [statusFilter, employeeTypeFilter]);

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
        employeeTypeId: employeeTypeFilter
      });
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Failed to fetch employees', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEmployees();
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <Button asChild>
          <Link href="/employees/new">
            <Plus className="mr-2 h-4 w-4" />
            {t('createButton')}
          </Link>
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 flex items-center space-x-2">
          <form onSubmit={handleSearch} className="flex-1 flex items-center space-x-2">
            <div className="relative flex-1 max-w-sm">
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
        
        <div className="flex items-center gap-2">
          <Select value={employeeTypeFilter} onValueChange={setEmployeeTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t('fields.employeeType')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('status.all')}</SelectItem>
              {employeeTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {t(`employeeTypes.${type.code}`) || type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t('fields.status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('status.all')}</SelectItem>
              <SelectItem value="active">{t('status.active')}</SelectItem>
              <SelectItem value="terminated">{t('status.terminated')}</SelectItem>
            </SelectContent>
          </Select>
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
