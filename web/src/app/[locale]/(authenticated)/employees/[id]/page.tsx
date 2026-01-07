'use client';

import { useState, useEffect, use, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { EmployeeForm } from '@/components/employees/employee-form';
import { employeeService, Employee, UpdateEmployeeRequest, CreateEmployeeRequest, EmployeeType } from '@/services/employee.service';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, BarChart3, FileText, User } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { AccumulationView } from '@/components/employees/accumulation-view';
import { DocumentTab } from '@/components/employees/document-tab';
import { EmployeeTypeBadge } from '@/components/common/employee-type-badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import { useSearchParams } from 'next/navigation';

export default function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('Employees');
  const tAccum = useTranslations('Accumulation');
  const tDocs = useTranslations('Documents');
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [employeeTypes, setEmployeeTypes] = useState<EmployeeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [accumulationSheetOpen, setAccumulationSheetOpen] = useState(false);
  const [documentsSheetOpen, setDocumentsSheetOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [empData, empTypes] = await Promise.all([
          employeeService.getEmployee(id),
          employeeService.getEmployeeTypes()
        ]);
        setEmployee(empData);
        setEmployeeTypes(empTypes);
      } catch (error) {
        console.error('Failed to fetch employee', error);
        router.push('/employees');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, router]);

  // Get employee type code from employeeTypeId
  const employeeTypeCode = useMemo(() => {
    if (!employee?.employeeTypeId || employeeTypes.length === 0) return '';
    const type = employeeTypes.find(t => t.id === employee.employeeTypeId);
    return type?.code || type?.name || '';
  }, [employee?.employeeTypeId, employeeTypes]);

  // Load photo when employee data is available
  useEffect(() => {
    if (employee?.photoId) {
      employeeService.fetchPhotoWithCache(employee.photoId).then(setPhotoPreview);
    }
  }, [employee?.photoId]);

  // Open accumulation sheet if tab param is 'accumulation'
  useEffect(() => {
    if (tab === 'accumulation') {
      setAccumulationSheetOpen(true);
    }
  }, [tab]);

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
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAccumulationSheetOpen(true)}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            {tAccum('title')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDocumentsSheetOpen(true)}
          >
            <FileText className="h-4 w-4 mr-2" />
            {tDocs('tabTitle')}
          </Button>
        </div>
      </div>
      <EmployeeForm 
        initialData={employee} 
        onSubmit={handleSubmit} 
        isEditing 
        defaultTab={tab === 'accumulation' ? 'personal' : (tab || 'personal')} 
      />

      {/* Accumulation Sheet */}
      <Sheet open={accumulationSheetOpen} onOpenChange={setAccumulationSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{tAccum('title')}</SheetTitle>
            <SheetDescription asChild>
              <div className="flex items-center gap-3">
                <EmployeeTypeBadge typeCode={employeeTypeCode} />
                <Avatar className="h-8 w-8">
                  {photoPreview ? (
                    <AvatarImage src={photoPreview} alt={employee.firstName} />
                  ) : null}
                  <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                </Avatar>
                <span>{employee.employeeNumber} - {employee.titleName}{employee.firstName} {employee.lastName}</span>
              </div>
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 px-4">
            <AccumulationView employeeId={employee.id} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Documents Sheet */}
      <Sheet open={documentsSheetOpen} onOpenChange={setDocumentsSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{tDocs('tabTitle')}</SheetTitle>
            <SheetDescription asChild>
              <div className="flex items-center gap-3">
                <EmployeeTypeBadge typeCode={employeeTypeCode} />
                <Avatar className="h-8 w-8">
                  {photoPreview ? (
                    <AvatarImage src={photoPreview} alt={employee.firstName} />
                  ) : null}
                  <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                </Avatar>
                <span>{employee.employeeNumber} - {employee.titleName}{employee.firstName} {employee.lastName}</span>
              </div>
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 px-4">
            <DocumentTab employeeId={employee.id} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
