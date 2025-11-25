'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { DateInput } from '@/components/ui/date-input';
import { Employee } from '@/services/employee.service';
import { CreateFTWorklogRequest, UpdateFTWorklogRequest, FTWorklog } from '@/services/ft-worklog.service';
import { format } from 'date-fns';

interface FTWorklogFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateFTWorklogRequest | UpdateFTWorklogRequest) => Promise<void>;
  employees: Employee[];
  worklog?: FTWorklog;
  mode: 'create' | 'edit';
  lastSelectedEmployeeId?: string;
}

export function FTWorklogForm({ open, onOpenChange, onSubmit, employees, worklog, mode, lastSelectedEmployeeId }: FTWorklogFormProps) {
  const t = useTranslations('Worklogs.FT');
  const tCommon = useTranslations('Common');

  const [employeeId, setEmployeeId] = useState('');
  const [workDate, setWorkDate] = useState('');
  const [entryType, setEntryType] = useState<'late' | 'leave_day' | 'leave_hours' | 'ot' | 'leave_double'>('late');
  const [quantity, setQuantity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (mode === 'edit' && worklog) {
      setEmployeeId(worklog.employeeId);
      setWorkDate(worklog.workDate);
      setEntryType(worklog.entryType);
      setQuantity(worklog.quantity.toString());
    } else if (mode === 'create') {
      // Use last selected employee or empty
      setEmployeeId(lastSelectedEmployeeId || '');
      setWorkDate(format(new Date(), 'yyyy-MM-dd'));
      setEntryType('late');
      setQuantity('');
    }
    setErrors({});
  }, [mode, worklog, open, lastSelectedEmployeeId]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (mode === 'create' && !employeeId) {
      newErrors.employeeId = t('validation.employeeRequired');
    }
    if (mode === 'create' && !workDate) {
      newErrors.workDate = t('validation.workDateRequired');
    }
    if (!quantity || parseFloat(quantity) <= 0) {
      newErrors.quantity = t('validation.quantityRequired');
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
          entryType,
          quantity: parseFloat(quantity),
        } as CreateFTWorklogRequest);
      } else {
        await onSubmit({
          quantity: parseFloat(quantity),
        } as UpdateFTWorklogRequest);
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Form submit error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getQuantityUnit = () => {
    switch (entryType) {
      case 'late':
        return t('units.minutes');
      case 'leave_day':
      case 'leave_double':
        return t('units.days');
      case 'leave_hours':
      case 'ot':
        return t('units.hours');
      default:
        return '';
    }
  };

  // Filter full-time employees only
  const ftEmployees = employees.filter(emp => 
    !emp.employeeTypeName?.includes('พาร์ท') && !emp.employeeTypeName?.toLowerCase().includes('part')
  );

  // Prepare employee options for combobox
  const employeeOptions = ftEmployees.map(emp => ({
    value: emp.id,
    label: `${emp.employeeNumber || ''} - ${emp.fullNameTh || `${emp.firstName} ${emp.lastName}`}`.trim(),
    searchText: `${emp.employeeNumber || ''} ${emp.fullNameTh || ''} ${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase(),
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
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

            {mode === 'create' && (
              <div className="grid gap-2">
                <Label htmlFor="entryType">{t('fields.entryType')}</Label>
                <Select value={entryType} onValueChange={(value) => setEntryType(value as any)}>
                  <SelectTrigger id="entryType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="late">{t('entryTypes.late')}</SelectItem>
                    <SelectItem value="leave_day">{t('entryTypes.leave_day')}</SelectItem>
                    <SelectItem value="leave_double">{t('entryTypes.leave_double')}</SelectItem>
                    <SelectItem value="leave_hours">{t('entryTypes.leave_hours')}</SelectItem>
                    <SelectItem value="ot">{t('entryTypes.ot')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="quantity">
                {t('fields.quantity')} ({getQuantityUnit()})
              </Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={t('placeholders.quantity')}
                className={errors.quantity ? 'border-red-500' : ''}
              />
              {errors.quantity && <p className="text-sm text-red-500">{errors.quantity}</p>}
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
