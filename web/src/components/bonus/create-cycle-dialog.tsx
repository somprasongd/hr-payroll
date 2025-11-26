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
  latestCycle?: { periodEndDate: string } | null;
}

export function CreateCycleDialog({ onSuccess, latestCycle }: CreateCycleDialogProps) {
  const t = useTranslations('Bonus.create');
  const tCommon = useTranslations('Common');
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const currentDate = new Date();
  const currentMonth = (currentDate.getMonth() + 1).toString();
  const currentYear = currentDate.getFullYear().toString();

  // Calculate default dates
  const getDefaultDates = () => {
    let startDate: string;
    let endDate: string;

    if (latestCycle?.periodEndDate) {
      // If there's a previous cycle, start date = latest end date + 1 day
      const latestEnd = new Date(latestCycle.periodEndDate);
      latestEnd.setDate(latestEnd.getDate() + 1);
      startDate = latestEnd.toISOString().split('T')[0];
      
      // End date = Dec 31 of the same year as start date
      const startYear = latestEnd.getFullYear();
      endDate = `${startYear}-12-31`;
    } else {
      // If no previous cycle, start = Jan 1 current year
      startDate = `${currentYear}-01-01`;
      endDate = `${currentYear}-12-31`;
    }

    return { startDate, endDate };
  };

  const defaultDates = getDefaultDates();

  const form = useForm<CreateCycleFormValues>({
    resolver: zodResolver(createCycleSchema),
    defaultValues: {
      payrollMonth: currentMonth,
      payrollYear: currentYear,
      periodStartDate: defaultDates.startDate,
      periodEndDate: defaultDates.endDate,
    },
  });

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
        periodStartDate: defaultDates.startDate,
        periodEndDate: defaultDates.endDate,
      });
      onSuccess();
    } catch (error: any) {
      setErrorMessage(t('error'));
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
        <Button>{tCommon('create')}</Button>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
