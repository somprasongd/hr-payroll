'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import { DateInput } from '@/components/ui/date-input';
import { TimeInput } from '@/components/ui/time-input';
import { Employee } from '@/services/employee.service';
import { CreatePTWorklogRequest, UpdatePTWorklogRequest, PTWorklog } from '@/services/pt-worklog.service';
import { format } from 'date-fns';

interface PTWorklogFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreatePTWorklogRequest | UpdatePTWorklogRequest) => Promise<void>;
  employees: Employee[];
  worklog?: PTWorklog;
  mode: 'create' | 'edit';
  lastSelectedEmployeeId?: string;
}

export function PTWorklogForm({ open, onOpenChange, onSubmit, employees, worklog, mode, lastSelectedEmployeeId }: PTWorklogFormProps) {
  const t = useTranslations('Worklogs.PT');
  const tCommon = useTranslations('Common');

  const [employeeId, setEmployeeId] = useState('');
  const [workDate, setWorkDate] = useState('');
  const [morningIn, setMorningIn] = useState('');
  const [morningOut, setMorningOut] = useState('');
  const [eveningIn, setEveningIn] = useState('');
  const [eveningOut, setEveningOut] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (mode === 'edit' && worklog) {
      setEmployeeId(worklog.employeeId);
      setWorkDate(worklog.workDate);
      setMorningIn(worklog.morningIn?.substring(0, 5) || '');
      setMorningOut(worklog.morningOut?.substring(0, 5) || '');
      setEveningIn(worklog.eveningIn?.substring(0, 5) || '');
      setEveningOut(worklog.eveningOut?.substring(0, 5) || '');
    } else if (mode === 'create') {
      // Use last selected employee or empty
      setEmployeeId(lastSelectedEmployeeId || '');
      setWorkDate(format(new Date(), 'yyyy-MM-dd'));
      setMorningIn('');
      setMorningOut('');
      setEveningIn('');
      setEveningOut('');
    }
    setErrors({});
  }, [mode, worklog, open, lastSelectedEmployeeId]);

  const calculateTotalHours = () => {
    let totalMinutes = 0;

    if (morningIn && morningOut) {
      const [inH, inM] = morningIn.split(':').map(Number);
      const [outH, outM] = morningOut.split(':').map(Number);
      const inMinutes = inH * 60 + inM;
      const outMinutes = outH * 60 + outM;
      if (outMinutes > inMinutes) {
        totalMinutes += outMinutes - inMinutes;
      }
    }

    if (eveningIn && eveningOut) {
      const [inH, inM] = eveningIn.split(':').map(Number);
      const [outH, outM] = eveningOut.split(':').map(Number);
      const inMinutes = inH * 60 + inM;
      const outMinutes = outH * 60 + outM;
      if (outMinutes > inMinutes) {
        totalMinutes += outMinutes - inMinutes;
      }
    }

    return (totalMinutes / 60).toFixed(2);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (mode === 'create' && !employeeId) {
      newErrors.employeeId = t('validation.employeeRequired');
    }
    if (mode === 'create' && !workDate) {
      newErrors.workDate = t('validation.workDateRequired');
    }

    // At least one shift must be filled
    const hasMorning = morningIn && morningOut;
    const hasEvening = eveningIn && eveningOut;
    if (!hasMorning && !hasEvening) {
      newErrors.shifts = t('validation.atLeastOneShift');
    }

    // Validate morning shift if partially filled
    if ((morningIn && !morningOut) || (!morningIn && morningOut)) {
      newErrors.morning = t('validation.completeMorningShift');
    }

    // Validate evening shift if partially filled
    if ((eveningIn && !eveningOut) || (!eveningIn && eveningOut)) {
      newErrors.evening = t('validation.completeEveningShift');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'create') {
        await onSubmit({
          employeeId,
          workDate,
          morningIn: morningIn || undefined,
          morningOut: morningOut || undefined,
          eveningIn: eveningIn || undefined,
          eveningOut: eveningOut || undefined,
        } as CreatePTWorklogRequest);
      } else {
        await onSubmit({
          morningIn: morningIn || undefined,
          morningOut: morningOut || undefined,
          eveningIn: eveningIn || undefined,
          eveningOut: eveningOut || undefined,
        } as UpdatePTWorklogRequest);
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Form submit error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter part-time employees only
  const ptEmployees = employees.filter(emp => 
    emp.employeeTypeName?.includes('พาร์ท') || emp.employeeTypeName?.toLowerCase().includes('part')
  );

  // Prepare employee options for combobox
  const employeeOptions = ptEmployees.map(emp => ({
    value: emp.id,
    label: `${emp.employeeNumber || ''} - ${emp.fullNameTh || `${emp.firstName} ${emp.lastName}`}`.trim(),
    searchText: `${emp.employeeNumber || ''} ${emp.fullNameTh || ''} ${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase(),
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{mode === 'create' ? t('createTitle') : t('editTitle')}</DialogTitle>
            <DialogDescription>{t('formDescription')}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {mode === 'create' && (
              <div className="grid gap-2">
                <Label htmlFor="employee">{t('fields.employee')}</Label>
                <Combobox
                  options={employeeOptions}
                  value={employeeId}
                  onValueChange={setEmployeeId}
                  placeholder={t('placeholders.selectEmployee')}
                  searchPlaceholder="ค้นหารหัสหรือชื่อพนักงาน..."
                  emptyText="ไม่พบพนักงาน"
                  className={errors.employeeId ? 'border-red-500' : ''}
                />
                {errors.employeeId && <p className="text-sm text-red-500">{errors.employeeId}</p>}
              </div>
            )}

            {mode === 'create' && (
              <div className="grid gap-2">
                <Label htmlFor="workDate">{t('fields.workDate')}</Label>
                <DateInput
                  id="workDate"
                  value={workDate}
                  onValueChange={setWorkDate}
                  className={errors.workDate ? 'border-red-500' : ''}
                />
                {errors.workDate && <p className="text-sm text-red-500">{errors.workDate}</p>}
              </div>
            )}

            {errors.shifts && <p className="text-sm text-red-500">{errors.shifts}</p>}

            <div className="grid gap-2">
              <Label>{t('fields.morningShift')}</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="morningIn" className="text-xs text-gray-500">{t('fields.timeIn')}</Label>
                  <TimeInput
                    id="morningIn"
                    value={morningIn}
                    onValueChange={setMorningIn}
                    className={errors.morning ? 'border-red-500' : ''}
                  />
                </div>
                <div>
                  <Label htmlFor="morningOut" className="text-xs text-gray-500">{t('fields.timeOut')}</Label>
                  <TimeInput
                    id="morningOut"
                    value={morningOut}
                    onValueChange={setMorningOut}
                    className={errors.morning ? 'border-red-500' : ''}
                  />
                </div>
              </div>
              {errors.morning && <p className="text-sm text-red-500">{errors.morning}</p>}
            </div>

            <div className="grid gap-2">
              <Label>{t('fields.eveningShift')}</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="eveningIn" className="text-xs text-gray-500">{t('fields.timeIn')}</Label>
                  <TimeInput
                    id="eveningIn"
                    value={eveningIn}
                    onValueChange={setEveningIn}
                    className={errors.evening ? 'border-red-500' : ''}
                  />
                </div>
                <div>
                  <Label htmlFor="eveningOut" className="text-xs text-gray-500">{t('fields.timeOut')}</Label>
                  <TimeInput
                    id="eveningOut"
                    value={eveningOut}
                    onValueChange={setEveningOut}
                    className={errors.evening ? 'border-red-500' : ''}
                  />
                </div>
              </div>
              {errors.evening && <p className="text-sm text-red-500">{errors.evening}</p>}
            </div>

            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">{t('totalHours')}</span>
                <span className="text-lg font-bold text-blue-600">{calculateTotalHours()} {t('units.hours')}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? tCommon('saving') : tCommon('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
