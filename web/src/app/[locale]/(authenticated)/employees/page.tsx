'use client';

import { ConfirmationDialog } from '@/components/common/confirmation-dialog';
import { EmployeePhoto } from '@/components/common/employee-photo';
import { EmployeeTypeBadge } from '@/components/common/employee-type-badge';
import { FilterBar } from '@/components/common/filter-bar';
import { GenericDataTable } from '@/components/common/generic-data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useBranchChange } from '@/hooks/use-branch-change';
import { Link, useRouter } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { Employee, employeeService, EmployeeType } from '@/services/employee.service';
import { Edit, Filter, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

export default function EmployeesPage() {
  const t = useTranslations('Employees');
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlEmployeeType = searchParams.get('employeeType'); // FT, PT from URL
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeTypes, setEmployeeTypes] = useState<EmployeeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [employeeTypeFilter, setEmployeeTypeFilter] = useState('all');
  const [employeeTypeCodeFilter, setEmployeeTypeCodeFilter] = useState<string | null>(urlEmployeeType);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Refetch when branch changes
  useBranchChange(useCallback(() => {
    fetchEmployeeTypes();
    fetchEmployees();
  }, []));

  useEffect(() => {
    fetchEmployeeTypes();
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [statusFilter, employeeTypeFilter, employeeTypeCodeFilter, currentPage]);

  const fetchEmployeeTypes = async () => {
    try {
      const response = await employeeService.getEmployeeTypes();
      setEmployeeTypes(response || []);
      
      // If we have a URL employeeType code, find the matching type ID and set it as filter
      if (urlEmployeeType && response) {
        const matchingType = response.find(t => t.code === urlEmployeeType);
        if (matchingType) {
          setEmployeeTypeFilter(matchingType.id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch employee types', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await employeeService.getEmployees({
        search,
        status: statusFilter === 'all' ? undefined : statusFilter,
        employeeTypeId: employeeTypeFilter === 'all' ? undefined : employeeTypeFilter,
        employeeTypeCode: employeeTypeCodeFilter || undefined,
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

  const handleSearch = () => {
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

  const columns = [
    {
      id: 'employeeNumber',
      header: () => t('fields.employeeNumber'),
      accessorFn: (row: Employee) => row.employeeNumber,
      cell: (info: any) => info.getValue(),
    },
    {
      id: 'fullName',
      header: () => `${t('fields.firstName')} ${t('fields.lastName')}`,
      accessorFn: (row: Employee) => row,
      cell: (info: any) => {
        const employee = info.getValue() as Employee;
        return (
          <div className="flex items-center gap-3">
            <EmployeePhoto 
              photoId={employee.photoId} 
              firstName={employee.firstName}
              lastName={employee.lastName}
              size="sm" 
            />
            <span>{employee.fullNameTh || '-'}</span>
          </div>
        );
      },
    },
    {
      id: 'employeeType',
      header: () => t('fields.employeeType'),
      accessorFn: (row: Employee) => row,
      cell: (info: any) => {
        const employee = info.getValue() as Employee;
        return <EmployeeTypeBadge typeName={employee.employeeTypeName} />;
      },
    },
    {
      id: 'phone',
      header: () => t('fields.phone'),
      accessorFn: (row: Employee) => row.phone || '-',
      cell: (info: any) => info.getValue(),
    },
    {
      id: 'status',
      header: () => t('fields.status'),
      accessorFn: (row: Employee) => row.status,
      cell: (info: any) => {
        const status = info.getValue();
        return (
          <Badge variant={status === 'active' ? 'default' : 'secondary'}>
            {status === 'active' ? t('status.active') : t('status.terminated')}
          </Badge>
        );
      },
    },
  ];

  const actions = [
    {
      label: t('actions.edit'),
      icon: <Edit className="h-4 w-4" />,
      onClick: (employee: Employee) => {
        // Navigate to edit page - we'll use the Link component
        router.push(`/employees/${employee.id}`);
      }
    },
    {
      label: t('actions.delete'),
      icon: <Trash2 className="h-4 w-4" />,
      variant: 'destructive' as const,
      onClick: (employee: Employee) => handleDelete(employee),
      condition: (employee: Employee) => true // Always show for all employees
    }
  ];

  const filters = [
    {
      id: 'employeeType',
      label: t('fields.employeeType'),
      type: 'select' as const,
      options: [
        { value: 'all', label: t('employeeTypes.allTypes') },
        ...employeeTypes.map(type => ({
          value: type.id,
          label: t(`employeeTypes.${type.code}`) || type.name
        }))
      ]
    },
    {
      id: 'status',
      label: t('fields.status'),
      type: 'select' as const,
      options: [
        { value: 'all', label: t('status.allStatuses') },
        { value: 'active', label: t('status.active') },
        { value: 'terminated', label: t('status.terminated') }
      ]
    }
  ];

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

      <FilterBar
        filters={filters}
        values={{
          employeeType: employeeTypeFilter,
          status: statusFilter
        }}
        onFilterChange={(filterId, value) => {
          if (filterId === 'employeeType') setEmployeeTypeFilter(value);
          if (filterId === 'status') setStatusFilter(value);
        }}
        onClearAll={() => {
          setSearch('');
          setEmployeeTypeFilter('all');
          setEmployeeTypeCodeFilter(null);
          setStatusFilter('all');
          setCurrentPage(1);
          fetchEmployees();
        }}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        onSearch={handleSearch}
        searchPlaceholder={t('searchPlaceholder')}
        searchValue={search}
        onSearchChange={setSearch}
      />

      <GenericDataTable
        data={employees}
        columns={columns}
        loading={loading}
        emptyStateText={t('messages.noEmployeesFound')}
        actions={actions}
        pagination={{
          currentPage,
          totalPages,
          onPageChange: handlePageChange
        }}
      />

      <ConfirmationDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title={t('messages.deleteTitle')}
        description={t('messages.confirmDelete')}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
