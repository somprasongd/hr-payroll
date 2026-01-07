'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { EmployeeForm } from '@/components/employees/employee-form';
import { employeeService, CreateEmployeeRequest, UpdateEmployeeRequest } from '@/services/employee.service';
import { Button } from '@/components/ui/button';

import { ArrowLeft } from 'lucide-react';

export default function NewEmployeePage() {
  const t = useTranslations('Employees');
  const router = useRouter();

  const handleSubmit = async (data: CreateEmployeeRequest | UpdateEmployeeRequest) => {
    try {
      const response = await employeeService.createEmployee(data as CreateEmployeeRequest);
      // Ideally show success message here
      router.push(`/employees/${response.id}?tab=accumulation`);
    } catch (error) {
      console.error('Failed to create employee', error);
      throw error;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/employees')}
            className="p-2 hover:bg-muted rounded-md transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('createTitle')}</h1>
            <p className="text-muted-foreground">{t('description')}</p>
          </div>
        </div>
      </div>
      <EmployeeForm onSubmit={handleSubmit} />
    </div>
  );
}
