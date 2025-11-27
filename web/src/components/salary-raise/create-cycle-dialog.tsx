'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslations } from 'next-intl';
import { format, addDays, startOfYear, endOfYear } from 'date-fns';
import { CalendarIcon, Loader2, AlertCircle } from 'lucide-react';

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
import { salaryRaiseService } from '@/services/salary-raise.service';
import { Alert, AlertDescription } from '@/components/ui/alert';

const createCycleSchema = z.object({
  periodStartDate: z.string().min(1, 'Start date is required'),
  periodEndDate: z.string().min(1, 'End date is required'),
}).refine((data) => {
  const start = new Date(data.periodStartDate);
  const end = new Date(data.periodEndDate);
  return end >= start;
}, {
  message: "End date must be after start date",
  path: ["periodEndDate"],
});

type CreateCycleFormValues = z.infer<typeof createCycleSchema>;

interface CreateCycleDialogProps {
  onSuccess: (id?: string) => void;
  latestCycleEndDate?: string;
  trigger?: React.ReactNode;
}

export function CreateCycleDialog({ onSuccess, latestCycleEndDate, trigger }: CreateCycleDialogProps) {
  const t = useTranslations('SalaryRaise');
  const tCommon = useTranslations('Common');
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CreateCycleFormValues>({
    resolver: zodResolver(createCycleSchema),
    defaultValues: {
      periodStartDate: '',
      periodEndDate: '',
    },
  });

  useEffect(() => {
    if (open) {
      const today = new Date();
      let startDate = startOfYear(today);
      
      if (latestCycleEndDate) {
        startDate = addDays(new Date(latestCycleEndDate), 1);
      }

      const endDate = endOfYear(startDate);

      form.reset({
        periodStartDate: format(startDate, 'yyyy-MM-dd'),
        periodEndDate: format(endDate, 'yyyy-MM-dd'),
      });
    }
  }, [open, latestCycleEndDate, form]);

  async function onSubmit(data: CreateCycleFormValues) {
    setError(null);
    try {
      setIsSubmitting(true);
      const response = await salaryRaiseService.createCycle(data);
      
      toast({
        title: t('create.success'),
        variant: 'default',
      });
      
      setOpen(false);
      form.reset();
      onSuccess(response.id);
    } catch (error: any) {
      console.error('Failed to create cycle:', error);
      
      let errorMessage = 'Failed to create cycle. Please try again.';
      if (error?.response?.data?.detail?.includes('ensure only one pending cycle exists')) {
        errorMessage = t('create.error.overlapOrPending');
      }

      setError(errorMessage);
      // Toast notification removed as per user request
      console.log('Error set in dialog:', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button>{t('createButton')}</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('create.title')}</DialogTitle>
          <DialogDescription>
            {t('create.description')}
            <span className="mt-2 block text-sm text-muted-foreground">
              {t('create.note')}
            </span>
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
              name="periodStartDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('create.startDate')}</FormLabel>
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
                  <FormLabel>{t('create.endDate')}</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
