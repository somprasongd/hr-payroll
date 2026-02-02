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
import { EmployeeSelector } from "@/components/common/employee-selector";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { debtService } from '@/services/debt.service';
import { employeeService, Employee } from '@/services/employee.service';
import { accumulationService } from '@/services/accumulation.service';
import { masterDataService, Bank } from '@/services/master-data.service';

  interface CreateRepaymentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: (id?: string) => void;
    selectedEmployeeId?: string;
  }

  
  export function CreateRepaymentDialog({ open, onOpenChange, onSuccess, selectedEmployeeId }: CreateRepaymentDialogProps) {
    const t = useTranslations('Debt');
    const tCommon = useTranslations('Common');
    const { toast } = useToast();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [banks, setBanks] = useState<Bank[]>([]);
    const [currentDebt, setCurrentDebt] = useState(0);

  const createSchema = (maxAmount: number) => z.object({
    employeeId: z.string().min(1, "Employee is required"),
    txnDate: z.string().min(1, "Date is required"),
    amount: z.coerce.number()
      .min(0.01, t('validation.amountRequired'))
      .max(maxAmount > 0 ? maxAmount : Number.MAX_SAFE_INTEGER, t('validation.amountExceedsOutstanding', { amount: maxAmount.toLocaleString() })),
    reason: z.string().optional(),
    paymentMethod: z.enum(["cash", "bank_transfer"]),
    bankId: z.string().optional(),
    bankAccountNumber: z.string().optional(),
    transferTime: z.string().optional(),
  }).superRefine((data, ctx) => {
    if (data.paymentMethod === "bank_transfer") {
      if (!data.bankId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('validation.bankNameRequired'),
          path: ["bankId"],
        });
      }
      if (!data.bankAccountNumber) {
         ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('validation.accountNumberRequired'),
          path: ["bankAccountNumber"],
        });
      }
      if (!data.transferTime) {
         ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('validation.timeRequired'),
          path: ["transferTime"],
        });
      }
    }
  });

  const formSchema = createSchema(currentDebt);
  type FormValues = z.infer<typeof formSchema>;

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeId: '',
      txnDate: format(new Date(), 'yyyy-MM-dd'),
      amount: 0,
      paymentMethod: "cash",
      bankId: "",
      bankAccountNumber: "",
      transferTime: "",
      reason: "",
    }
  });

  const fetchBanks = async () => {
    try {
      const data = await masterDataService.getBanks();
      setBanks(data || []);
    } catch (error) {
      console.error('Failed to fetch banks', error);
    }
  };

  useEffect(() => {
    if (open) {
      fetchEmployees();
      fetchBanks();
      const initialEmployeeId = selectedEmployeeId && selectedEmployeeId !== 'all' ? selectedEmployeeId : '';
      form.reset({
        employeeId: initialEmployeeId,
        txnDate: format(new Date(), 'yyyy-MM-dd'),
        amount: 0,
        paymentMethod: "cash",
        bankId: "",
        bankAccountNumber: "",
        transferTime: "",
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
      const response = await employeeService.getEmployees({ limit: 100, status: 'active', hasOutstandingDebt: true });
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Failed to fetch employees', error);
    }
  };

  const onSubmit = async (data: FormValues) => {
    try {
      const response = await debtService.createRepayment({
        employeeId: data.employeeId,
        amount: data.amount,
        txnDate: data.txnDate,
        reason: data.reason,
        paymentMethod: data.paymentMethod,
        bankId: data.bankId || undefined,
        bankAccountNumber: data.bankAccountNumber || undefined,
        transferTime: data.transferTime || undefined,
      });
      
      toast({
        title: tCommon('success'),
        description: t('create.success'),
      });
      
      onOpenChange(false);
      onSuccess(response.id);
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
              name="paymentMethod"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>{t('fields.paymentMethod') || "Type"}</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col space-y-1"
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="cash" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          {t('paymentMethod.cash') || "Cash"}
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="bank_transfer" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          {t('paymentMethod.bank_transfer') || "Bank Transfer"}
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch('paymentMethod') === 'bank_transfer' && (
              <div className="space-y-4 border p-4 rounded-md bg-gray-50">
                <FormField
                  control={form.control}
                  name="bankId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('fields.bankName') || "Bank Name"}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Bank" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {banks.map((bank) => (
                            <SelectItem key={bank.id} value={bank.id}>
                              {bank.nameTh} ({bank.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="bankAccountNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('fields.bankAccountNumber') || "Account No."}</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="transferTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('fields.transferTime') || "Time"}</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
              </div>
            )}

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
