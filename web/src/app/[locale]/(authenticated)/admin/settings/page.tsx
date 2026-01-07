'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { payrollConfigService, type PayrollConfig, type TaxProgressiveBracket } from "@/services/payroll-config.service";
import { ApiError } from "@/lib/api-client";
import { 
  Save, 
  Plus, 
  History, 
  Loader2,
  Info,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { DismissibleAlert } from "@/components/ui/dismissible-alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

// Default Thai progressive tax brackets (rate in percentage for form display)
// min = previous max + 1 (except first row which starts at 0)
const DEFAULT_TAX_BRACKETS: TaxProgressiveBracket[] = [
  { min: 0, max: 150000, rate: 0 },
  { min: 150001, max: 300000, rate: 5 },
  { min: 300001, max: 500000, rate: 10 },
  { min: 500001, max: 750000, rate: 15 },
  { min: 750001, max: 1000000, rate: 20 },
  { min: 1000001, max: 2000000, rate: 25 },
  { min: 2000001, max: 5000000, rate: 30 },
  { min: 5000001, max: null, rate: 35 },
];

// Helper: Get first day of current month as YYYY-MM-DD
const getFirstDayOfCurrentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
};

interface ConfigFormData {
  startDate: string;
  hourlyRate: number;
  otHourlyRate: number;
  attendanceBonusNoLate: number;
  attendanceBonusNoLeave: number;
  housingAllowance: number;
  waterRatePerUnit: number;
  electricityRatePerUnit: number;
  internetFeeMonthly: number;
  socialSecurityRateEmployee: number; // Displayed as percentage (e.g., 5 for 5%)
  socialSecurityRateEmployer: number; // Displayed as percentage (e.g., 5 for 5%)
  socialSecurityWageCap: number;
  // Tax config for Section 40(1) - Regular employees
  taxApplyStandardExpense: boolean;
  taxStandardExpenseRate: number; // Displayed as percentage (e.g., 50 for 50%)
  taxStandardExpenseCap: number;
  taxApplyPersonalAllowance: boolean;
  taxPersonalAllowanceAmount: number;
  taxProgressiveBrackets: TaxProgressiveBracket[];
  // Tax config for Section 40(2) - Freelance/Contract workers
  withholdingTaxRateService: number; // Displayed as percentage (e.g., 3 for 3%)
  // Leave/Late deduction calculation
  workHoursPerDay: number; // Hours per day (e.g., 8)
  lateRatePerMinute: number; // Rate per minute in baht (e.g., 5)
  lateGraceMinutes: number; // Grace period in minutes (e.g., 15)
  note: string;
}

