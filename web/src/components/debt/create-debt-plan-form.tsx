'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, addMonths, startOfMonth, parseISO } from 'date-fns';
import { Plus, Trash2, Calculator, ArrowLeft } from 'lucide-react';
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { useAuthStore } from '@/store/auth-store';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date-input";
import { Combobox } from "@/components/ui/combobox";
import { EmployeeSelector } from "@/components/common/employee-selector";
import { MonthPicker } from "@/components/ui/month-picker";
import { debtService } from '@/services/debt.service';
import { employeeService, Employee } from '@/services/employee.service';
import { accumulationService } from '@/services/accumulation.service';

const formSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  txnType: z.enum(["loan", "other"]),
  otherDesc: z.string().optional(),
  txnDate: z.string().min(1, "Date is required"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  reason: z.string().optional(),
  hasInstallment: z.boolean().default(false),
  installments: z.array(z.object({
    amount: z.coerce.number().min(0.01),
    payrollMonthDate: z.string().min(1)
  })).default([])
}).superRefine((data, ctx) => {
  if (data.txnType === 'other' && !data.otherDesc) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Description is required for Other Debt",
      path: ["otherDesc"]
    });
  }
  
  if (data.hasInstallment && data.installments && data.installments.length > 0) {
    const totalInstallment = data.installments.reduce((sum, item) => sum + item.amount, 0);
    // Allow small floating point difference
    if (Math.abs(totalInstallment - data.amount) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Total installments (${totalInstallment.toLocaleString()}) must equal loan amount (${data.amount.toLocaleString()})`,
        path: ["installments"]
      });
    }
    
    // Check for duplicate months
    const months = data.installments.map(item => item.payrollMonthDate.slice(0, 7));
    const uniqueMonths = new Set(months);
    if (months.length !== uniqueMonths.size) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate months are not allowed",
        path: ["installments"]
      });
    }
  }
});

type FormValues = z.infer<typeof formSchema>;

export function CreateDebtPlanForm() {
  const t = useTranslations('Debt');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentDebt, setCurrentDebt] = useState(0);
  
  // Generator state
  const [genStartMonth, setGenStartMonth] = useState<string>(
    format(startOfMonth(addMonths(new Date(), 1)), 'yyyy-MM-dd')
  );
  const [genMonths, setGenMonths] = useState<number>(1);

  const initialEmployeeId = searchParams.get('employeeId') || '';

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeId: initialEmployeeId,
      txnType: 'loan',
      txnDate: format(new Date(), 'yyyy-MM-dd'),
      amount: 0,
      hasInstallment: false,
      installments: [],
      otherDesc: '',
      reason: ''
    }
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "installments"
  });

  const hasInstallment = form.watch("hasInstallment");
  const amount = form.watch("amount") as number;
  const installments = form.watch("installments") || [];
  const totalInstallment = installments.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const diff = amount - totalInstallment;

  useEffect(() => {
    fetchEmployees();
    if (initialEmployeeId) {
      fetchCurrentDebt(initialEmployeeId);
    }
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await employeeService.getEmployees({ limit: 100, status: 'active' });
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Failed to fetch employees', error);
    }
  };

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

  const handleEmployeeChange = (value: string) => {
    form.setValue('employeeId', value);
    fetchCurrentDebt(value);
  };

  const generateInstallments = () => {
    if (amount <= 0) {
      window.alert("Please enter a valid amount first");
      return;
    }
    
    if (genMonths < 1) return;

    const startDate = parseISO(genStartMonth);
    const amountPerMonth = Math.floor((amount / genMonths) * 100) / 100;
    let currentSum = 0;
    
    const newInstallments = [];
    
    for (let i = 0; i < genMonths; i++) {
      let itemAmount = amountPerMonth;
      
      // Last month adjustment
      if (i === genMonths - 1) {
        itemAmount = Number((amount - currentSum).toFixed(2));
      }
      
      currentSum += itemAmount;
      
      newInstallments.push({
        amount: itemAmount,
        payrollMonthDate: format(startOfMonth(addMonths(startDate, i)), 'yyyy-MM-dd')
      });
    }
    
    replace(newInstallments);
  };

  const onSubmit = async (data: FormValues) => {
    try {
      const result = await debtService.createDebtPlan({
        employeeId: data.employeeId,
        txnType: data.txnType,
        otherDesc: data.otherDesc,
        txnDate: data.txnDate,
        amount: data.amount,
        reason: data.reason,
        installments: data.hasInstallment && data.installments ? data.installments : []
      });
      
      if (user?.role === 'admin') {
        router.push(`/${locale}/debt/${result.id}`);
      } else {
        router.push(`/${locale}/debt?employeeId=${data.employeeId}`);
      }
    } catch (error: any) {
      console.error(error);
      const errorMessage = error.response?.data?.message || tCommon('error');
      window.alert(errorMessage);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/${locale}/debt${initialEmployeeId ? `?employeeId=${initialEmployeeId}` : ''}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{t('create.title')}</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>{t('detailTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem className="col-span-2 md:col-span-1">
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

              <div className="col-span-2 md:col-span-1 bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">{t('fields.currentOutstanding')}</span>
                  <span className="text-sm font-bold">{currentDebt.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">{t('fields.newOutstanding')}</span>
                  <span className="text-lg font-bold text-blue-600">
                    {(currentDebt + (Number(amount) || 0)).toLocaleString()}
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
                name="txnType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.txnType')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="loan">{t('types.loan')}</SelectItem>
                        <SelectItem value="other">{t('types.other')}</SelectItem>
                      </SelectContent>
                    </Select>
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

              {form.watch('txnType') === 'other' && (
                <FormField
                  control={form.control}
                  name="otherDesc"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>{t('fields.otherDesc')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>{t('fields.reason')}</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>{t('create.hasInstallment')}</CardTitle>
              <FormField
                control={form.control}
                name="hasInstallment"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardHeader>
            {hasInstallment && (
              <CardContent className="space-y-6 pt-6">
                <div className="bg-slate-50 p-4 rounded-lg border space-y-4">
                  <h3 className="font-medium text-sm text-slate-900 flex items-center gap-2">
                    <Calculator className="w-4 h-4" />
                    {t('create.autoGenerate')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t('create.startMonth')}</label>
                      <MonthPicker 
                        value={genStartMonth} 
                        onValueChange={setGenStartMonth}
                        placeholder={t('create.startMonth')}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t('create.months')}</label>
                      <Input 
                        type="number" 
                        min={1} 
                        value={genMonths} 
                        onChange={(e) => setGenMonths(parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <Button type="button" onClick={generateInstallments} variant="secondary">
                      {t('create.generate')}
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">{t('fields.installments')}</h3>

                  {fields.map((field, index) => (
                    <div key={field.id} className="flex gap-4 items-start">
                      <FormField
                        control={form.control}
                        name={`installments.${index}.payrollMonthDate`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <MonthPicker
                                value={field.value}
                                onValueChange={field.onChange}
                                placeholder={t('fields.month') || "Select Month"}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`installments.${index}.amount`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input type="number" step="0.01" {...field} value={field.value as number} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-1"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))}

                  {fields.length > 0 && (
                    <div className="flex justify-end gap-8 pt-4 border-t">
                      <div className="text-sm">
                        <span className="text-gray-500">{t('create.totalInstallment')}:</span>
                        <span className={cn("ml-2 font-medium", Math.abs(diff) > 0.01 ? "text-red-600" : "text-green-600")}>
                          {totalInstallment.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500">{t('create.diff')}:</span>
                        <span className={cn("ml-2 font-medium", Math.abs(diff) > 0.01 ? "text-red-600" : "text-green-600")}>
                          {diff.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <FormField
                    control={form.control}
                    name="installments"
                    render={() => <FormMessage />}
                  />
                </div>
              </CardContent>
            )}
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => router.push(`/${locale}/debt${initialEmployeeId ? `?employeeId=${initialEmployeeId}` : ''}`)}>
              {tCommon('cancel')}
            </Button>
            <Button 
              type="submit"
              disabled={hasInstallment && Math.abs(diff) > 0.01}
              title={hasInstallment && Math.abs(diff) > 0.01 ? t('create.mustMatchAmount') : ''}
            >
              {tCommon('save')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
