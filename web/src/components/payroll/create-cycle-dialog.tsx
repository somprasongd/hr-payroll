'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslations } from 'next-intl';
import { format, startOfMonth, endOfMonth, addDays } from 'date-fns';
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
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { payrollService } from '@/services/payroll.service';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MonthPicker } from '@/components/ui/month-picker';

const createCycleSchema = z.object({
  payrollMonthDate: z.string().min(1, 'Payroll month is required'),
  periodStartDate: z.string().min(1, 'Start date is required'),
  periodEndDate: z.string().min(1, 'End date is required'), // Although not sent to API, useful for UI logic if needed, but API takes PayDate
  payDate: z.string().min(1, 'Pay date is required'),
  socialSecurityRateEmployee: z.coerce.number().min(0).max(100),
  socialSecurityRateEmployer: z.coerce.number().min(0).max(100),
}).refine((data) => {
  const start = new Date(data.periodStartDate);
  const pay = new Date(data.payDate);
  return pay >= start;
}, {
  message: "Pay date must be after start date",
  path: ["payDate"],
});

type CreateCycleFormValues = z.infer<typeof createCycleSchema>;

interface CreateCycleDialogProps {
  onSuccess: (id?: string) => void;
  trigger?: React.ReactNode;
}

export function CreateCycleDialog({ onSuccess, trigger }: CreateCycleDialogProps) {
  const t = useTranslations('Payroll'); 
  const tCommon = useTranslations('Common');
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CreateCycleFormValues>({
    resolver: zodResolver(createCycleSchema) as any,
    defaultValues: {
      payrollMonthDate: '',
      periodStartDate: '',
      periodEndDate: '',
      payDate: '',
      socialSecurityRateEmployee: 5,
      socialSecurityRateEmployer: 5,
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      const today = new Date();
      const start = startOfMonth(today);
      const end = endOfMonth(today);
      
      form.reset({
        payrollMonthDate: format(start, 'yyyy-MM-dd'),
        periodStartDate: format(start, 'yyyy-MM-dd'),
        periodEndDate: format(end, 'yyyy-MM-dd'),
        payDate: format(end, 'yyyy-MM-dd'), // Default pay date to end of month
        socialSecurityRateEmployee: 5,
        socialSecurityRateEmployer: 5,
      });
    }
  }, [open, form]);

  async function onSubmit(data: CreateCycleFormValues) {
    setError(null);
    try {
      setIsSubmitting(true);
      
      // Validate if month already exists
      const validation = await payrollService.validatePayrollMonth(data.payrollMonthDate);
      if (validation.exists) {
        setError('Payroll run for this month already exists');
        return;
      }

      const response = await payrollService.createPayrollRun({
        payrollMonthDate: data.payrollMonthDate,
        periodStartDate: data.periodStartDate,
        payDate: data.payDate,
        socialSecurityRateEmployee: data.socialSecurityRateEmployee / 100,
        socialSecurityRateEmployer: data.socialSecurityRateEmployer / 100,
      });
      
      toast({
        title: tCommon('success'),
        description: 'Payroll cycle created successfully',
        variant: 'default',
      });
      
      setOpen(false);
      form.reset();
      onSuccess(response.id);
    } catch (error: any) {
      console.error('Failed to create cycle:', error);
      setError(error?.response?.data?.message || 'Failed to create cycle. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button>{tCommon('create')}</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('createTitle')}</DialogTitle>
          <DialogDescription>
            {t('createDescription')}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            <FormField
              control={form.control}
              name="payrollMonthDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.month')}</FormLabel>
                  <FormControl>
                    <MonthPicker 
                      value={field.value} 
                      onValueChange={(val) => {
                        field.onChange(val);
                        // Auto-set dates based on selected month
                        if (val) {
                          const date = new Date(val);
                          const start = startOfMonth(date);
                          const end = endOfMonth(date);
                          form.setValue('periodStartDate', format(start, 'yyyy-MM-dd'));
                          form.setValue('periodEndDate', format(end, 'yyyy-MM-dd'));
                          form.setValue('payDate', format(end, 'yyyy-MM-dd'));
                        }
                      }} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="periodStartDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.periodStart')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="payDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.payDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="socialSecurityRateEmployee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.ssoEmployee')}</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="socialSecurityRateEmployer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.ssoEmployer')}</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                {tCommon('cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tCommon('save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
