'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DismissibleAlert } from "@/components/ui/dismissible-alert";
import { useToast } from "@/hooks/use-toast";
import { salaryAdvanceService, SalaryAdvance } from '@/services/salary-advance-service';
import { payrollService } from '@/services/payroll.service';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MonthPicker } from "@/components/ui/month-picker";

const formSchema = z.object({
  amount: z.coerce.number().min(1, { message: "amountMinError" }),
  advanceDate: z.string().min(1, { message: "required" }),
  payrollMonthDate: z.string().min(1, { message: "required" }),
});

interface EditSalaryAdvanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: SalaryAdvance;
  onSuccess: () => void;
}

export function EditSalaryAdvanceDialog({ 
  open, 
  onOpenChange,
  item,
  onSuccess 
}: EditSalaryAdvanceDialogProps) {
  const t = useTranslations('SalaryAdvance');
  const tCommon = useTranslations('Common');
  const { toast } = useToast();
  const [error, setError] = useState<string>('');
  const [isValidating, setIsValidating] = useState(false);

  const currentDate = new Date();
  const currentMonth = (currentDate.getMonth() + 1).toString();
  const currentYear = currentDate.getFullYear().toString();
  const yearOptions = Array.from({ length: 4 }, (_, i) => (currentDate.getFullYear() + i).toString());

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: item.amount,
      advanceDate: item.advanceDate,
    },
  });

  useEffect(() => {
    if (open) {
      setError(''); // Clear error when dialog opens
      // Convert date to YYYY-MM-DD format for input[type="date"]
      const dateValue = item.advanceDate ? new Date(item.advanceDate).toISOString().split('T')[0] : '';
      
      // Extract month and year from payrollMonthDate
      let monthDate = `${currentYear}-${currentMonth.padStart(2, '0')}-01`;
      if (item.payrollMonthDate) {
        monthDate = item.payrollMonthDate;
      }
      
      form.reset({
        amount: item.amount,
        advanceDate: dateValue,
        payrollMonthDate: monthDate,
      });
    }
  }, [open, item]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setError(''); // Clear previous errors
      setIsValidating(true);

      // Validate payroll month - only block if cycle exists and is already approved
      const validation = await payrollService.validatePayrollMonth(values.payrollMonthDate);

      if (validation.exists && validation.approved) {
        setError(t('errors.invalidPayrollMonth') || 'งวดเงินเดือนที่เลือกได้รับการอนุมัติแล้ว ไม่สามารถเลือกงวดนี้ได้');
        setIsValidating(false);
        return;
      }

      // Format payrollMonthDate to YYYY-MM-DD
      let formattedPayrollMonthDate = values.payrollMonthDate;
      if (formattedPayrollMonthDate.includes('T')) {
        formattedPayrollMonthDate = formattedPayrollMonthDate.split('T')[0];
      }

      // Update the payload with payrollMonthDate
      const payload = {
        amount: values.amount,
        advanceDate: values.advanceDate,
        payrollMonthDate: formattedPayrollMonthDate,
      };

      await salaryAdvanceService.update(item.id, payload);
      toast({
        title: tCommon('success'),
        description: t('updateSuccess'),
      });
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error(error);
      const errorMessage = error?.response?.data?.detail || error?.response?.data?.message || error?.message || t('updateError');
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: tCommon('error'),
        description: errorMessage,
      });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('editTitle')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <DismissibleAlert
                variant="error"
                title={tCommon('error')}
                onDismiss={() => setError('')}
                autoDismiss={false}
              >
                {error}
              </DismissibleAlert>
            )}
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <FormLabel className="text-right">{t('employee')}</FormLabel>
                <div className="col-span-3 font-medium">
                  {item.employeeName}
                </div>
              </div>
            </div>
            <FormField
              control={form.control}
              name="amount"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>{t('amount')}</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={field.value as number} />
                  </FormControl>
                  {fieldState.error && (
                    <p className="text-sm font-medium text-destructive">
                      {fieldState.error.message === 'amountMinError' 
                        ? t('errors.amountMinError') 
                        : fieldState.error.message === 'required'
                        ? tCommon('required')
                        : fieldState.error.message}
                    </p>
                  )}
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="advanceDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('advanceDate')}</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="payrollMonthDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('payrollMonth') || 'งวดที่หัก'}</FormLabel>
                  <FormControl>
                    <MonthPicker
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder={t('payrollMonth') || 'งวดที่หัก'}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {tCommon('cancel')}
              </Button>
              <Button type="submit" disabled={isValidating}>
                {isValidating ? t('validating') || 'กำลังตรวจสอบ...' : tCommon('save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
