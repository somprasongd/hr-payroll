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
import { useCurrentBranchId } from "@/hooks/use-branch-change";
import { debtService } from '@/services/debt.service';
import { employeeService, Employee } from '@/services/employee.service';
import { accumulationService } from '@/services/accumulation.service';
import { companyBankAccountService, CompanyBankAccount } from '@/services/company-bank-account.service';

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
    const currentBranchId = useCurrentBranchId(); // Get current branch from header selector
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [companyBankAccounts, setCompanyBankAccounts] = useState<CompanyBankAccount[]>([]);
    const [currentDebt, setCurrentDebt] = useState(0);

  const createSchema = (maxAmount: number) => z.object({
    employeeId: z.string().min(1, "Employee is required"),
    txnDate: z.string().min(1, "Date is required").refine(date => date <= format(new Date(), 'yyyy-MM-dd'), t('validation.futureDateNotAllowed')),
    amount: z.coerce.number()
      .min(0.01, t('validation.amountRequired'))
      .max(maxAmount > 0 ? maxAmount : Number.MAX_SAFE_INTEGER, t('validation.amountExceedsOutstanding', { amount: maxAmount.toLocaleString() })),
    reason: z.string().optional(),
    paymentMethod: z.enum(["cash", "bank_transfer"]),
    companyBankAccountId: z.string().optional(),
    transferTime: z.string().optional(),
    transferDate: z.string().optional().refine(date => !date || date <= format(new Date(), 'yyyy-MM-dd'), t('validation.futureDateNotAllowed')),
  }).superRefine((data, ctx) => {
    if (data.paymentMethod === "bank_transfer") {
      if (!data.companyBankAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('validation.bankAccountRequired'),
          path: ["companyBankAccountId"],
        });
      }
      if (!data.transferTime) {
         ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('validation.timeRequired'),
          path: ["transferTime"],
        });
      }
      if (!data.transferDate) {
         ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('validation.dateRequired'), // Or reuse existing message if needed
          path: ["transferDate"],
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
      companyBankAccountId: "",
      transferTime: "",
      transferDate: "",
      reason: "",
    }
  });

  // Sync transferDate with txnDate/today by default
  const txnDate = form.watch('txnDate');
  useEffect(() => {
    if (open) {
       const currentTxnDate = form.getValues('txnDate') || format(new Date(), 'yyyy-MM-dd');
       // If payment method is bank transfer and no transfer date set, set it. 
       // Simpler: Just ensure if txnDate updates, we might want to update transferDate if user hasn't manually set it?
       // For simplicity based on user request "default date matches txn date", let's just init it.
       // But user said: "if change txn date, change transfer date too".
       form.setValue('transferDate', currentTxnDate);
    }
  }, [txnDate, open, form]);

  const fetchCompanyBankAccounts = async (branchId?: string) => {
    try {
      // Fetch active accounts: central + employee's branch (if branchId provided)
      const data = await companyBankAccountService.list({
        branchId: branchId || undefined,
        includeCentral: true,
        isActive: true,
      });
      setCompanyBankAccounts(data);
    } catch (error) {
      console.error('Failed to fetch company bank accounts', error);
    }
  };

  useEffect(() => {
    if (open) {
      fetchEmployees();
      // Fetch bank accounts for current branch (central + current branch)
      fetchCompanyBankAccounts(currentBranchId);
      const initialEmployeeId = selectedEmployeeId && selectedEmployeeId !== 'all' ? selectedEmployeeId : '';
      form.reset({
        employeeId: initialEmployeeId,
        txnDate: format(new Date(), 'yyyy-MM-dd'),
        amount: 0,
        paymentMethod: "cash",
        companyBankAccountId: "",
        transferTime: "",
        transferDate: format(new Date(), 'yyyy-MM-dd'),
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
        companyBankAccountId: data.companyBankAccountId || undefined,
        transferTime: data.transferTime || undefined,
        transferDate: data.transferDate || undefined,
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
    form.setValue('companyBankAccountId', ''); // Reset bank account selection
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
                    <DateInput {...field} max={format(new Date(), 'yyyy-MM-dd')} />
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
                    <Input 
                      type="number" 
                      step="0.01" 
                      {...field} 
                      value={field.value as number}
                      onFocus={(e) => e.target.select()}
                    />
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
                  name="companyBankAccountId"
                  render={({ field }) => {
                    // Bank accounts are already filtered by API (branchId + isActive)
                    const selectedAccount = companyBankAccounts.find(acc => acc.id === field.value);
                    
                    return (
                      <FormItem>
                        <FormLabel>{t('fields.companyBankAccount')}</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('placeholders.selectCompanyBankAccount')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {companyBankAccounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                <div className="flex flex-col">
                                  <span>{account.accountName}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {account.bankNameTh} ({account.bankCode}) - {account.accountNumber}
                                    {account.branchId ? ` [${account.branchName}]` : ' [กลาง]'}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedAccount && (
                          <p className="text-xs text-muted-foreground mt-1">
                            เลขที่บัญชี: {selectedAccount.accountNumber}
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                
                <FormField
                  control={form.control}
                  name="transferDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('fields.transferDate') || "Transfer Date"}</FormLabel>
                      <FormControl>
                        <DateInput {...field} max={format(new Date(), 'yyyy-MM-dd')} />
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
