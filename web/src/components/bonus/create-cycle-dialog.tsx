'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DismissibleAlert } from '@/components/ui/dismissible-alert';
import { bonusService } from '@/services/bonus-service';
import { useToast } from '@/hooks/use-toast';
import { MonthPicker } from "@/components/ui/month-picker";

const createCycleSchema = z.object({
  payrollMonthDate: z.string().min(1, 'Required'),
  bonusYear: z.number().min(1900).max(2100),
  periodStartDate: z.string().min(1, 'Required'),
  periodEndDate: z.string().min(1, 'Required'),
});

type CreateCycleFormValues = z.infer<typeof createCycleSchema>;

interface CreateCycleDialogProps {
  onSuccess: (cycleId: string) => void;
  trigger?: React.ReactNode;
}

// Helper function to convert Gregorian year to Thai Buddhist Era year
function toBuddhistYear(gregorianYear: number): number {
  return gregorianYear + 543;
}

// Generate year options (5 years before and 5 years after current year)
function generateYearOptions(locale: string): { value: number; label: string }[] {
  const currentYear = new Date().getFullYear();
  const years: { value: number; label: string }[] = [];
  
  for (let year = currentYear - 2; year <= currentYear + 5; year++) {
    years.push({
      value: year, // Always Gregorian for API
      label: locale === 'th' ? toBuddhistYear(year).toString() : year.toString(),
    });
  }
  
  return years;
}

