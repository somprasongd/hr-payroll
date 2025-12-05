'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { payrollConfigService, type PayrollConfig } from "@/services/payroll-config.service";
import { ApiError } from "@/lib/api-client";
import { 
  Save, 
  Plus, 
  History, 
  AlertCircle,
  Loader2,
  CheckCircle,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  note: string;
}

export default function SettingsPage() {
  const t = useTranslations('Settings');
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [activeConfig, setActiveConfig] = useState<PayrollConfig | null>(null);
  const [configHistory, setConfigHistory] = useState<PayrollConfig[]>([]);
  const [formData, setFormData] = useState<ConfigFormData>({
    startDate: new Date().toISOString().split('T')[0],
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
  };

  const handleBack = () => {
    if (activeTab === 'bonuses') setActiveTab('rates');
    else if (activeTab === 'utilities') setActiveTab('bonuses');
    else if (activeTab === 'social') setActiveTab('utilities');
  };

  // Fetch effective config
  const fetchEffectiveConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await payrollConfigService.getEffective();
      setActiveConfig(data);
      
      // Load data into form (convert decimal to percentage for social security)
      setFormData({
        startDate: data.startDate || new Date().toISOString().split('T')[0],
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

  // Save configuration
  const handleSaveConfig = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Convert percentage to decimal for API
      const apiPayload = {
        ...formData,
        socialSecurityRateEmployee: formData.socialSecurityRateEmployee / 100,
        socialSecurityRateEmployer: formData.socialSecurityRateEmployer / 100,
      };

      const result = await payrollConfigService.create(apiPayload);
      setSuccess(t('saveSuccess'));
      
      // Refresh data
      await fetchEffectiveConfig();
      await fetchConfigHistory();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  // Handle form input changes
  const handleInputChange = (field: keyof ConfigFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
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

  // Auto-focus first field when page loads
  useEffect(() => {
    if (firstFieldRef.current) {
      firstFieldRef.current.focus();
    }
  }, []);

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
          <p className="text-sm text-gray-600 mt-1">
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
            <div className="mt-4">
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
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('error')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 border-green-200 text-green-900">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-900">{t('success')}</AlertTitle>
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
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
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto">
          <TabsTrigger value="rates">{t('rates')}</TabsTrigger>
          <TabsTrigger value="bonuses">{t('bonuses')}</TabsTrigger>
          <TabsTrigger value="utilities">{t('utilities')}</TabsTrigger>
          <TabsTrigger value="social">{t('socialSecurity')}</TabsTrigger>
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
                  ref={firstFieldRef}
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
        
        {activeTab !== 'social' ? (
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

