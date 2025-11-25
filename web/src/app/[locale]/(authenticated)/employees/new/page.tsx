'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { EmployeeForm } from '@/components/employees/employee-form';
import { employeeService, CreateEmployeeRequest, UpdateEmployeeRequest } from '@/services/employee.service';

export default function NewEmployeePage() {
  const t = useTranslations('Employees');
  const router = useRouter();

  const handleSubmit = async (data: CreateEmployeeRequest | UpdateEmployeeRequest) => {
    try {
      await employeeService.createEmployee(data as CreateEmployeeRequest);
      // Ideally show success message here
      router.push('/employees');
    } catch (error) {
      console.error('Failed to create employee', error);
      throw error;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('createTitle')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>
      <EmployeeForm onSubmit={handleSubmit} />
    </div>
  );
}