export default function SettingsPage() {
  const t = useTranslations('Settings');
  // Refs for first input of each tab
  const ratesFirstInputRef = useRef<HTMLInputElement>(null);
  const bonusesFirstInputRef = useRef<HTMLInputElement>(null);
  const utilitiesFirstInputRef = useRef<HTMLInputElement>(null);
  const socialFirstInputRef = useRef<HTMLInputElement>(null);
  const taxFirstInputRef = useRef<HTMLInputElement>(null);
  const [activeConfig, setActiveConfig] = useState<PayrollConfig | null>(null);
  const [configHistory, setConfigHistory] = useState<PayrollConfig[]>([]);
  const [formData, setFormData] = useState<ConfigFormData>({
    startDate: getFirstDayOfCurrentMonth(),
    hourlyRate: 0,
    otHourlyRate: 0,
    attendanceBonusNoLate: 0,
    attendanceBonusNoLeave: 0,
    housingAllowance: 0,
    waterRatePerUnit: 0,
    electricityRatePerUnit: 0,
    internetFeeMonthly: 0,
    socialSecurityRateEmployee: 5, // Default 5%
    socialSecurityRateEmployer: 5, // Default 5%
    socialSecurityWageCap: 17500,
    // Tax defaults for Section 40(1)
    taxApplyStandardExpense: true,
    taxStandardExpenseRate: 50, // 50%
    taxStandardExpenseCap: 100000,
    taxApplyPersonalAllowance: true,
    taxPersonalAllowanceAmount: 60000,
    taxProgressiveBrackets: DEFAULT_TAX_BRACKETS,
    // Tax defaults for Section 40(2)
    withholdingTaxRateService: 3, // 3%
    // Leave/Late defaults
    workHoursPerDay: 8,
    lateRatePerMinute: 5,
    lateGraceMinutes: 15,
    note: '',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState('rates');



  const handleNext = () => {
    if (activeTab === 'rates') setActiveTab('bonuses');
    else if (activeTab === 'bonuses') setActiveTab('utilities');
    else if (activeTab === 'utilities') setActiveTab('social');
    else if (activeTab === 'social') setActiveTab('tax');
  };

  const handleBack = () => {
    if (activeTab === 'bonuses') setActiveTab('rates');
    else if (activeTab === 'utilities') setActiveTab('bonuses');
    else if (activeTab === 'social') setActiveTab('utilities');
    else if (activeTab === 'tax') setActiveTab('social');
  };

  // Fetch effective config
  const fetchEffectiveConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await payrollConfigService.getEffective();
      setActiveConfig(data);
      
      // Load data into form (convert decimal to percentage for social security and tax rates)
      setFormData({
        startDate: data.startDate || getFirstDayOfCurrentMonth(),
        hourlyRate: data.hourlyRate || 0,
        otHourlyRate: data.otHourlyRate || 0,
        attendanceBonusNoLate: data.attendanceBonusNoLate || 0,
        attendanceBonusNoLeave: data.attendanceBonusNoLeave || 0,
        housingAllowance: data.housingAllowance || 0,
        waterRatePerUnit: data.waterRatePerUnit || 0,
        electricityRatePerUnit: data.electricityRatePerUnit || 0,
        internetFeeMonthly: data.internetFeeMonthly || 0,
        socialSecurityRateEmployee: (data.socialSecurityRateEmployee || 0.05) * 100, // Convert to %
        socialSecurityRateEmployer: (data.socialSecurityRateEmployer || 0.05) * 100, // Convert to %
        socialSecurityWageCap: data.socialSecurityWageCap || 17500,
        // Tax config for Section 40(1)
        taxApplyStandardExpense: data.taxApplyStandardExpense ?? true,
        taxStandardExpenseRate: (data.taxStandardExpenseRate ?? 0.5) * 100, // Convert to %
        taxStandardExpenseCap: data.taxStandardExpenseCap ?? 100000,
        taxApplyPersonalAllowance: data.taxApplyPersonalAllowance ?? true,
        taxPersonalAllowanceAmount: data.taxPersonalAllowanceAmount ?? 60000,
        taxProgressiveBrackets: data.taxProgressiveBrackets?.length > 0 
          ? data.taxProgressiveBrackets.map(b => ({ ...b, rate: b.rate * 100 })) // Convert rate to %
          : DEFAULT_TAX_BRACKETS,
        // Tax config for Section 40(2)
        withholdingTaxRateService: (data.withholdingTaxRateService ?? 0.03) * 100, // Convert to %
        // Leave/Late deduction calculation
        workHoursPerDay: data.workHoursPerDay ?? 8,
        lateRatePerMinute: data.lateRatePerMinute ?? 5,
        lateGraceMinutes: data.lateGraceMinutes ?? 15,
        note: data.note || '',
      });
    } catch (err) {
      const apiError = err as ApiError;
      // Handle 404 - no config found yet
      if (apiError.statusCode === 404) {
        setActiveConfig(null);
      } else {
        setError(apiError.message || 'Failed to fetch configuration');
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch configuration history
  const fetchConfigHistory = async () => {
    try {
      const response = await payrollConfigService.getAll();
      setConfigHistory(response.data || []);
    } catch (err) {
      console.error('Error fetching config history:', err);
    }
  };

  // Validate tax brackets: min should equal previous max + 1, and max > min
  const validateTaxBrackets = (): string | null => {
    const brackets = formData.taxProgressiveBrackets;
    
    for (let i = 0; i < brackets.length; i++) {
      const bracket = brackets[i];
      
      // Validate max > min (except for last row where max can be null)
      if (bracket.max !== null && bracket.max <= bracket.min) {
        return t('taxBracketValidation.maxLessThanMin', { 
          row: i + 1, 
          min: bracket.min, 
          max: bracket.max 
        });
      }
      
      // Validate min = prev max + 1 (skip first row)
      if (i > 0) {
        const prevMax = brackets[i - 1].max;
        
        if (prevMax === null) {
          return t('taxBracketValidation.prevMaxNull', { row: i });
        }
        
        if (bracket.min !== prevMax + 1) {
          return t('taxBracketValidation.minMismatch', { 
            row: i + 1, 
            expected: prevMax + 1, 
            actual: bracket.min
          });
        }
      }
    }
    return null;
  };

  // Save configuration
  const handleSaveConfig = async () => {
    setError(null);
    setSuccess(null);

    // Validate tax brackets before saving
    const bracketError = validateTaxBrackets();
    if (bracketError) {
      setError(bracketError);
      setActiveTab('tax'); // Switch to tax tab to show the error
      return;
    }

    setSaving(true);

    try {
      // Convert percentage to decimal for API
      const apiPayload = {
        ...formData,
        socialSecurityRateEmployee: formData.socialSecurityRateEmployee / 100,
        socialSecurityRateEmployer: formData.socialSecurityRateEmployer / 100,
        socialSecurityWageCap: formData.socialSecurityWageCap,
        // Tax config - convert percentages to decimals
        taxApplyStandardExpense: formData.taxApplyStandardExpense,
        taxStandardExpenseRate: formData.taxStandardExpenseRate / 100,
        taxStandardExpenseCap: formData.taxStandardExpenseCap,
        taxApplyPersonalAllowance: formData.taxApplyPersonalAllowance,
        taxPersonalAllowanceAmount: formData.taxPersonalAllowanceAmount,
        taxProgressiveBrackets: formData.taxProgressiveBrackets.map(b => ({
          ...b,
          rate: b.rate / 100 // Convert rate from % to decimal
        })),
        withholdingTaxRateService: formData.withholdingTaxRateService / 100,
        // Leave/Late deduction - keep as is (not percentage)
        workHoursPerDay: formData.workHoursPerDay,
        lateRatePerMinute: formData.lateRatePerMinute,
        lateGraceMinutes: formData.lateGraceMinutes,
      };

      const result = await payrollConfigService.create(apiPayload);
      setSuccess(t('saveSuccess'));
      
      // Refresh data
      await fetchEffectiveConfig();
      await fetchConfigHistory();
      
      // Clear success message after 3 seconds (handled by auto-dismiss)
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  // Handle form input changes
  const handleInputChange = (field: keyof ConfigFormData, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  // Handle tax bracket changes
  const handleBracketChange = (index: number, field: 'min' | 'max' | 'rate', value: number | null) => {
    setFormData(prev => {
      const newBrackets = [...prev.taxProgressiveBrackets];
      newBrackets[index] = { ...newBrackets[index], [field]: value };
      
      // When max is changed, auto-update the next row's min to max + 1
      if (field === 'max' && value !== null && index < newBrackets.length - 1) {
        newBrackets[index + 1] = { ...newBrackets[index + 1], min: value + 1 };
      }
      
      return { ...prev, taxProgressiveBrackets: newBrackets };
    });
  };

  // Add new tax bracket
  const addTaxBracket = () => {
    setFormData(prev => {
      const lastBracket = prev.taxProgressiveBrackets[prev.taxProgressiveBrackets.length - 1];
      // newMin = lastMax + 1, or 0 if no last bracket
      const newMin = lastBracket?.max !== null ? (lastBracket.max + 1) : 0;
      return {
        ...prev,
        taxProgressiveBrackets: [
          ...prev.taxProgressiveBrackets,
          { min: newMin, max: null, rate: 0 }
        ]
      };
    });
  };

  // Remove tax bracket
  const removeTaxBracket = (index: number) => {
    setFormData(prev => ({
      ...prev,
      taxProgressiveBrackets: prev.taxProgressiveBrackets.filter((_, i) => i !== index)
    }));
  };

  // Handle input focus to select all text
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  // Fetch data on mount
  useEffect(() => {
    fetchEffectiveConfig();
    fetchConfigHistory();
  }, []);

  // Auto-focus first input when tab changes
  useEffect(() => {
    // Use setTimeout to ensure the tab content is rendered
    const timeoutId = setTimeout(() => {
      switch (activeTab) {
        case 'rates':
          ratesFirstInputRef.current?.focus();
          break;
        case 'bonuses':
          bonusesFirstInputRef.current?.focus();
          break;
        case 'utilities':
          utilitiesFirstInputRef.current?.focus();
          break;
        case 'social':
          socialFirstInputRef.current?.focus();
          break;
        case 'tax':
          taxFirstInputRef.current?.focus();
          break;
      }
    }, 50);
    return () => clearTimeout(timeoutId);
  }, [activeTab]);

  if (loading && !activeConfig) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {t('title')}
          </h1>
          <p className="text-sm text-gray-600 mt-1 hidden sm:block">
            {t('description')}
          </p>
        </div>
        <Dialog open={showHistory} onOpenChange={setShowHistory}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">{t('viewHistory')}</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('configurationHistory')}</DialogTitle>
              <DialogDescription>
                {t('historyDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('version')}</TableHead>
                    <TableHead>{t('startDate')}</TableHead>
                    <TableHead>{t('endDate')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead>{t('note')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configHistory.map((config) => (
                    <TableRow key={config.id}>
                      <TableCell className="font-medium">v{config.versionNo}</TableCell>
                      <TableCell>{config.startDate}</TableCell>
                      <TableCell>{config.endDate || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={config.status === 'active' ? 'default' : 'secondary'}>
                          {config.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{config.note || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Alerts */}
      {error && (
        <DismissibleAlert
          variant="error"
          title={t('error')}
          onDismiss={() => setError(null)}
          autoDismiss={false}
        >
          {error}
        </DismissibleAlert>
      )}

      {success && (
        <DismissibleAlert
          variant="success"
          title={t('success')}
          onDismiss={() => setSuccess(null)}
        >
          {success}
        </DismissibleAlert>
      )}

      {/* Current Active Config Info */}
      {activeConfig && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>{t('currentConfig')}</AlertTitle>
          <AlertDescription>
            {t('currentConfigDescription', { 
              version: activeConfig.versionNo, 
              startDate: activeConfig.startDate 
            })}
          </AlertDescription>
        </Alert>
      )}

      {/* Configuration Form */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-5 h-auto">
          <TabsTrigger value="rates">{t('rates')}</TabsTrigger>
          <TabsTrigger value="bonuses">{t('bonuses')}</TabsTrigger>
          <TabsTrigger value="utilities">{t('utilities')}</TabsTrigger>
          <TabsTrigger value="social">{t('socialSecurity')}</TabsTrigger>
          <TabsTrigger value="tax">{t('tax')}</TabsTrigger>
        </TabsList>

        {/* Rates Tab */}
        <TabsContent value="rates" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('wageRates')}</CardTitle>
              <CardDescription>{t('wageRatesDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hourlyRate">{t('hourlyRate')}</Label>
                <Input
                  ref={ratesFirstInputRef}
                  id="hourlyRate"
                  type="number"
                  step="0.01"
                  value={formData.hourlyRate}
                  onChange={(e) => handleInputChange('hourlyRate', parseFloat(e.target.value) || 0)}
                  onFocus={handleInputFocus}
                  placeholder="400.00"
                />
                <p className="text-xs text-gray-500">{t('hourlyRateHint')}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="otHourlyRate">{t('otHourlyRate')}</Label>
                <Input
                  id="otHourlyRate"
                  type="number"
                  step="0.01"
                  value={formData.otHourlyRate}
                  onChange={(e) => handleInputChange('otHourlyRate', parseFloat(e.target.value) || 0)}
                  onFocus={handleInputFocus}
                  placeholder="600.00"
                />
                <p className="text-xs text-gray-500">{t('otHourlyRateHint')}</p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="startDate">{t('effectiveDate')}</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                  onFocus={handleInputFocus}
                />
                <p className="text-xs text-gray-500">{t('effectiveDateHint')}</p>
              </div>
            </CardContent>
          </Card>

          {/* Leave/Late Deduction Settings */}
          <Card>
            <CardHeader>
              <CardTitle>{t('leaveDeductionSettings')}</CardTitle>
              <CardDescription>{t('leaveDeductionSettingsDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="workHoursPerDay">{t('workHoursPerDay')}</Label>
                <Input
                  id="workHoursPerDay"
                  type="number"
                  step="0.5"
                  min="1"
                  max="24"
                  value={formData.workHoursPerDay}
                  onChange={(e) => handleInputChange('workHoursPerDay', parseFloat(e.target.value) || 8)}
                  onFocus={handleInputFocus}
                  placeholder="8"
                />
                <p className="text-xs text-gray-500">{t('workHoursPerDayHint')}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lateRatePerMinute">{t('lateRatePerMinute')}</Label>
                <Input
                  id="lateRatePerMinute"
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.lateRatePerMinute}
                  onChange={(e) => handleInputChange('lateRatePerMinute', parseFloat(e.target.value) || 0)}
                  onFocus={handleInputFocus}
                  placeholder="5"
                />
                <p className="text-xs text-gray-500">{t('lateRatePerMinuteHint')}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lateGraceMinutes">{t('lateGraceMinutes')}</Label>
                <Input
                  id="lateGraceMinutes"
                  type="number"
                  step="1"
                  min="0"
                  value={formData.lateGraceMinutes}
                  onChange={(e) => handleInputChange('lateGraceMinutes', parseInt(e.target.value) || 0)}
                  onFocus={handleInputFocus}
                  placeholder="15"
                />
                <p className="text-xs text-gray-500">{t('lateGraceMinutesHint')}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bonuses Tab */}
        <TabsContent value="bonuses" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('attendanceBonuses')}</CardTitle>
              <CardDescription>{t('attendanceBonusesDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="attendanceBonusNoLate">{t('bonusNoLate')}</Label>
                <Input
                  ref={bonusesFirstInputRef}
                  id="attendanceBonusNoLate"
                  type="number"
                  step="0.01"
                  value={formData.attendanceBonusNoLate}
                  onChange={(e) => handleInputChange('attendanceBonusNoLate', parseFloat(e.target.value) || 0)}
                  onFocus={handleInputFocus}
                  placeholder="500.00"
                />
                <p className="text-xs text-gray-500">{t('bonusNoLateHint')}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="attendanceBonusNoLeave">{t('bonusNoLeave')}</Label>
                <Input
                  id="attendanceBonusNoLeave"
                  type="number"
                  step="0.01"
                  value={formData.attendanceBonusNoLeave}
                  onChange={(e) => handleInputChange('attendanceBonusNoLeave', parseFloat(e.target.value) || 0)}
                  onFocus={handleInputFocus}
                  placeholder="1000.00"
                />
                <p className="text-xs text-gray-500">{t('bonusNoLeaveHint')}</p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="housingAllowance">{t('housingAllowance')}</Label>
                <Input
                  id="housingAllowance"
                  type="number"
                  step="0.01"
                  value={formData.housingAllowance}
                  onChange={(e) => handleInputChange('housingAllowance', parseFloat(e.target.value) || 0)}
                  onFocus={handleInputFocus}
                  placeholder="1000.00"
                />
                <p className="text-xs text-gray-500">{t('housingAllowanceHint')}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Utilities Tab */}
        <TabsContent value="utilities" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('utilityRates')}</CardTitle>
              <CardDescription>{t('utilityRatesDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="waterRatePerUnit">{t('waterRate')}</Label>
                <Input
                  ref={utilitiesFirstInputRef}
                  id="waterRatePerUnit"
                  type="number"
                  step="0.01"
                  value={formData.waterRatePerUnit}
                  onChange={(e) => handleInputChange('waterRatePerUnit', parseFloat(e.target.value) || 0)}
                  onFocus={handleInputFocus}
                  placeholder="10.00"
                />
                <p className="text-xs text-gray-500">{t('waterRateHint')}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="electricityRatePerUnit">{t('electricityRate')}</Label>
                <Input
                  id="electricityRatePerUnit"
                  type="number"
                  step="0.01"
                  value={formData.electricityRatePerUnit}
                  onChange={(e) => handleInputChange('electricityRatePerUnit', parseFloat(e.target.value) || 0)}
                  onFocus={handleInputFocus}
                  placeholder="7.00"
                />
                <p className="text-xs text-gray-500">{t('electricityRateHint')}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="internetFeeMonthly">{t('internetFee')}</Label>
                <Input
                  id="internetFeeMonthly"
                  type="number"
                  step="0.01"
                  value={formData.internetFeeMonthly}
                  onChange={(e) => handleInputChange('internetFeeMonthly', parseFloat(e.target.value) || 0)}
                  onFocus={handleInputFocus}
                  placeholder="100.00"
                />
                <p className="text-xs text-gray-500">{t('internetFeeHint')}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Social Security Tab */}
        <TabsContent value="social" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('socialSecurityRates')}</CardTitle>
              <CardDescription>{t('socialSecurityRatesDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="socialSecurityRateEmployee">{t('employeeRate')}</Label>
                <div className="relative">
                  <Input
                    ref={socialFirstInputRef}
                    id="socialSecurityRateEmployee"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.socialSecurityRateEmployee}
                    onChange={(e) => handleInputChange('socialSecurityRateEmployee', parseFloat(e.target.value) || 0)}
                    onFocus={handleInputFocus}
                    placeholder="5"
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                </div>
                <p className="text-xs text-gray-500">{t('employeeRateHint')}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="socialSecurityRateEmployer">{t('employerRate')}</Label>
                <div className="relative">
                  <Input
                    id="socialSecurityRateEmployer"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.socialSecurityRateEmployer}
                    onChange={(e) => handleInputChange('socialSecurityRateEmployer', parseFloat(e.target.value) || 0)}
                    onFocus={handleInputFocus}
                    placeholder="5"
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                </div>
                <p className="text-xs text-gray-500">{t('employerRateHint')}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="socialSecurityWageCap">{t('ssoWageCap')}</Label>
                <Input
                  id="socialSecurityWageCap"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.socialSecurityWageCap}
                  onChange={(e) => handleInputChange('socialSecurityWageCap', parseFloat(e.target.value) || 0)}
                  onFocus={handleInputFocus}
                  placeholder="17500.00"
                />
                <p className="text-xs text-gray-500">{t('ssoWageCapHint')}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tax Configuration Tab */}
        <TabsContent value="tax" className="space-y-4 mt-6">
          {/* Section 40(1) - Regular Employees */}
          <Card>
            <CardHeader>
              <CardTitle>{t('taxSection40_1Title')}</CardTitle>
              <CardDescription>{t('taxSection40_1Description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Standard Expense Deduction */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label className="font-medium">{t('taxApplyStandardExpense')}</Label>
                  <p className="text-xs text-gray-500">{t('taxApplyStandardExpenseHint')}</p>
                </div>
                <Switch
                  checked={formData.taxApplyStandardExpense}
                  onCheckedChange={(checked: boolean) => handleInputChange('taxApplyStandardExpense', checked)}
                />
              </div>

              {formData.taxApplyStandardExpense && (
                <div className="grid gap-4 md:grid-cols-2 pl-4 border-l-2 border-blue-200">
                  <div className="space-y-2">
                    <Label htmlFor="taxStandardExpenseRate">{t('taxStandardExpenseRate')}</Label>
                    <div className="relative">
                      <Input
                        ref={taxFirstInputRef}
                        id="taxStandardExpenseRate"
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={formData.taxStandardExpenseRate}
                        onChange={(e) => handleInputChange('taxStandardExpenseRate', parseFloat(e.target.value) || 0)}
                        onFocus={handleInputFocus}
                        placeholder="50"
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taxStandardExpenseCap">{t('taxStandardExpenseCap')}</Label>
                    <Input
                      id="taxStandardExpenseCap"
                      type="number"
                      step="1000"
                      min="0"
                      value={formData.taxStandardExpenseCap}
                      onChange={(e) => handleInputChange('taxStandardExpenseCap', parseFloat(e.target.value) || 0)}
                      onFocus={handleInputFocus}
                      placeholder="100000"
                    />
                    <p className="text-xs text-gray-500">{t('taxStandardExpenseCapHint')}</p>
                  </div>
                </div>
              )}

              {/* Personal Allowance */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label className="font-medium">{t('taxApplyPersonalAllowance')}</Label>
                  <p className="text-xs text-gray-500">{t('taxApplyPersonalAllowanceHint')}</p>
                </div>
                <Switch
                  checked={formData.taxApplyPersonalAllowance}
                  onCheckedChange={(checked: boolean) => handleInputChange('taxApplyPersonalAllowance', checked)}
                />
              </div>

              {formData.taxApplyPersonalAllowance && (
                <div className="grid gap-4 md:grid-cols-2 pl-4 border-l-2 border-blue-200">
                  <div className="space-y-2">
                    <Label htmlFor="taxPersonalAllowanceAmount">{t('taxPersonalAllowanceAmount')}</Label>
                    <Input
                      id="taxPersonalAllowanceAmount"
                      type="number"
                      step="1000"
                      min="0"
                      value={formData.taxPersonalAllowanceAmount}
                      onChange={(e) => handleInputChange('taxPersonalAllowanceAmount', parseFloat(e.target.value) || 0)}
                      onFocus={handleInputFocus}
                      placeholder="60000"
                    />
                    <p className="text-xs text-gray-500">{t('taxPersonalAllowanceAmountHint')}</p>
                  </div>
                </div>
              )}

              {/* Progressive Tax Brackets */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">{t('taxProgressiveBrackets')}</Label>
                    <p className="text-xs text-gray-500">{t('taxProgressiveBracketsHint')}</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addTaxBracket}>
                    <Plus className="w-4 h-4 mr-1" />
                    {t('addBracket')}
                  </Button>
                </div>
                
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">{t('bracketMin')}</TableHead>
                        <TableHead className="w-[120px]">{t('bracketMax')}</TableHead>
                        <TableHead className="w-[100px]">{t('bracketRate')}</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.taxProgressiveBrackets.map((bracket, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              value={bracket.min}
                              readOnly
                              disabled={index > 0}
                              onChange={(e) => index === 0 && handleBracketChange(index, 'min', parseFloat(e.target.value) || 0)}
                              onFocus={handleInputFocus}
                              className={`w-full ${index > 0 ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              value={bracket.max ?? ''}
                              placeholder="ไม่จำกัด"
                              onChange={(e) => handleBracketChange(index, 'max', e.target.value === '' ? null : parseFloat(e.target.value))}
                              onFocus={handleInputFocus}
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="relative">
                              <Input
                                type="number"
                                step="1"
                                min="0"
                                max="100"
                                value={bracket.rate}
                                onChange={(e) => handleBracketChange(index, 'rate', parseFloat(e.target.value) || 0)}
                                onFocus={handleInputFocus}
                                className="w-full pr-8"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {formData.taxProgressiveBrackets.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeTaxBracket(index)}
                                className="h-8 w-8 text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 40(2) - Freelance/Contract Workers */}
          <Card>
            <CardHeader>
              <CardTitle>{t('taxSection40_2Title')}</CardTitle>
              <CardDescription>{t('taxSection40_2Description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="withholdingTaxRateService">{t('withholdingTaxRateService')}</Label>
                  <div className="relative">
                    <Input
                      id="withholdingTaxRateService"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={formData.withholdingTaxRateService}
                      onChange={(e) => handleInputChange('withholdingTaxRateService', parseFloat(e.target.value) || 0)}
                      onFocus={handleInputFocus}
                      placeholder="3"
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                  </div>
                  <p className="text-xs text-gray-500">{t('withholdingTaxRateServiceHint')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes - Only show on last tab */}
          <Card>
            <CardHeader>
              <CardTitle>{t('notes')}</CardTitle>
              <CardDescription>{t('notesDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                id="note"
                value={formData.note}
                onChange={(e) => handleInputChange('note', e.target.value)}
                placeholder={t('notesPlaceholder')}
                rows={4}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={() => fetchEffectiveConfig()}
          disabled={saving || loading}
        >
          {t('reset')}
        </Button>
        
        <div className="flex gap-3">
          {activeTab !== 'rates' && (
          <Button variant="outline" onClick={handleBack}>
            {t('back')}
          </Button>
        )}
        
        {activeTab !== 'tax' ? (
          <Button onClick={handleNext}>
            {t('next')}
          </Button>
        ) : (
          <Button 
            onClick={handleSaveConfig}
            disabled={saving || loading}
            className="gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('saving')}
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {t('saveChanges')}
              </>
            )}
          </Button>
        )}
        </div>
      </div>
    </div>
  );
}
