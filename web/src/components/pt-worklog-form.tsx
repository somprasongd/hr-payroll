'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { EmployeeSelector } from '@/components/common/employee-selector';
import { DateInput } from '@/components/ui/date-input';
import { TimeInput } from '@/components/ui/time-input';
import { DismissibleAlert } from '@/components/ui/dismissible-alert';
import { Employee } from '@/services/employee.service';
import { CreatePTWorklogRequest, UpdatePTWorklogRequest, PTWorklog } from '@/services/pt-worklog.service';
import { format } from 'date-fns';
import { useWorklogForm } from '@/hooks/use-worklog-form';

interface PTWorklogFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreatePTWorklogRequest | UpdatePTWorklogRequest) => Promise<void>;
  employees: Employee[];
  worklog?: PTWorklog;
  mode: 'create' | 'edit';
  lastSelectedEmployeeId?: string;
  onEmployeeSelect?: (employeeId: string) => void;
}

export function PTWorklogForm({ open, onOpenChange, onSubmit, employees, worklog, mode, lastSelectedEmployeeId, onEmployeeSelect }: PTWorklogFormProps) {
  const t = useTranslations('Worklogs.PT');
  const tCommon = useTranslations('Common');

  const {
    employeeId, setEmployeeId,
    workDate, setWorkDate,
    isSubmitting,
    errors, setErrors,
    submitError, setSubmitError,
    handleSubmitWrapper,
    resetFormState,
  } = useWorklogForm({ mode, lastSelectedEmployeeId });

  const [morningIn, setMorningIn] = useState('');
  const [morningOut, setMorningOut] = useState('');
  const [eveningIn, setEveningIn] = useState('');
  const [eveningOut, setEveningOut] = useState('');

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
    resetFormState();
  }, [mode, worklog, open, lastSelectedEmployeeId]);

  const calculateTotalHours = () => {
    let totalMinutes = 0;

    if (morningIn && morningOut) {
      const [inH, inM] = morningIn.split(':').map(Number);
      const [outH, outM] = morningOut.split(':').map(Number);
      const inMinutes = inH * 60 + inM;
      const outMinutes = outH * 60 + outM;
      if (outMinutes < inMinutes) {
        totalMinutes += (outMinutes + 1440) - inMinutes;
      } else {
        totalMinutes += outMinutes - inMinutes;
      }
    }

    if (eveningIn && eveningOut) {
      const [inH, inM] = eveningIn.split(':').map(Number);
      const [outH, outM] = eveningOut.split(':').map(Number);
      const inMinutes = inH * 60 + inM;
      const outMinutes = outH * 60 + outM;
      if (outMinutes < inMinutes) {
        totalMinutes += (outMinutes + 1440) - inMinutes;
      } else {
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

  const submitLogic = async () => {
      if (mode === 'create') {
        await onSubmit({
          employeeId,
          workDate,
          morningIn,
          morningOut,
          eveningIn,
          eveningOut,
        } as CreatePTWorklogRequest);
        
        // After success: clear form and set next date (if not future)
        const today = new Date();
        const currentWorkDate = new Date(workDate);
        const nextDate = new Date(currentWorkDate);
        nextDate.setDate(nextDate.getDate() + 1);
        
        // If next date is not in the future, use it; otherwise use today
        const dateToSet = nextDate <= today ? nextDate : today;
        
        setWorkDate(format(dateToSet, 'yyyy-MM-dd'));
        setMorningIn('');
        setMorningOut('');
        setEveningIn('');
        setEveningOut('');
        setErrors({});
        // Don't close dialog
      } else {
        await onSubmit({
          morningIn,
          morningOut,
          eveningIn,
          eveningOut,
        } as UpdatePTWorklogRequest);
        onOpenChange(false);
      }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await handleSubmitWrapper(submitLogic, t);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && employeeId && onEmployeeSelect) {
      onEmployeeSelect(employeeId);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{mode === 'create' ? t('createTitle') : t('editTitle')}</DialogTitle>
            <DialogDescription>{t('formDescription')}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {submitError && (
              <DismissibleAlert
                variant="error"
                onDismiss={() => setSubmitError(null)}
                autoDismiss={false}
                showCloseButton={true}
              >
                {submitError}
              </DismissibleAlert>
            )}
            {mode === 'create' && (
              <div className="grid gap-2">
                <Label htmlFor="employee">{t('fields.employee')}</Label>
                <EmployeeSelector
                  employees={employees}
                  selectedEmployeeId={employeeId}
                  onSelect={setEmployeeId}
                  placeholder={t('placeholders.selectEmployee')}
                  searchPlaceholder="ค้นหารหัสหรือชื่อพนักงาน..."
                  emptyText="ไม่พบพนักงาน"
                  filterType="pt"
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
                  max={format(new Date(), 'yyyy-MM-dd')}
                  className={errors.workDate ? 'border-red-500' : ''}
                />
                {errors.workDate && <p className="text-sm text-red-500">{errors.workDate}</p>}
              </div>
            )}

            {mode === 'edit' && worklog && (
              <div className="grid gap-2">
                <Label>{t('fields.workDate')}</Label>
                <div className="text-lg font-medium text-gray-900">
                  {format(new Date(worklog.workDate), 'dd/MM/yyyy')}
                </div>
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
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
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
