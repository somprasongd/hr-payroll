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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MonthPicker } from "@/components/ui/month-picker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { salaryAdvanceService } from '@/services/salary-advance-service';
import { employeeService } from '@/services/employee.service';
import { payrollService } from '@/services/payroll.service';
import { EmployeeSelector } from '@/components/common/employee-selector';

const formSchema = z.object({
  employeeId: z.string().min(1, { message: "Required" }),
  amount: z.coerce.number().min(1, { message: "Amount must be greater than 0" }),
  advanceDate: z.string().min(1, { message: "Required" }),
  payrollMonthDate: z.string().min(1, { message: "Required" }),
});

interface CreateSalaryAdvanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultEmployeeId?: string;
}

export function CreateSalaryAdvanceDialog({ 
  open, 
  onOpenChange,
  onSuccess,
  defaultEmployeeId
}: CreateSalaryAdvanceDialogProps) {
  const t = useTranslations('SalaryAdvance');
  const tCommon = useTranslations('Common');
  const { toast } = useToast();
  const [employees, setEmployees] = useState<any[]>([]);
  const [error, setError] = useState<string>('');
  const [isValidating, setIsValidating] = useState(false);

  const currentDate = new Date();
  const currentMonth = (currentDate.getMonth() + 1).toString();
  const currentYear = currentDate.getFullYear().toString();

  // Generate year options (current + 3 years)
  const yearOptions = Array.from({ length: 4 }, (_, i) => (currentDate.getFullYear() + i).toString());

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeId: '',
      amount: 0,
      advanceDate: new Date().toISOString().split('T')[0],
      payrollMonthDate: `${currentYear}-${currentMonth.padStart(2, '0')}-01`,
    },
  });

  useEffect(() => {
    if (open) {
      loadEmployees();
      setError(''); // Clear error when dialog opens
      loadDefaultPayrollMonth();
    }
  }, [open, defaultEmployeeId]);

  const loadEmployees = async () => {
    try {
      const response = await employeeService.getEmployees({ status: 'active', limit: 1000 });
      setEmployees(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadDefaultPayrollMonth = async () => {
    try {
      // Try to get pending payroll run
      const pendingRun = await payrollService.getPendingPayrollRun();
      let monthDate = `${currentYear}-${currentMonth.padStart(2, '0')}-01`;

      if (pendingRun && pendingRun.payrollMonthDate) {
        monthDate = pendingRun.payrollMonthDate;
      }

      form.reset({
        employeeId: defaultEmployeeId || '',
        amount: 0,
        advanceDate: new Date().toISOString().split('T')[0],
        payrollMonthDate: monthDate,
      });
    } catch (error) {
      console.error('Failed to load default payroll month', error);
      form.reset({
        employeeId: defaultEmployeeId || '',
        amount: 0,
        advanceDate: new Date().toISOString().split('T')[0],
        payrollMonthDate: `${currentYear}-${currentMonth.padStart(2, '0')}-01`,
      });
    }
  };

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

      // Create the payload with payrollMonthDate
      const payload = {
        employeeId: values.employeeId,
        amount: values.amount,
        advanceDate: values.advanceDate,
        payrollMonthDate: values.payrollMonthDate,
      };

      await salaryAdvanceService.create(payload);
      toast({
        title: tCommon('success'),
        description: t('createSuccess'),
      });
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error(error);
      const errorMessage = error?.response?.data?.message || t('createError');
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
          <DialogTitle>{t('createTitle')}</DialogTitle>
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
            <FormField
              control={form.control}
              name="employeeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('employee')}</FormLabel>
                  <EmployeeSelector
                    employees={employees}
                    selectedEmployeeId={field.value}
                    onSelect={field.onChange}
                    placeholder={t('selectEmployee')}
                    searchPlaceholder={tCommon('search')}
                    emptyText={tCommon('noData')}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
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
