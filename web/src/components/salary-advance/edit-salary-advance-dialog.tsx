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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
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

const formSchema = z.object({
  amount: z.coerce.number().min(1, { message: "Amount must be greater than 0" }),
  advanceDate: z.string().min(1, { message: "Required" }),
  payrollMonth: z.string().min(1, { message: "Required" }),
  payrollYear: z.string().min(1, { message: "Required" }),
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
      let month = currentMonth;
      let year = currentYear;
      if (item.payrollMonthDate) {
        const payrollDate = new Date(item.payrollMonthDate);
        month = (payrollDate.getMonth() + 1).toString();
        year = payrollDate.getFullYear().toString();
      }
      
      form.reset({
        amount: item.amount,
        advanceDate: dateValue,
        payrollMonth: month,
        payrollYear: year,
      });
    }
  }, [open, item]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setError(''); // Clear previous errors
      setIsValidating(true);

      // Validate payroll month - only block if cycle exists and is already approved
      const monthDate = `${values.payrollYear}-${values.payrollMonth.padStart(2, '0')}-01`;
      const validation = await payrollService.validatePayrollMonth(monthDate);

      if (validation.exists && validation.approved) {
        setError(t('errors.invalidPayrollMonth') || 'งวดเงินเดือนที่เลือกได้รับการอนุมัติแล้ว ไม่สามารถเลือกงวดนี้ได้');
        setIsValidating(false);
        return;
      }

      // Update the payload with payrollMonthDate
      const payload = {
        amount: values.amount,
        advanceDate: values.advanceDate,
        payrollMonthDate: monthDate,
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
      const errorMessage = error?.response?.data?.message || t('updateError');
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
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{tCommon('error')}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
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
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('amount')}</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={field.value as number} />
                  </FormControl>
                  <FormMessage />
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
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="payrollMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('payrollMonth') || 'งวดที่หัก'}</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        const selectedYear = parseInt(form.getValues('payrollYear'));
                        const selectedMonth = parseInt(value);
                        const now = new Date();
                        const currentYear = now.getFullYear();
                        const currentMonth = now.getMonth() + 1;
                        
                        // Prevent selecting past months
                        if (selectedYear === currentYear && selectedMonth < currentMonth) {
                          return;
                        }
                        field.onChange(value);
                      }} 
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="เลือกเดือน" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => {
                          const month = (i + 1).toString();
                          const selectedYear = parseInt(form.getValues('payrollYear'));
                          const now = new Date();
                          const currentYear = now.getFullYear();
                          const currentMonth = now.getMonth() + 1;
                          const isDisabled = selectedYear === currentYear && (i + 1) < currentMonth;
                          
                          return (
                            <SelectItem key={month} value={month} disabled={isDisabled}>
                              {new Date(2000, i).toLocaleString('th-TH', { month: 'long' })}
                            </SelectItem>
                          );
                        })}
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
                    <FormLabel>{t('payrollYear') || 'ปี'}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="เลือกปี" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {yearOptions.map((year) => (
                          <SelectItem key={year} value={year}>
                            {parseInt(year) + 543}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
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
