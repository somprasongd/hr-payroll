'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Loader2, AlertCircle, Upload, X, User } from 'lucide-react';

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

import { Employee, CreateEmployeeRequest, UpdateEmployeeRequest, employeeService } from '@/services/employee.service';
import { masterDataService, AllMasterData } from '@/services/master-data.service';
import { AccumulationView } from './accumulation-view';
import { DocumentTab } from './document-tab';



interface EmployeeFormProps {
  initialData?: Employee;
  onSubmit: (data: CreateEmployeeRequest | UpdateEmployeeRequest) => Promise<void>;
  isEditing?: boolean;
  defaultTab?: string;
}

    export function EmployeeForm({ initialData, onSubmit, isEditing = false, defaultTab = 'personal' }: EmployeeFormProps) {
  const t = useTranslations('Employees');
  const tAccum = useTranslations('Accumulation');
  const tDocs = useTranslations('Documents');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const [masterData, setMasterData] = useState<AllMasterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(defaultTab);
  
  // Refs for auto-focus
  const employmentInputRef = React.useRef<HTMLInputElement>(null);
  const financialInputRef = React.useRef<HTMLInputElement>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  
  // Photo upload state
  const [photoId, setPhotoId] = useState<string>(initialData?.photoId || '');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  // Load existing photo preview
  React.useEffect(() => {
    if (initialData?.photoId) {
      employeeService.fetchPhotoWithCache(initialData.photoId).then(setPhotoPreview);
    }
  }, [initialData?.photoId]);

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
    departmentId: z.string().optional(),
    positionId: z.string().optional(),
    employmentStartDate: z.string().min(1, t('validation.required')),
    employmentEndDate: z.string().optional().nullable(),
    
    // Financial Info
    basePayAmount: z.coerce.number().gt(0, t('validation.positive')),
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
      departmentId: initialData?.departmentId || '',
      positionId: initialData?.positionId || '',
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

  // Photo upload handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      setSubmitError(t('photoUploadError') + ' (max 2MB)');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setSubmitError(t('photoUploadError') + ' (image only)');
      return;
    }

    setUploadingPhoto(true);
    setSubmitError(null);

    try {
      const response = await employeeService.uploadPhoto(file);
      setPhotoId(response.id);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      const apiError = err as Error;
      setSubmitError(apiError.message || t('photoUploadError'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoId('');
    setPhotoPreview(null);
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
  };

  const handleSubmit = async (data: EmployeeFormValues) => {
    setLoading(true);
    setSubmitError(null);
    try {
      // Transform data: convert percentage to decimal for API
      const transformedData = {
        ...data,
        photoId: photoId || undefined,
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
  const [payrollConfig, setPayrollConfig] = useState<any>(null);
  // Track if we've already auto-filled the hourly rate for part-time
  const hasAutoFilledHourlyRate = React.useRef(false);
  // Track the last employee type to detect changes
  const lastEmployeeTypeRef = React.useRef<string | null>(null);

  useEffect(() => {
    // Skip if already fetched
    if (payrollConfig) return;
    
    const fetchConfig = async () => {
      try {
        const config = await import('@/services/payroll-config.service').then(m => m.payrollConfigService.getEffective());
        setPayrollConfig(config);
      } catch (error) {
        console.error('Failed to fetch payroll config', error);
      }
    };
    fetchConfig();
  }, [payrollConfig]);

  useEffect(() => {
    if (masterData?.employeeTypes && employeeTypeId && payrollConfig) {
      const selectedType = masterData.employeeTypes.find(t => t.id === employeeTypeId);
      
      // Get the name and code (handle both cases)
      const typeCode = (selectedType?.code || selectedType?.Code || '').toLowerCase();
      const typeName = (selectedType?.name || selectedType?.Name || '').toLowerCase();
      
      // Check if explicitly Part-Time (code 'pt' or name contains 'part', 'พาร์ทไทม์', 'ชั่วคราว')
      const isPartTime = typeCode === 'pt' ||
                         typeName.includes('part') || 
                         typeName.includes('พาร์ท') ||
                         typeName.includes('ชั่วคราว');
      
      // Check if explicitly Full-Time (code 'ft' or name contains 'full' or 'ประจำ')
      const isFullTime = typeCode === 'ft' ||
                         typeName.includes('full') || 
                         typeName.includes('ประจำ');

      // Detect if employee type changed
      const employeeTypeChanged = lastEmployeeTypeRef.current !== employeeTypeId;
      if (employeeTypeChanged) {
        lastEmployeeTypeRef.current = employeeTypeId;
        // Reset auto-fill flag when employee type changes to allow re-fill
        hasAutoFilledHourlyRate.current = false;
      }

      // Auto-fill SSO Declared Wage using the wage cap from config (for full-time only)
      if (ssoContribute && isFullTime) {
        const currentBasePayAmount = form.getValues('basePayAmount');
        const wageCap = payrollConfig.socialSecurityWageCap || 15000;
        const wage = Math.min(currentBasePayAmount || 0, wageCap);
        form.setValue('ssoDeclaredWage', wage);
      }

      // Auto-fill Hourly Wage for Part-Time when:
      // 1. It's a part-time employee
      // 2. We haven't already auto-filled for this selection
      // 3. Current value is 0 or empty
      if (isPartTime && !hasAutoFilledHourlyRate.current) {
        const currentBasePayAmount = form.getValues('basePayAmount');
        console.log('[EmployeeForm] Part-time detected, checking auto-fill:', {
          isPartTime,
          hasAutoFilledHourlyRate: hasAutoFilledHourlyRate.current,
          currentBasePayAmount,
          hourlyRateFromConfig: payrollConfig.hourlyRate,
          typeCode,
          typeName
        });
        if (!currentBasePayAmount || currentBasePayAmount === 0) {
          console.log('[EmployeeForm] Setting basePayAmount to:', payrollConfig.hourlyRate);
          form.setValue('basePayAmount', payrollConfig.hourlyRate);
          hasAutoFilledHourlyRate.current = true;
        }
      }
    }
  }, [ssoContribute, employeeTypeId, masterData, form, payrollConfig]);

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
      } else if (activeTab === 'accumulation' && isEditing) {
        setActiveTab('documents');
      }
    }
  };

  const handleBack = (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (activeTab === 'documents') setActiveTab('accumulation');
    else if (activeTab === 'accumulation') setActiveTab('financial');
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
          <TabsList className={`grid w-full h-auto grid-cols-2 ${isEditing ? 'md:grid-cols-5' : 'md:grid-cols-3'}`}>
            <TabsTrigger value="personal">{t('personalInfo')}</TabsTrigger>
            <TabsTrigger value="employment">{t('employmentInfo')}</TabsTrigger>
            <TabsTrigger value="financial">{t('financialInfo')}</TabsTrigger>
            {isEditing && <TabsTrigger value="accumulation">{tAccum('title')}</TabsTrigger>}
            {isEditing && <TabsTrigger value="documents">{tDocs('tabTitle')}</TabsTrigger>}
          </TabsList>
          
          <TabsContent value="personal">
            <Card>
              <CardHeader>
                <CardTitle>{t('personalInfo')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Photo Upload Section */}
                <div className="space-y-2">
                  <Label>{t('fields.photo')}</Label>
                  <div className="flex items-start gap-4">
                    {photoPreview ? (
                      <div className="relative">
                        <img 
                          src={photoPreview} 
                          alt="Employee Photo" 
                          className="h-24 w-24 object-cover border rounded-lg bg-white"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6"
                          onClick={handleRemovePhoto}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="h-24 w-24 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted">
                        <User className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                        id="photo-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={uploadingPhoto}
                        onClick={() => photoInputRef.current?.click()}
                      >
                        {uploadingPhoto ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            {t('photoUploading')}
                          </>
                        ) : photoPreview ? (
                          t('changePhoto')
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            {t('uploadPhoto')}
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2">{t('photoHint')}</p>
                    </div>
                  </div>
                </div>

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
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="departmentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('fields.department')}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('placeholders.selectDepartment')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {masterData?.departments?.map((item, index) => (
                              <SelectItem key={`${item.id}-${index}`} value={item.id}>
                                {item.name || item.Name || item.code || item.Code || 'Unknown'}
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
                    name="positionId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('fields.position')}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('placeholders.selectPosition')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {masterData?.employeePositions?.map((item, index) => (
                              <SelectItem key={`${item.id}-${index}`} value={item.id}>
                                {item.name || item.Name || item.code || item.Code || 'Unknown'}
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

          {isEditing && initialData?.id && (
            <TabsContent value="documents">
              <DocumentTab employeeId={initialData.id} />
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
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tCommon('save')}
              </Button>
            </>
          ) : activeTab === 'financial' ? (
            <>
              <Button type="button" variant="outline" onClick={handleBack}>
                {t('back')}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tCommon('save')}
              </Button>
            </>
          ) : activeTab === 'accumulation' ? (
            <>
              <Button type="button" variant="outline" onClick={handleBack}>
                {t('back')}
              </Button>
              <Button type="button" onClick={handleNext}>
                {t('next')}
              </Button>
            </>
          ) : activeTab === 'documents' ? (
            <>
              <Button type="button" variant="outline" onClick={handleBack}>
                {t('back')}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={handleBack}>
                {t('back')}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tCommon('save')}
              </Button>
            </>
          )}
        </div>
      </form>
    </Form>
  );
}
