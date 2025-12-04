'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';

import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { DateInput } from "@/components/ui/date-input";
import { Combobox } from "@/components/ui/combobox";
import { EmployeeSelector } from "@/components/common/employee-selector";
import { useToast } from "@/hooks/use-toast";
import { debtService } from '@/services/debt.service';
import { employeeService, Employee } from '@/services/employee.service';
import { accumulationService } from '@/services/accumulation.service';

const formSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  txnDate: z.string().min(1, "Date is required"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  reason: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateRepaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  selectedEmployeeId?: string;
}

export function CreateRepaymentDialog({ open, onOpenChange, onSuccess, selectedEmployeeId }: CreateRepaymentDialogProps) {
  const t = useTranslations('Debt');
  const tCommon = useTranslations('Common');
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentDebt, setCurrentDebt] = useState(0);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeId: '',
      txnDate: format(new Date(), 'yyyy-MM-dd'),
      amount: 0,
    }
  });

  useEffect(() => {
    if (open) {
      fetchEmployees();
      const initialEmployeeId = selectedEmployeeId && selectedEmployeeId !== 'all' ? selectedEmployeeId : '';
      form.reset({
        employeeId: initialEmployeeId,
        txnDate: format(new Date(), 'yyyy-MM-dd'),
        amount: 0,
        reason: ''
      });
      if (initialEmployeeId) {
        fetchCurrentDebt(initialEmployeeId);
      } else {
        setCurrentDebt(0);
      }
    }
  }, [open, selectedEmployeeId]);

  const fetchCurrentDebt = async (empId: string) => {
    try {
      const response = await accumulationService.getAccumulations(empId);
      const loanRecord = response.data.find(r => r.accumType === 'loan_outstanding');
      setCurrentDebt(loanRecord?.amount || 0);
    } catch (error) {
      console.error('Failed to fetch debt', error);
      setCurrentDebt(0);
    }
  };

  const watchAmount = form.watch('amount');
  const remainingDebt = currentDebt - Number(watchAmount || 0);

  const fetchEmployees = async () => {
    try {
      const response = await employeeService.getEmployees({ limit: 100, status: 'active' });
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Failed to fetch employees', error);
    }
  };

  const onSubmit = async (data: FormValues) => {
    try {
      await debtService.createRepayment({
        employeeId: data.employeeId,
        amount: data.amount,
        txnDate: data.txnDate,
        reason: data.reason
      });
      
      toast({
        title: tCommon('success'),
        description: t('create.success'),
      });
      
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error(error);
      toast({
        variant: "destructive",
        title: tCommon('error'),
        description: error.response?.data?.message || tCommon('error'),
      });
    }
  };

  const handleEmployeeChange = (value: string) => {
    form.setValue('employeeId', value);
    fetchCurrentDebt(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('actions.repay')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="employeeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.employee')}</FormLabel>
                  <FormControl>
                    <EmployeeSelector
                      employees={employees}
                      selectedEmployeeId={field.value}
                      onSelect={handleEmployeeChange}
                      placeholder={t('fields.employee')}
                      searchPlaceholder={tCommon('search')}
                      emptyText={tCommon('noData')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">{t('fields.currentOutstanding')}</span>
                <span className="text-sm font-bold">{currentDebt.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">{t('fields.newOutstanding')}</span>
                <span className={`text-lg font-bold ${remainingDebt < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                  {remainingDebt.toLocaleString()}
                </span>
              </div>
            </div>

            <FormField
              control={form.control}
              name="txnDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.txnDate')}</FormLabel>
                  <FormControl>
                    <DateInput {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.amount')}</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} value={field.value as number} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.reason')}</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {tCommon('cancel')}
              </Button>
              <Button type="submit">
                {tCommon('save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
