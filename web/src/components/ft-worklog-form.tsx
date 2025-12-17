'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DismissibleAlert } from '@/components/ui/dismissible-alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { EmployeeSelector } from '@/components/common/employee-selector';
import { DateInput } from '@/components/ui/date-input';
import { Employee } from '@/services/employee.service';
import { CreateFTWorklogRequest, UpdateFTWorklogRequest, FTWorklog } from '@/services/ft-worklog.service';
import { format, addDays, parseISO, isAfter, startOfDay } from 'date-fns';

interface FTWorklogFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateFTWorklogRequest | UpdateFTWorklogRequest) => Promise<void>;
  employees: Employee[];
  worklog?: FTWorklog;
  mode: 'create' | 'edit';
  lastSelectedEmployeeId?: string;
  onEmployeeSelect?: (employeeId: string) => void;
}

// Types that cannot select future dates
const RESTRICT_FUTURE_TYPES: Array<'late' | 'leave_day' | 'leave_hours' | 'ot' | 'leave_double'> = ['late', 'ot'];

// Types that have fixed quantity = 1 day
const FIXED_QUANTITY_TYPES: Array<'late' | 'leave_day' | 'leave_hours' | 'ot' | 'leave_double'> = ['leave_day', 'leave_double'];

export function FTWorklogForm({ open, onOpenChange, onSubmit, employees, worklog, mode, lastSelectedEmployeeId, onEmployeeSelect }: FTWorklogFormProps) {
  const t = useTranslations('Worklogs.FT');
  const tCommon = useTranslations('Common');

  const [employeeId, setEmployeeId] = useState('');
  const [workDate, setWorkDate] = useState('');
  const [entryType, setEntryType] = useState<'late' | 'leave_day' | 'leave_hours' | 'ot' | 'leave_double'>('late');
  const [quantity, setQuantity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Check if selected date is in the future
  const isFutureDate = (dateStr: string) => {
    if (!dateStr) return false;
    const today = startOfDay(new Date());
    const selectedDate = startOfDay(parseISO(dateStr));
    return isAfter(selectedDate, today);
  };

  // Check if current type restricts future dates
  const isRestrictedType = (type: typeof entryType) => RESTRICT_FUTURE_TYPES.includes(type);

  // Check if current type has fixed quantity
  const isFixedQuantityType = (type: typeof entryType) => FIXED_QUANTITY_TYPES.includes(type);

  // Handle entry type change - auto adjust date if needed
  const handleEntryTypeChange = (newType: typeof entryType) => {
    setEntryType(newType);
    
    // If switching to restricted type and current date is future, reset to today
    if (isRestrictedType(newType) && isFutureDate(workDate)) {
      setWorkDate(format(new Date(), 'yyyy-MM-dd'));
    }

    // If switching to fixed quantity type, set quantity to 1
    if (isFixedQuantityType(newType)) {
      setQuantity('1');
    } else if (isFixedQuantityType(entryType)) {
      // If switching away from fixed quantity type, clear quantity
      setQuantity('');
    }
  };

  // Handle date change with validation
  const handleDateChange = (newDate: string) => {
    // If type is restricted and date is future, don't allow
    if (isRestrictedType(entryType) && isFutureDate(newDate)) {
      return; // Don't update the date
    }
    setWorkDate(newDate);
  };

  // Calculate max date for date input
  const getMaxDate = () => {
    if (isRestrictedType(entryType)) {
      return format(new Date(), 'yyyy-MM-dd');
    }
    return undefined; // No restriction
  };

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
    setSubmitError(null);
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
    setSubmitError(null);
    try {
      if (mode === 'create') {
        await onSubmit({
          employeeId,
          workDate,
          entryType,
          quantity: parseFloat(quantity),
        } as CreateFTWorklogRequest);
        
        // After successful save: clear form and select next date
        const today = startOfDay(new Date());
        const currentDate = parseISO(workDate);
        const nextDate = addDays(currentDate, 1);
        
        // Check if next date is valid for current type
        let newWorkDate: string;
        if (isRestrictedType(entryType) && isAfter(startOfDay(nextDate), today)) {
          // Can't go to future for restricted types, stay on today
          newWorkDate = format(today, 'yyyy-MM-dd');
        } else {
          newWorkDate = format(nextDate, 'yyyy-MM-dd');
        }
        
        // Clear form but keep employee and type, move to next date
        setWorkDate(newWorkDate);
        setQuantity('');
        setErrors({});
        // Don't close dialog - let user continue adding entries
      } else {
        await onSubmit({
          quantity: parseFloat(quantity),
        } as UpdateFTWorklogRequest);
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error('Form submit error:', error);
      // Extract error message from API response
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail || '';
      const errorMessage = error?.message || '';
      
      // Check for duplicate worklog conflict (409 Conflict)
      if (status === 409 || errorMessage.includes('409') || detail.toLowerCase().includes('already exists')) {
        setSubmitError(t('errors.duplicateWorklog'));
      } else {
        setSubmitError(t('errors.saveFailed'));
      }
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

  // Handle dialog close - notify parent of selected employee
  const handleDialogClose = (isOpen: boolean) => {
    if (!isOpen && employeeId && onEmployeeSelect) {
      onEmployeeSelect(employeeId);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{mode === 'create' ? t('createTitle') : t('editTitle')}</DialogTitle>
            <DialogDescription>{t('formDescription')}</DialogDescription>
          </DialogHeader>

          {submitError && (
            <DismissibleAlert
              variant="error"
              className="mt-4"
              onDismiss={() => setSubmitError(null)}
              autoDismiss={false}
              showCloseButton={true}
            >
              {submitError}
            </DismissibleAlert>
          )}

          <div className="grid gap-4 py-4">
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
                  filterType="ft"
                />
                {errors.employeeId && <p className="text-sm text-red-500">{errors.employeeId}</p>}
              </div>
            )}

            {/* Entry Type - moved before date */}
            {mode === 'create' && (
              <div className="grid gap-2">
                <Label htmlFor="entryType">{t('fields.entryType')}</Label>
                <Select value={entryType} onValueChange={(value) => handleEntryTypeChange(value as any)}>
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

            {/* Work Date - now after entry type */}
            {mode === 'create' && (
              <div className="grid gap-2">
                <Label htmlFor="workDate">{t('fields.workDate')}</Label>
                <DateInput
                  id="workDate"
                  value={workDate}
                  onValueChange={handleDateChange}
                  max={getMaxDate()}
                  className={errors.workDate ? 'border-red-500' : ''}
                />
                {errors.workDate && <p className="text-sm text-red-500">{errors.workDate}</p>}
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
                disabled={isFixedQuantityType(entryType)}
                readOnly={isFixedQuantityType(entryType)}
              />
              {errors.quantity && <p className="text-sm text-red-500">{errors.quantity}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleDialogClose(false)} disabled={isSubmitting}>
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
