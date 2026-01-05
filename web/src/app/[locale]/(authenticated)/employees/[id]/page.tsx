'use client';

import { useState, useEffect, use } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { EmployeeForm } from '@/components/employees/employee-form';
import { employeeService, Employee, UpdateEmployeeRequest, CreateEmployeeRequest } from '@/services/employee.service';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';

import { useSearchParams } from 'next/navigation';

export default function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('Employees');
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const data = await employeeService.getEmployee(id);
        setEmployee(data);
      } catch (error) {
        console.error('Failed to fetch employee', error);
        router.push('/employees');
      } finally {
        setLoading(false);
      }
    };
    fetchEmployee();
  }, [id, router]);

  const handleSubmit = async (data: UpdateEmployeeRequest | CreateEmployeeRequest) => {
    try {
      await employeeService.updateEmployee(id, data as UpdateEmployeeRequest);
      // Stay on current page after save - do not redirect
    } catch (error) {
      console.error('Failed to update employee', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!employee) return null;

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
            <h1 className="text-3xl font-bold tracking-tight">{t('editTitle')}</h1>
            <p className="text-muted-foreground">{t('description')}</p>
          </div>
        </div>
      </div>
      <EmployeeForm 
        initialData={employee} 
        onSubmit={handleSubmit} 
        isEditing 
        defaultTab={tab || 'personal'} 
      />
    </div>
  );
}
