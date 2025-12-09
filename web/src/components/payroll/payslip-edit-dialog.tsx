'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  payrollService,
  PayslipDetail,
  UpdatePayslipRequest,
  OtherIncomeItem,
  LoanRepaymentItem,
} from '@/services/payroll.service';

interface PayslipEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  employeeName: string;
  employeeTypeName?: string;
  canEdit: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  onNavigate: (direction: 'prev' | 'next') => void;
  onSuccess?: () => void;
}

export function PayslipEditDialog({
  open,
  onOpenChange,
  itemId,
  employeeName,
  employeeTypeName,
  canEdit,
  hasPrevious,
  hasNext,
  onNavigate,
  onSuccess,
}: PayslipEditDialogProps) {
  const t = useTranslations('Payroll');
  const tCommon = useTranslations('Common');

  const [detail, setDetail] = useState<PayslipDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('income');

  // Editable fields
  const [leaveCompensation, setLeaveCompensation] = useState(0);
  const [doctorFee, setDoctorFee] = useState(0);
  const [othersIncome, setOthersIncome] = useState<OtherIncomeItem[]>([]);
  const [taxAmount, setTaxAmount] = useState(0);
  const [pfAmount, setPfAmount] = useState(0);
  const [waterMeterPrev, setWaterMeterPrev] = useState<number | null>(null);
  const [waterMeterCurr, setWaterMeterCurr] = useState<number | null>(null);
  const [waterAmount, setWaterAmount] = useState(0);
  const [electricMeterPrev, setElectricMeterPrev] = useState<number | null>(null);
  const [electricMeterCurr, setElectricMeterCurr] = useState<number | null>(null);
  const [electricAmount, setElectricAmount] = useState(0);
  const [internetAmount, setInternetAmount] = useState(0);
  const [advanceRepay, setAdvanceRepay] = useState(0);
  const [loanRepayments, setLoanRepayments] = useState<LoanRepaymentItem[]>([]);

  // Validation errors
  const [waterMeterError, setWaterMeterError] = useState<string | null>(null);
  const [electricMeterError, setElectricMeterError] = useState<string | null>(null);

  // Unsaved changes confirmation
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<'cancel' | 'prev' | 'next' | null>(null);

  // Original values for dirty checking
  const [originalValues, setOriginalValues] = useState<{
    leaveCompensation: number;
    doctorFee: number;
    othersIncome: OtherIncomeItem[];
    taxAmount: number;
    pfAmount: number;
    waterMeterPrev: number | null;
    waterMeterCurr: number | null;
    waterAmount: number;
    electricMeterPrev: number | null;
    electricMeterCurr: number | null;
    electricAmount: number;
    internetAmount: number;
    advanceRepay: number;
    loanRepayments: LoanRepaymentItem[];
  } | null>(null);

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      const data = await payrollService.getPayslipDetail(itemId);
      setDetail(data);
      
      // Populate editable fields from flat structure
      const leaveComp = data?.leaveCompensationAmount ?? 0;
      const drFee = data?.doctorFee ?? 0;
      const others = data?.othersIncome ?? [];
      const tax = data?.taxMonthAmount ?? 0;
      const pf = data?.pfMonthAmount ?? 0;
      const waterPrev = data?.waterMeterPrev ?? null;
      const waterCurr = data?.waterMeterCurr ?? null;
      const waterAmt = data?.waterAmount ?? 0;
      const electricPrev = data?.electricMeterPrev ?? null;
      const electricCurr = data?.electricMeterCurr ?? null;
      const electricAmt = data?.electricAmount ?? 0;
      const internet = data?.internetAmount ?? 0;
      const advance = data?.advanceRepayAmount ?? 0;
      const loans = data?.loanRepayments ?? [];

      setLeaveCompensation(leaveComp);
      setDoctorFee(drFee);
      setOthersIncome(others);
      setTaxAmount(tax);
      setPfAmount(pf);
      setWaterMeterPrev(waterPrev);
      setWaterMeterCurr(waterCurr);
      setWaterAmount(waterAmt);
      setElectricMeterPrev(electricPrev);
      setElectricMeterCurr(electricCurr);
      setElectricAmount(electricAmt);
      setInternetAmount(internet);
      setAdvanceRepay(advance);
      setLoanRepayments(loans);

      // Save original values for dirty checking
      setOriginalValues({
        leaveCompensation: leaveComp,
        doctorFee: drFee,
        othersIncome: JSON.parse(JSON.stringify(others)),
        taxAmount: tax,
        pfAmount: pf,
        waterMeterPrev: waterPrev,
        waterMeterCurr: waterCurr,
        waterAmount: waterAmt,
        electricMeterPrev: electricPrev,
        electricMeterCurr: electricCurr,
        electricAmount: electricAmt,
        internetAmount: internet,
        advanceRepay: advance,
        loanRepayments: JSON.parse(JSON.stringify(loans)),
      });

      // Clear validation errors
      setWaterMeterError(null);
      setElectricMeterError(null);
      
      // Reset to income tab if part-time employee and currently on attendance tab
      if (data?.employeeTypeCode !== 'full_time' && activeTab === 'attendance') {
        setActiveTab('income');
      }
    } catch (error) {
      console.error('Failed to fetch payslip detail:', error);
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    if (open && itemId) {
      fetchDetail();
    }
  }, [open, itemId, fetchDetail]);

  const handleSave = async () => {
    if (!canEdit) return;
    
    try {
      setSaving(true);
      const data: UpdatePayslipRequest = {
        leaveCompensationAmount: leaveCompensation,
        doctorFee: detail?.allowDoctorFee ? doctorFee : undefined,
        othersIncome,
        taxMonthAmount: detail?.withholdTax ? taxAmount : undefined,
        pfMonthAmount: detail?.providentFundContribute ? pfAmount : undefined,
        waterMeterPrev: detail?.allowWater ? (waterMeterPrev ?? 0) : undefined,
        waterMeterCurr: detail?.allowWater ? (waterMeterCurr ?? 0) : undefined,
        waterAmount: detail?.allowWater ? waterAmount : undefined,
        electricMeterPrev: detail?.allowElectric ? (electricMeterPrev ?? 0) : undefined,
        electricMeterCurr: detail?.allowElectric ? (electricMeterCurr ?? 0) : undefined,
        electricAmount: detail?.allowElectric ? electricAmount : undefined,
        internetAmount: detail?.allowInternet ? internetAmount : undefined,
        advanceRepayAmount: advanceRepay,
        loanRepayments,
      };
      
      await payrollService.updatePayslip(itemId, data);
      
      // Refetch to get updated calculated values
      await fetchDetail();
      
      onSuccess?.();
    } catch (error) {
      console.error('Failed to update payslip:', error);
    } finally {
      setSaving(false);
    }
  };

  const addOtherIncome = () => {
    setOthersIncome([...othersIncome, { name: '', value: 0 }]);
  };

  const removeOtherIncome = (index: number) => {
    setOthersIncome(othersIncome.filter((_, i) => i !== index));
  };

  const updateOtherIncome = (index: number, field: 'name' | 'value', value: string | number) => {
    const updated = [...othersIncome];
    updated[index] = { ...updated[index], [field]: value };
    setOthersIncome(updated);
  };

  const addLoanRepayment = () => {
    setLoanRepayments([...loanRepayments, { name: '', value: 0 }]);
  };

  const removeLoanRepayment = (index: number) => {
    setLoanRepayments(loanRepayments.filter((_, i) => i !== index));
  };

  const updateLoanRepayment = (index: number, field: 'name' | 'value', value: string | number) => {
    const updated = [...loanRepayments];
    updated[index] = { ...updated[index], [field]: value };
    setLoanRepayments(updated);
  };

  // Check if form has unsaved changes
  const isDirty = useMemo(() => {
    if (!originalValues || !canEdit) return false;
    
    if (leaveCompensation !== originalValues.leaveCompensation) return true;
    if (doctorFee !== originalValues.doctorFee) return true;
    if (taxAmount !== originalValues.taxAmount) return true;
    if (pfAmount !== originalValues.pfAmount) return true;
    if (waterMeterPrev !== originalValues.waterMeterPrev) return true;
    if (waterMeterCurr !== originalValues.waterMeterCurr) return true;
    if (waterAmount !== originalValues.waterAmount) return true;
    if (electricMeterPrev !== originalValues.electricMeterPrev) return true;
    if (electricMeterCurr !== originalValues.electricMeterCurr) return true;
    if (electricAmount !== originalValues.electricAmount) return true;
    if (internetAmount !== originalValues.internetAmount) return true;
    if (advanceRepay !== originalValues.advanceRepay) return true;
    
    // Check arrays
    if (JSON.stringify(othersIncome) !== JSON.stringify(originalValues.othersIncome)) return true;
    if (JSON.stringify(loanRepayments) !== JSON.stringify(originalValues.loanRepayments)) return true;
    
    return false;
  }, [
    originalValues, canEdit, leaveCompensation, doctorFee, taxAmount, pfAmount,
    waterMeterPrev, waterMeterCurr, waterAmount,
    electricMeterPrev, electricMeterCurr, electricAmount,
    internetAmount, advanceRepay, othersIncome, loanRepayments
  ]);

  // Handle actions with dirty check
  const handleActionWithDirtyCheck = (action: 'cancel' | 'prev' | 'next') => {
    if (isDirty) {
      setPendingAction(action);
      setShowUnsavedDialog(true);
    } else {
      executeAction(action);
    }
  };

  const executeAction = (action: 'cancel' | 'prev' | 'next') => {
    if (action === 'cancel') {
      onOpenChange(false);
    } else {
      onNavigate(action);
    }
  };

  const handleSaveAndContinue = async () => {
    setShowUnsavedDialog(false);
    await handleSave();
    if (pendingAction) {
      executeAction(pendingAction);
      setPendingAction(null);
    }
  };

  const handleDiscardChanges = () => {
    setShowUnsavedDialog(false);
    if (pendingAction) {
      executeAction(pendingAction);
      setPendingAction(null);
    }
  };

  const getEmployeeTypeBadge = () => {
    if (!employeeTypeName) return null;
    const typeName = employeeTypeName.toLowerCase();
    const isFT = typeName.includes('full') || typeName.includes('ประจำ');
    return (
      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
        isFT ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
      }`}>
        {isFT ? 'FT' : 'PT'}
      </span>
    );
  };

  const formatNumber = (value: number | undefined | null) => {
    return (value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">{t('payslip.editTitle')}</DialogTitle>
        </DialogHeader>

        {/* Employee Header with Navigation */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleActionWithDirtyCheck('prev')}
            disabled={!hasPrevious}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              {detail?.employeeTypeCode && (
                <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold ${
                  detail.employeeTypeCode === 'full_time' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                }`}>
                  {detail.employeeTypeCode === 'full_time' ? 'FT' : 'PT'}
                </span>
              )}
              <span className="font-medium text-lg">{detail?.employeeName || employeeName}</span>
            </div>
            {detail?.employeeNumber && (
              <span className="text-sm text-gray-500">{detail.employeeNumber}</span>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleActionWithDirtyCheck('next')}
            disabled={!hasNext}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500"></div>
          </div>
        ) : detail ? (
          <>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="flex w-full overflow-x-auto">
                <TabsTrigger value="income" className="flex-1 min-w-fit whitespace-nowrap">{t('payslip.tabs.income')}</TabsTrigger>
                {detail?.employeeTypeCode === 'full_time' && (
                  <TabsTrigger value="attendance" className="flex-1 min-w-fit whitespace-nowrap">{t('payslip.tabs.attendance')}</TabsTrigger>
                )}
                <TabsTrigger value="deductions" className="flex-1 min-w-fit whitespace-nowrap">{t('payslip.tabs.deductions')}</TabsTrigger>
                <TabsTrigger value="loans" className="flex-1 min-w-fit whitespace-nowrap">{t('payslip.tabs.loans')}</TabsTrigger>
              </TabsList>

              {/* Income Tab */}
              <TabsContent value="income" className="space-y-4">
                <Card>
                  <CardContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-gray-500">{t('payslip.fields.salary')}</Label>
                        <div className="text-lg font-medium">{formatNumber(detail.salaryAmount)}</div>
                        {detail.employeeTypeCode !== 'full_time' && detail.ptHoursWorked > 0 && (
                          <div className="text-xs text-gray-400">
                            ({detail.ptHoursWorked} ชม. x {formatNumber(detail.ptHourlyRate)} บาท)
                          </div>
                        )}
                      </div>
                      <div>
                        <Label className="text-gray-500">{t('payslip.fields.ot')} ({detail.otHours} {t('payslip.fields.otHours')})</Label>
                        <div className="text-lg font-medium">{formatNumber(detail.otAmount)}</div>
                      </div>
                      <div>
                        <Label className="text-gray-500">{t('payslip.fields.bonus')}</Label>
                        <div className="text-lg font-medium">{formatNumber(detail.bonusAmount)}</div>
                      </div>
                      <div>
                        <Label className="text-gray-500">{t('payslip.fields.housingAllowance')}</Label>
                        <div className="text-lg font-medium">{formatNumber(detail.housingAllowance)}</div>
                      </div>
                      <div>
                        <Label className="text-gray-500">{t('payslip.fields.attendanceBonusNoLate')}</Label>
                        <div className="text-lg font-medium">{formatNumber(detail.attendanceBonusNoLate)}</div>
                      </div>
                      <div>
                        <Label className="text-gray-500">{t('payslip.fields.attendanceBonusNoLeave')}</Label>
                        <div className="text-lg font-medium">{formatNumber(detail.attendanceBonusNoLeave)}</div>
                      </div>
                    </div>

                    {/* Editable: Leave Compensation */}
                    <div>
                      <Label htmlFor="leaveCompensation">{t('payslip.fields.leaveCompensation')}</Label>
                      <Input
                        id="leaveCompensation"
                        type="number"
                        min="0"
                        step="0.01"
                        value={leaveCompensation}
                        onChange={(e) => setLeaveCompensation(parseFloat(e.target.value) || 0)}
                        disabled={!canEdit}
                        className="max-w-xs"
                      />
                    </div>

                    {/* Editable: Doctor Fee */}
                    <div>
                      <Label htmlFor="doctorFee">{t('payslip.fields.doctorFee')}</Label>
                      <Input
                        id="doctorFee"
                        type="number"
                        min="0"
                        step="0.01"
                        value={doctorFee}
                        onChange={(e) => setDoctorFee(parseFloat(e.target.value) || 0)}
                        disabled={!canEdit || !detail.allowDoctorFee}
                        className="max-w-xs"
                      />
                    </div>

                    {/* Editable: Others Income Array */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>{t('payslip.fields.othersIncome')}</Label>
                        {canEdit && (
                          <Button type="button" variant="outline" size="sm" onClick={addOtherIncome}>
                            <Plus className="h-4 w-4 mr-1" />
                            {t('payslip.addItem')}
                          </Button>
                        )}
                      </div>
                      {othersIncome.map((item, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <Input
                            placeholder={t('payslip.itemName')}
                            value={item.name ?? ''}
                            onChange={(e) => updateOtherIncome(index, 'name', e.target.value)}
                            disabled={!canEdit}
                            className="flex-1"
                          />
                          <Input
                            type="number"
                        min="0"
                            step="0.01"
                            placeholder={t('payslip.itemValue')}
                            value={item.value ?? 0}
                            onChange={(e) => updateOtherIncome(index, 'value', parseFloat(e.target.value) || 0)}
                            disabled={!canEdit}
                            className="w-32"
                          />
                          {canEdit && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeOtherIncome(index)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="pt-4 border-t">
                      <div className="flex justify-between text-lg font-semibold">
                        <span>{t('payslip.fields.incomeTotal')}</span>
                        <span className="text-green-600">{formatNumber(detail.incomeTotal)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Attendance Tab */}
              <TabsContent value="attendance" className="space-y-4">
                <Card>
                  <CardContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-gray-500">{t('payslip.fields.lateMinutes')}</Label>
                        <div className="text-lg font-medium">{detail.lateMinutesQty} นาที</div>
                      </div>
                      <div>
                        <Label className="text-gray-500">{t('payslip.fields.lateDeduction')}</Label>
                        <div className="text-lg font-medium text-red-600">-{formatNumber(detail.lateMinutesDeduction)}</div>
                      </div>
                      <div>
                        <Label className="text-gray-500">{t('payslip.fields.leaveDays')}</Label>
                        <div className="text-lg font-medium">{detail.leaveDaysQty} วัน</div>
                      </div>
                      <div>
                        <Label className="text-gray-500">{t('payslip.fields.leaveDeduction')}</Label>
                        <div className="text-lg font-medium text-red-600">-{formatNumber(detail.leaveDaysDeduction)}</div>
                      </div>
                      <div>
                        <Label className="text-gray-500">{t('payslip.fields.leaveDouble')}</Label>
                        <div className="text-lg font-medium">{detail.leaveDoubleQty} วัน</div>
                      </div>
                      <div>
                        <Label className="text-gray-500">{t('payslip.fields.leaveDoubleDeduction')}</Label>
                        <div className="text-lg font-medium text-red-600">-{formatNumber(detail.leaveDoubleDeduction)}</div>
                      </div>
                      <div>
                        <Label className="text-gray-500">{t('payslip.fields.leaveHours')}</Label>
                        <div className="text-lg font-medium">{detail.leaveHoursQty} ชม.</div>
                      </div>
                      <div>
                        <Label className="text-gray-500">{t('payslip.fields.leaveHoursDeduction')}</Label>
                        <div className="text-lg font-medium text-red-600">-{formatNumber(detail.leaveHoursDeduction)}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Deductions Tab */}
              <TabsContent value="deductions" className="space-y-4">
                <Card>
                  <CardContent className="pt-4 space-y-4">
                    {/* Tax - Editable */}
                    <div>
                      <Label htmlFor="tax">{t('payslip.fields.tax')}</Label>
                      <Input
                        id="tax"
                        type="number"
                        min="0"
                        step="0.01"
                        value={taxAmount}
                        onChange={(e) => setTaxAmount(parseFloat(e.target.value) || 0)}
                        disabled={!canEdit || !detail.withholdTax}
                        className="max-w-xs"
                      />
                      <div className="text-xs text-gray-400">
                        สะสม: {formatNumber(detail.taxAccumPrev)} → {formatNumber(detail.taxAccumTotal)}
                      </div>
                    </div>

                    {/* SSO - Read only */}
                    <div>
                      <Label className="text-gray-500">{t('payslip.fields.sso')}</Label>
                      <div className="text-lg font-medium">{formatNumber(detail.ssoMonthAmount)}</div>
                      <div className="text-xs text-gray-400">
                        สะสม: {formatNumber(detail.ssoAccumPrev)} → {formatNumber(detail.ssoAccumTotal)}
                      </div>
                    </div>

                    {/* PF - Editable */}
                    <div>
                      <Label htmlFor="pf">{t('payslip.fields.providentFund')}</Label>
                      <Input
                        id="pf"
                        type="number"
                        min="0"
                        step="0.01"
                        value={pfAmount}
                        onChange={(e) => setPfAmount(parseFloat(e.target.value) || 0)}
                        disabled={!canEdit || !detail.providentFundContribute}
                        className="max-w-xs"
                      />
                      <div className="text-xs text-gray-400">
                        สะสม: {formatNumber(detail.pfAccumPrev)} → {formatNumber(detail.pfAccumTotal)}
                      </div>
                    </div>

                    {/* Utilities */}
                    <div className="border-t pt-4 space-y-4">
                      <h4 className="font-medium">{t('payslip.fields.utilities')}</h4>
                      
                      {/* Water */}
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="waterPrev">{t('payslip.fields.waterMeterPrev')}</Label>
                          <Input
                            id="waterPrev"
                            type="number"
                        min="0"
                            step="0.01"
                            value={waterMeterPrev ?? ''}
                            onChange={(e) => {
                              const prev = e.target.value ? parseFloat(e.target.value) : null;
                              setWaterMeterPrev(prev);
                              // Auto-calculate water amount
                              if (prev !== null && waterMeterCurr !== null && detail.waterRatePerUnit) {
                                const usage = Math.max(0, waterMeterCurr - prev);
                                setWaterAmount(usage * detail.waterRatePerUnit);
                              }
                            }}
                            disabled={!canEdit || !detail.allowWater}
                          />
                        </div>
                        <div>
                          <Label htmlFor="waterCurr">{t('payslip.fields.waterMeterCurr')}</Label>
                          <Input
                            id="waterCurr"
                            type="number"
                        min="0"
                            step="0.01"
                            value={waterMeterCurr ?? ''}
                            onChange={(e) => {
                              const curr = e.target.value ? parseFloat(e.target.value) : null;
                              setWaterMeterCurr(curr);
                              // Validate curr >= prev
                              if (waterMeterPrev !== null && curr !== null && curr < waterMeterPrev) {
                                setWaterMeterError('มิเตอร์หลังต้องมากกว่าหรือเท่ากับมิเตอร์ก่อน');
                                setWaterAmount(0);
                              } else {
                                setWaterMeterError(null);
                                // Auto-calculate water amount
                                if (waterMeterPrev !== null && curr !== null && detail.waterRatePerUnit) {
                                  const usage = Math.max(0, curr - waterMeterPrev);
                                  setWaterAmount(usage * detail.waterRatePerUnit);
                                }
                              }
                            }}
                            disabled={!canEdit || !detail.allowWater}
                            className={waterMeterError ? 'border-red-500' : ''}
                          />
                          {waterMeterError && (
                            <p className="text-xs text-red-500 mt-1">{waterMeterError}</p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="waterAmt">
                            {t('payslip.fields.waterAmount')} 
                            <span className="text-xs text-gray-400 ml-1">(หน่วยละ {formatNumber(detail.waterRatePerUnit)})</span>
                          </Label>
                          <Input
                            id="waterAmt"
                            type="number"
                        min="0"
                            step="0.01"
                            value={waterAmount}
                            onChange={(e) => setWaterAmount(parseFloat(e.target.value) || 0)}
                            disabled={!canEdit || !detail.allowWater}
                          />
                        </div>
                      </div>

                      {/* Electric */}
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="electricPrev">{t('payslip.fields.electricMeterPrev')}</Label>
                          <Input
                            id="electricPrev"
                            type="number"
                        min="0"
                            step="0.01"
                            value={electricMeterPrev ?? ''}
                            onChange={(e) => {
                              const prev = e.target.value ? parseFloat(e.target.value) : null;
                              setElectricMeterPrev(prev);
                              // Auto-calculate electric amount
                              if (prev !== null && electricMeterCurr !== null && detail.electricityRatePerUnit) {
                                const usage = Math.max(0, electricMeterCurr - prev);
                                setElectricAmount(usage * detail.electricityRatePerUnit);
                              }
                            }}
                            disabled={!canEdit || !detail.allowElectric}
                          />
                        </div>
                        <div>
                          <Label htmlFor="electricCurr">{t('payslip.fields.electricMeterCurr')}</Label>
                          <Input
                            id="electricCurr"
                            type="number"
                        min="0"
                            step="0.01"
                            value={electricMeterCurr ?? ''}
                            onChange={(e) => {
                              const curr = e.target.value ? parseFloat(e.target.value) : null;
                              setElectricMeterCurr(curr);
                              // Validate curr >= prev
                              if (electricMeterPrev !== null && curr !== null && curr < electricMeterPrev) {
                                setElectricMeterError('มิเตอร์หลังต้องมากกว่าหรือเท่ากับมิเตอร์ก่อน');
                                setElectricAmount(0);
                              } else {
                                setElectricMeterError(null);
                                // Auto-calculate electric amount
                                if (electricMeterPrev !== null && curr !== null && detail.electricityRatePerUnit) {
                                  const usage = Math.max(0, curr - electricMeterPrev);
                                  setElectricAmount(usage * detail.electricityRatePerUnit);
                                }
                              }
                            }}
                            disabled={!canEdit || !detail.allowElectric}
                            className={electricMeterError ? 'border-red-500' : ''}
                          />
                          {electricMeterError && (
                            <p className="text-xs text-red-500 mt-1">{electricMeterError}</p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="electricAmt">
                            {t('payslip.fields.electricAmount')} 
                            <span className="text-xs text-gray-400 ml-1">(หน่วยละ {formatNumber(detail.electricityRatePerUnit)})</span>
                          </Label>
                          <Input
                            id="electricAmt"
                            type="number"
                        min="0"
                            step="0.01"
                            value={electricAmount}
                            onChange={(e) => setElectricAmount(parseFloat(e.target.value) || 0)}
                            disabled={!canEdit || !detail.allowElectric}
                          />
                        </div>
                      </div>

                      {/* Internet */}
                      <div className="max-w-xs">
                        <Label htmlFor="internet">{t('payslip.fields.internetAmount')}</Label>
                        <Input
                          id="internet"
                          type="number"
                        min="0"
                          step="0.01"
                          value={internetAmount}
                          onChange={(e) => setInternetAmount(parseFloat(e.target.value) || 0)}
                          disabled={!canEdit || !detail.allowInternet}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Loans Tab */}
              <TabsContent value="loans" className="space-y-4">
                <Card>
                  <CardContent className="pt-4 space-y-4">
                    {/* Advance Repay - Editable */}
                    <div>
                      <Label htmlFor="advanceRepay">{t('payslip.fields.advanceRepay')}</Label>
                      <div className="text-xs text-gray-400 mb-1">
                        ยอดเบิก: {formatNumber(detail.advanceAmount)} | คงเหลือ: {formatNumber(detail.advanceDiffAmount)} (ยกไปเป็นยอดหนี้)
                      </div>
                      <Input
                        id="advanceRepay"
                        type="number"
                        min="0"
                        step="0.01"
                        value={advanceRepay}
                        onChange={(e) => setAdvanceRepay(parseFloat(e.target.value) || 0)}
                        disabled={!canEdit || !detail.advanceAmount}
                        className="max-w-xs"
                      />
                    </div>

                    {/* Loan Repayments Array - Editable */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>{t('payslip.fields.loanRepayments')}</Label>
                          <div className="text-xs text-gray-400">
                            หนี้คงค้าง: {formatNumber(detail.loanOutstandingPrev)} → {formatNumber(detail.loanOutstandingTotal)}
                          </div>
                        </div>
                        {canEdit && !!detail.loanOutstandingPrev && (
                          <Button type="button" variant="outline" size="sm" onClick={addLoanRepayment}>
                            <Plus className="h-4 w-4 mr-1" />
                            {t('payslip.addItem')}
                          </Button>
                        )}
                      </div>
                      {loanRepayments.map((item, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <Input
                            placeholder={t('payslip.itemName')}
                            value={item.name ?? ''}
                            onChange={(e) => updateLoanRepayment(index, 'name', e.target.value)}
                            disabled={!canEdit}
                            className="flex-1"
                          />
                          <Input
                            type="number"
                        min="0"
                            step="0.01"
                            placeholder={t('payslip.itemValue')}
                            value={item.value ?? 0}
                            onChange={(e) => updateLoanRepayment(index, 'value', parseFloat(e.target.value) || 0)}
                            disabled={!canEdit}
                            className="w-32"
                          />
                          {canEdit && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLoanRepayment(index)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Summary & Actions */}
            <div className="flex flex-col gap-2 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xl font-bold">{t('payslip.fields.netPay')}: </span>
                  <span className="text-xl font-bold text-green-600">{formatNumber(detail.netPay)}</span>
                  <span className="text-sm ml-2">
                    (<span className="text-green-600">{formatNumber(detail.incomeTotal)}</span> - <span className="text-red-600">{formatNumber(detail.deductionTotal)}</span>)
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => handleActionWithDirtyCheck('cancel')}>
                    {tCommon('cancel')}
                  </Button>
                  {canEdit && (
                    <Button onClick={handleSave} disabled={saving || !!waterMeterError || !!electricMeterError}>
                      {saving ? tCommon('loading') : tCommon('save')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>

      {/* Unsaved Changes Confirmation Dialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ข้อมูลยังไม่ถูกบันทึก</AlertDialogTitle>
            <AlertDialogDescription>
              คุณมีการแก้ไขข้อมูลที่ยังไม่ได้บันทึก ต้องการบันทึกก่อนหรือไม่?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscardChanges}>
              ไม่บันทึก
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveAndContinue}>
              บันทึก
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
