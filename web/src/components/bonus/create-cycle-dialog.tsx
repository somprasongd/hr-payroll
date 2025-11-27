'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, AlertCircle } from 'lucide-react';
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
import { bonusService } from '@/services/bonus-service';
import { useToast } from '@/hooks/use-toast';

const createCycleSchema = z.object({
  payrollMonth: z.string().min(1, 'Required'),
  payrollYear: z.string().min(1, 'Required'),
  periodStartDate: z.string().min(1, 'Required'),
  periodEndDate: z.string().min(1, 'Required'),
});

type CreateCycleFormValues = z.infer<typeof createCycleSchema>;

interface CreateCycleDialogProps {
  onSuccess: () => void;
  trigger?: React.ReactNode;
}

export function CreateCycleDialog({ onSuccess, trigger }: CreateCycleDialogProps) {
  const t = useTranslations('Bonus.create');
  const tCommon = useTranslations('Common');
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const currentDate = new Date();
  const currentMonth = (currentDate.getMonth() + 1).toString();
  const currentYear = currentDate.getFullYear().toString();

  const form = useForm<CreateCycleFormValues>({
    resolver: zodResolver(createCycleSchema),
    defaultValues: {
      payrollMonth: currentMonth,
      payrollYear: currentYear,
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

          let defaultPayrollMonth = currentMonth;
          let defaultPayrollYear = currentYear;
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
            
            defaultPayrollMonth = month.toString();
            defaultPayrollYear = year.toString();

            // Default period start = Latest Approved End Date + 1 day
            const latestEndDate = new Date(latestApproved.periodEndDate);
            latestEndDate.setDate(latestEndDate.getDate() + 1);
            defaultStartDate = latestEndDate.toISOString().split('T')[0];
            
            // Default period end = Dec 31 of the start date's year
            const startYear = latestEndDate.getFullYear();
            defaultEndDate = `${startYear}-12-31`;
          }

          form.reset({
            payrollMonth: defaultPayrollMonth,
            payrollYear: defaultPayrollYear,
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

  // Update end date when start date changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
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
      const payrollMonthDate = `${data.payrollYear}-${data.payrollMonth.padStart(2, '0')}-01`;
      
      await bonusService.createCycle({
        payrollMonthDate,
        periodStartDate: data.periodStartDate,
        periodEndDate: data.periodEndDate,
      });
      
      toast({
        title: t('success'),
        variant: 'default',
      });
      setOpen(false);
      form.reset({
        payrollMonth: currentMonth,
        payrollYear: currentYear,
        periodStartDate: `${currentYear}-01-01`, // Reset to current year's start
        periodEndDate: `${currentYear}-12-31`,   // Reset to current year's end
      });
      onSuccess();
    } catch (error: any) {
      if (error.response?.status === 409) {
        const detail = error.response?.data?.detail || error.response?.data?.title || '';
        if (detail.includes('pending bonus cycle')) {
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

  const months = [
    { value: '1', label: 'มกราคม' },
    { value: '2', label: 'กุมภาพันธ์' },
    { value: '3', label: 'มีนาคม' },
    { value: '4', label: 'เมษายน' },
    { value: '5', label: 'พฤษภาคม' },
    { value: '6', label: 'มิถุนายน' },
    { value: '7', label: 'กรกฎาคม' },
    { value: '8', label: 'สิงหาคม' },
    { value: '9', label: 'กันยายน' },
    { value: '10', label: 'ตุลาคม' },
    { value: '11', label: 'พฤศจิกายน' },
    { value: '12', label: 'ธันวาคม' },
  ];

  const years = Array.from({ length: 10 }, (_, i) => {
    const year = currentDate.getFullYear() - 2 + i;
    return year.toString();
  });

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
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="payrollMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('payrollMonth')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {months.map((month) => (
                          <SelectItem key={month.value} value={month.value}>
                            {month.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="payrollYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('payrollYear')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {years.map((year) => (
                          <SelectItem key={year} value={year}>
                            {year}
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
