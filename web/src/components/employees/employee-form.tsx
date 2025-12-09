'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Loader2, AlertCircle } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import { Employee, CreateEmployeeRequest, UpdateEmployeeRequest } from '@/services/employee.service';
import { masterDataService, AllMasterData } from '@/services/master-data.service';
import { AccumulationView } from './accumulation-view';



interface EmployeeFormProps {
  initialData?: Employee;
  onSubmit: (data: CreateEmployeeRequest | UpdateEmployeeRequest) => Promise<void>;
  isEditing?: boolean;
  defaultTab?: string;
}

    export function EmployeeForm({ initialData, onSubmit, isEditing = false, defaultTab = 'personal' }: EmployeeFormProps) {
  const t = useTranslations('Employees');
  const tAccum = useTranslations('Accumulation');
  const router = useRouter();
  const [masterData, setMasterData] = useState<AllMasterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(defaultTab);
  
  // Refs for auto-focus
  const employmentInputRef = React.useRef<HTMLInputElement>(null);
  const financialInputRef = React.useRef<HTMLInputElement>(null);

  const employeeSchema = z.object({
    // Personal Info
    titleId: z.string().min(1, t('validation.required')),
    firstName: z.string().min(1, t('validation.required')),
    lastName: z.string().min(1, t('validation.required')),
    idDocumentTypeId: z.string().min(1, t('validation.required')),
    idDocumentNumber: z.string().min(1, t('validation.required')),
    phone: z.string().optional(),
    email: z.string().email(t('validation.email')).optional().or(z.literal('')),
    
    // Employment Info
    employeeNumber: z.string().min(1, t('validation.required')),
    employeeTypeId: z.string().min(1, t('validation.required')),
    employmentStartDate: z.string().min(1, t('validation.required')),
    employmentEndDate: z.string().optional().nullable(),
    
    // Financial Info
    basePayAmount: z.coerce.number().min(0, t('validation.positive')),
    bankName: z.string().optional(),
    bankAccountNo: z.string().optional(),
    
    // Benefits
    ssoContribute: z.boolean().default(false),
    ssoDeclaredWage: z.coerce.number().optional(),
    providentFundContribute: z.boolean().default(false),
    providentFundRateEmployee: z.coerce.number().optional(),
    providentFundRateEmployer: z.coerce.number().optional(),
    withholdTax: z.boolean().default(false),
    
    // Allowances
    allowHousing: z.boolean().default(false),
    allowWater: z.boolean().default(false),
    allowElectric: z.boolean().default(false),
    allowInternet: z.boolean().default(false),
    allowDoctorFee: z.boolean().default(false),
  });

  type EmployeeFormValues = z.infer<typeof employeeSchema>;

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema) as any,
    defaultValues: {
      titleId: initialData?.titleId || '',
      firstName: initialData?.firstName || '',
      lastName: initialData?.lastName || '',
      idDocumentTypeId: initialData?.idDocumentTypeId || '',
      idDocumentNumber: initialData?.idDocumentNumber || '',
      phone: initialData?.phone || '',
      email: initialData?.email || '',
      employeeNumber: initialData?.employeeNumber || '',
      employeeTypeId: initialData?.employeeTypeId || '',
      employmentStartDate: initialData?.employmentStartDate || new Date().toISOString().split('T')[0],
      employmentEndDate: initialData?.employmentEndDate || null,
      basePayAmount: initialData?.basePayAmount || 0,
      bankName: initialData?.bankName || '',
      bankAccountNo: initialData?.bankAccountNo || '',
      ssoContribute: initialData?.ssoContribute || false,
      ssoDeclaredWage: initialData?.ssoDeclaredWage || 0,
      providentFundContribute: initialData?.providentFundContribute || false,
      providentFundRateEmployee: (initialData?.providentFundRateEmployee || 0) * 100,
      providentFundRateEmployer: (initialData?.providentFundRateEmployer || 0) * 100,
      withholdTax: initialData?.withholdTax ?? false,
      allowHousing: initialData?.allowHousing || false,
      allowWater: initialData?.allowWater || false,
      allowElectric: initialData?.allowElectric || false,
      allowInternet: initialData?.allowInternet || false,
      allowDoctorFee: initialData?.allowDoctorFee || false,
    },
  });

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    event.target.select();
  };

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const data = await masterDataService.getAll();
        setMasterData(data);
      } catch (error) {
        console.error('Failed to fetch master data', error);
      }
    };
    fetchMasterData();
  }, []);

  const handleSubmit = async (data: EmployeeFormValues) => {
    setLoading(true);
    setSubmitError(null);
    try {
      // Transform data: convert percentage to decimal for API
      const transformedData = {
        ...data,
        providentFundRateEmployee: data.providentFundRateEmployee ? data.providentFundRateEmployee / 100 : 0,
        providentFundRateEmployer: data.providentFundRateEmployer ? data.providentFundRateEmployer / 100 : 0,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await onSubmit(transformedData as any);
    } catch (error: any) {
      console.error(error);
      const errorMessage = error?.response?.data?.message || error?.message || t('submitError');
      setSubmitError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Watch for changes to auto-fill SSO Declared Wage
  const ssoContribute = form.watch('ssoContribute');
  const basePayAmount = form.watch('basePayAmount');
  const employeeTypeId = form.watch('employeeTypeId');
  const firstName = form.watch('firstName');
  const lastName = form.watch('lastName');
  const employeeNumber = form.watch('employeeNumber');

  // Fetch Payroll Config for default hourly rate
  const [payrollConfig, setPayrollConfig] = useState<any>(null); // Using any to avoid import cycle if type not exported, or just import it.
  // Better to import PayrollConfig. Let's add import first.

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await import('@/services/payroll-config.service').then(m => m.payrollConfigService.getEffective());
        setPayrollConfig(config);
      } catch (error) {
        console.error('Failed to fetch payroll config', error);
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    if (masterData?.employeeTypes && employeeTypeId && payrollConfig) {
      const selectedType = masterData.employeeTypes.find(t => t.id === employeeTypeId);
      
      // Check if explicitly Part-Time (code 'pt' or name contains 'part')
      const isPartTime = selectedType?.code?.toLowerCase() === 'pt' ||
                         selectedType?.Code?.toLowerCase() === 'pt' ||
                         selectedType?.name?.toLowerCase().includes('part') || 
                         selectedType?.Name?.toLowerCase().includes('part');
      
      // Check if explicitly Full-Time (code 'ft' or name contains 'full' or 'ประจำ')
      const isFullTime = selectedType?.code?.toLowerCase() === 'ft' ||
                         selectedType?.Code?.toLowerCase() === 'ft' ||
                         selectedType?.name?.toLowerCase().includes('full') || 
                         selectedType?.Name?.toLowerCase().includes('full') ||
                         selectedType?.name?.includes('ประจำ') || 
                         selectedType?.Name?.includes('ประจำ');

      // Auto-fill SSO Declared Wage using the wage cap from config (for full-time only)
      if (ssoContribute && isFullTime) {
        const wageCap = payrollConfig.socialSecurityWageCap || 15000;
        const wage = Math.min(basePayAmount || 0, wageCap);
        form.setValue('ssoDeclaredWage', wage);
      }

      // Auto-fill Hourly Wage for Part-Time ONLY (not for full-time)
      if (isPartTime && !isFullTime) {
        // Only set if it's 0 (new or unset)
        if (!basePayAmount || basePayAmount === 0) {
             form.setValue('basePayAmount', payrollConfig.hourlyRate);
        }
      }
    }
  }, [ssoContribute, basePayAmount, employeeTypeId, masterData, form, payrollConfig]);

  const handleNext = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    const fieldsToValidate: (keyof EmployeeFormValues)[] = [];
    
    if (activeTab === 'personal') {
      fieldsToValidate.push('titleId', 'firstName', 'lastName', 'idDocumentTypeId', 'idDocumentNumber', 'phone', 'email');
    } else if (activeTab === 'employment') {
      fieldsToValidate.push('employeeNumber', 'employeeTypeId', 'employmentStartDate', 'employmentEndDate');
    }

    const isValid = await form.trigger(fieldsToValidate);
    if (isValid) {
      if (activeTab === 'personal') {
        setActiveTab('employment');
        // Small timeout to allow tab switch to render
        setTimeout(() => {
          employmentInputRef.current?.focus();
        }, 100);

      } else if (activeTab === 'employment') {
        setActiveTab('financial');
        setTimeout(() => {
          financialInputRef.current?.focus();
        }, 100);
      } else if (activeTab === 'financial' && isEditing) {
        setActiveTab('accumulation');
      }
    }
  };

  const handleBack = (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (activeTab === 'accumulation') setActiveTab('financial');
    else if (activeTab === 'financial') setActiveTab('employment');
    else if (activeTab === 'employment') setActiveTab('personal');
  };

  if (!masterData) {
    return <div>Loading master data...</div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        {submitError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {submitError}
            </AlertDescription>
          </Alert>
        )}
        
        {/* Dynamic Header Info */}
        <div className="bg-muted/50 p-4 rounded-lg border mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-muted-foreground">{t('fields.employeeNumber')}:</span>
              <span className="font-medium">{employeeNumber || '-'}</span>
            </div>
            <div className="hidden md:block w-px h-4 bg-border" />
            <div className="flex items-center gap-2">
              <span className="font-semibold text-muted-foreground">{t('fields.firstName')} - {t('fields.lastName')}:</span>
              <span className="font-medium">
                {firstName || '-'} {lastName || ''}
              </span>
            </div>
            <div className="hidden md:block w-px h-4 bg-border" />
            <div className="flex items-center gap-2">
              <span className="font-semibold text-muted-foreground">{t('fields.employeeType')}:</span>
              <span className="font-medium">
                {masterData?.employeeTypes?.find(t => t.id === employeeTypeId)?.name || 
                 masterData?.employeeTypes?.find(t => t.id === employeeTypeId)?.Name || '-'}
              </span>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full h-auto grid-cols-2 ${isEditing ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
            <TabsTrigger value="personal">{t('personalInfo')}</TabsTrigger>
            <TabsTrigger value="employment">{t('employmentInfo')}</TabsTrigger>
            <TabsTrigger value="financial">{t('financialInfo')}</TabsTrigger>
            {isEditing && <TabsTrigger value="accumulation">{tAccum('title')}</TabsTrigger>}
          </TabsList>
          
          <TabsContent value="personal">
            <Card>
              <CardHeader>
                <CardTitle>{t('personalInfo')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  <div className="md:col-span-2">
                    <FormField
                      control={form.control}
                      name="titleId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('fields.title')}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('placeholders.selectTitle')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {masterData.personTitles?.map((item, index) => (
                                <SelectItem key={`${item.id}-${index}`} value={item.id}>
                                  {item.name || item.Name || item.code || item.Code || item.id || item.ID || 'Unknown'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="md:col-span-5">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('fields.firstName')}</FormLabel>
                          <FormControl>
                            <Input {...field} onFocus={handleFocus} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="md:col-span-5">
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('fields.lastName')}</FormLabel>
                          <FormControl>
                            <Input {...field} onFocus={handleFocus} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="idDocumentTypeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('fields.idCardType')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('placeholders.selectType')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {masterData.idDocumentTypes?.map((item, index) => (
                              <SelectItem key={`${item.id}-${index}`} value={item.id}>
                                {item.name || item.Name || item.code || item.Code || item.id || item.ID || 'Unknown'}
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
                    name="idDocumentNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('fields.idCardNumber')}</FormLabel>
                        <FormControl>
                          <Input {...field} onFocus={handleFocus} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('fields.phone')}</FormLabel>
                        <FormControl>
                          <Input {...field} type="tel" onFocus={handleFocus} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('fields.email')}</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" onFocus={handleFocus} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="employment">
            <Card>
              <CardHeader>
                <CardTitle>{t('employmentInfo')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="employeeNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('fields.employeeNumber')}</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={isEditing} onFocus={handleFocus} ref={(e) => {
                            field.ref(e);
                            if (activeTab === 'employment') {
                                // @ts-ignore
                                employmentInputRef.current = e;
                            }
                          }} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="employeeTypeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('fields.employeeType')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('placeholders.selectType')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {masterData.employeeTypes?.map((item, index) => (
                              <SelectItem key={`${item.id}-${index}`} value={item.id}>
                                {item.name || item.Name || item.code || item.Code || item.id || item.ID || 'Unknown'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="employmentStartDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('fields.startDate')}</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" onFocus={handleFocus} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="employmentEndDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('fields.endDate')}</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} type="date" onFocus={handleFocus} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financial">
            <Card>
              <CardHeader>
                <CardTitle>{t('financialInfo')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="basePayAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('fields.basePay')}</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" onFocus={handleFocus} ref={(e) => {
                            field.ref(e);
                            if (activeTab === 'financial') {
                                // @ts-ignore
                                financialInputRef.current = e;
                            }
                          }} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bankName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('fields.bank')}</FormLabel>
                        <FormControl>
                          <Input {...field} onFocus={handleFocus} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bankAccountNo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('fields.accountNo')}</FormLabel>
                        <FormControl>
                          <Input {...field} onFocus={handleFocus} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">Social Security & Tax</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="ssoContribute"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>{t('fields.sso')}</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="ssoDeclaredWage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('fields.ssoWage')}</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" step="0.01" disabled={!form.watch('ssoContribute')} onFocus={handleFocus} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="withholdTax"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>{t('fields.tax')}</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">Provident Fund</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                      control={form.control}
                      name="providentFundContribute"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>{t('fields.pvd')}</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="providentFundRateEmployee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('fields.pvdRateEmployee')}</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" step="0.01" disabled={!form.watch('providentFundContribute')} onFocus={handleFocus} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="providentFundRateEmployer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('fields.pvdRateEmployer')}</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" step="0.01" disabled={!form.watch('providentFundContribute')} onFocus={handleFocus} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">{t('fields.allowances')}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <FormField
                      control={form.control}
                      name="allowHousing"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="font-normal">{t('fields.housing')}</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="allowDoctorFee"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="font-normal">{t('fields.doctorFee')}</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <h3 className="font-medium">{t('fields.utilities')}</h3>
                    <p className="text-sm text-muted-foreground">{t('fields.utilitiesHint')}</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <FormField
                      control={form.control}
                      name="allowWater"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="font-normal">{t('fields.water')}</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="allowElectric"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="font-normal">{t('fields.electric')}</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="allowInternet"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="font-normal">{t('fields.internet')}</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {isEditing && initialData?.id && (
            <TabsContent value="accumulation">
              <AccumulationView employeeId={initialData.id} />
            </TabsContent>
          )}
        </Tabs>

        <div className="flex justify-end space-x-4">
          {activeTab === 'personal' ? (
            <>
              <Button type="button" variant="outline" onClick={() => router.push('/employees')}>
                {t('cancel')}
              </Button>
              <Button type="button" onClick={handleNext}>
                {t('next')}
              </Button>
            </>
          ) : activeTab === 'employment' ? (
            <>
              <Button type="button" variant="outline" onClick={handleBack}>
                {t('back')}
              </Button>
              <Button type="button" onClick={handleNext}>
                {t('next')}
              </Button>
            </>
          ) : activeTab === 'financial' && isEditing ? (
            <>
              <Button type="button" variant="outline" onClick={handleBack}>
                {t('back')}
              </Button>
              <Button type="button" onClick={handleNext}>
                {t('next')}
              </Button>
            </>
          ) : activeTab === 'accumulation' ? (
            <>
              <Button type="button" variant="outline" onClick={handleBack}>
                {t('back')}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? t('messages.updateSuccess') : t('createButton')}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={handleBack}>
                {t('back')}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? t('messages.updateSuccess') : t('createButton')}
              </Button>
            </>
          )}
        </div>
      </form>
    </Form>
  );
}