export function CreateCycleDialog({ onSuccess, trigger }: CreateCycleDialogProps) {
  const t = useTranslations('Bonus.create');
  const tCommon = useTranslations('Common');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const currentDate = new Date();
  const currentMonth = (currentDate.getMonth() + 1).toString();
  const currentYear = currentDate.getFullYear();

  const yearOptions = generateYearOptions(locale);

  const form = useForm<CreateCycleFormValues>({
    resolver: zodResolver(createCycleSchema),
    defaultValues: {
      payrollMonthDate: `${currentYear}-${currentMonth.padStart(2, '0')}-01`,
      bonusYear: currentYear,
      periodStartDate: `${currentYear}-01-01`,
      periodEndDate: `${currentYear}-12-31`,
    },
  });

  const [isLoadingDefaults, setIsLoadingDefaults] = useState(false);

  useEffect(() => {
    if (open) {
      const fetchDefaults = async () => {
        setIsLoadingDefaults(true);
        try {
          // Fetch latest approved cycle to determine defaults
          const response = await bonusService.getCycles({ limit: 1, status: 'approved' });
          const cycles = response.data;
          const latestApproved = cycles && cycles.length > 0 ? cycles[0] : null;

          let defaultPayrollMonthDate = `${currentYear}-${currentMonth.padStart(2, '0')}-01`;
          let defaultBonusYear = currentYear;
          let defaultStartDate = `${currentYear}-01-01`;
          let defaultEndDate = `${currentYear}-12-31`;

          if (latestApproved) {
            // Default payroll month = Latest Approved Month + 1
            // Parse manually to avoid timezone issues with "YYYY-MM-DD"
            const [yearStr, monthStr] = latestApproved.payrollMonthDate.split('-');
            let year = parseInt(yearStr);
            let month = parseInt(monthStr);

            // Add 1 month
            month += 1;
            if (month > 12) {
              month = 1;
              year += 1;
            }
            
            defaultPayrollMonthDate = `${year}-${month.toString().padStart(2, '0')}-01`;
            defaultBonusYear = year;

            // Default period start = Latest Approved End Date + 1 day
            const latestEndDate = new Date(latestApproved.periodEndDate);
            latestEndDate.setDate(latestEndDate.getDate() + 1);
            defaultStartDate = latestEndDate.toISOString().split('T')[0];
            
            // Default period end = Dec 31 of the start date's year
            const startYear = latestEndDate.getFullYear();
            defaultEndDate = `${startYear}-12-31`;
          }

          form.reset({
            payrollMonthDate: defaultPayrollMonthDate,
            bonusYear: defaultBonusYear,
            periodStartDate: defaultStartDate,
            periodEndDate: defaultEndDate,
          });
        } catch (error) {
          console.error('Failed to fetch latest cycle:', error);
        } finally {
          setIsLoadingDefaults(false);
        }
      };

      fetchDefaults();
    }
  }, [open, form, currentMonth, currentYear]);

  // Update bonusYear and end date when payrollMonthDate changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'payrollMonthDate' && value.payrollMonthDate) {
        const [yearStr] = value.payrollMonthDate.split('-');
        const payrollYear = parseInt(yearStr);
        form.setValue('bonusYear', payrollYear);
      }
      if (name === 'periodStartDate' && value.periodStartDate) {
        const startDate = new Date(value.periodStartDate);
        const startYear = startDate.getFullYear();
        const endDate = `${startYear}-12-31`;
        form.setValue('periodEndDate', endDate);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const onSubmit = async (data: CreateCycleFormValues) => {
    try {
      setErrorMessage(null);
      
      // Convert month/year to payrollMonthDate (first day of the month)
      const payrollMonthDate = data.payrollMonthDate;
      
      const createdCycle = await bonusService.createCycle({
        payrollMonthDate,
        bonusYear: data.bonusYear, // Send Gregorian year to API
        periodStartDate: data.periodStartDate,
        periodEndDate: data.periodEndDate,
      });
      
      toast({
        title: t('success'),
        variant: 'default',
      });
      setOpen(false);
      form.reset({
        payrollMonthDate: `${currentYear}-${currentMonth.padStart(2, '0')}-01`,
        bonusYear: currentYear,
        periodStartDate: `${currentYear}-01-01`, // Reset to current year's start
        periodEndDate: `${currentYear}-12-31`,   // Reset to current year's end
      });
      onSuccess(createdCycle.id);
    } catch (error: any) {
      console.log('API Error:', error);
      
      // Error is now ApiError from api-client.ts
      const statusCode = error.statusCode;
      const detail = error.detail || '';
      
      console.log('Status:', statusCode);
      console.log('Detail:', detail);
      
      if (statusCode === 409 || statusCode === 500) {
        // Known error codes from API
        const knownErrorCodes = [
          'BONUS_CYCLE_APPROVED_EXISTS',
          'BONUS_CYCLE_PENDING_EXISTS',
          'BONUS_CYCLE_PERIOD_EXISTS',
          'BONUS_CYCLE_CREATE_FAILED'
        ];
        
        if (knownErrorCodes.includes(detail)) {
          console.log('Found known error code, translating:', `errors.${detail}`);
          setErrorMessage(t(`errors.${detail}`));
        } else if (detail.includes('pending bonus cycle')) {
          setErrorMessage(t('errors.conflictPending'));
        } else if (detail.includes('approved bonus cycle')) {
          setErrorMessage(t('errors.conflictApproved'));
        } else {
          setErrorMessage(t('error'));
        }
      } else {
        setErrorMessage(t('error'));
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button>{tCommon('create')}</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <Alert>
          <AlertDescription className="text-sm">{t('note')}</AlertDescription>
        </Alert>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {errorMessage && (
              <DismissibleAlert
                variant="error"
                onDismiss={() => setErrorMessage(null)}
                autoDismiss={false}
              >
                {errorMessage}
              </DismissibleAlert>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="payrollMonthDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('payrollMonth')}</FormLabel>
                    <FormControl>
                    <MonthPicker
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder={t('payrollMonth')}
                    />
                  </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bonusYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('bonusYear')}</FormLabel>
                    <Select
                      value={field.value?.toString()}
                      onValueChange={(val) => field.onChange(parseInt(val))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('bonusYear')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {yearOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value.toString()}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="periodStartDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('startDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="periodEndDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('endDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {tCommon('cancel')}
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tCommon('save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

