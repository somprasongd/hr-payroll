'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Printer, CheckSquare, Square, Eye, FileText } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PaymentCoverSheetTemplate, ReportType } from './payment-cover-sheet-template';
import {
  payrollService,
  PayrollItem,
  PayslipDetail,
  OrgProfileSnapshot,
} from '@/services/payroll.service';
import { orgProfileService } from '@/services/org-profile.service';

interface PaymentCoverSheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runId: string;
  // items prop is no longer used for data source, but kept for compatibility if needed, 
  // or it can be optional. modifying to optional for now to avoid breaking changes immediately
  items?: PayrollItem[]; 
  orgProfile?: OrgProfileSnapshot;
  payrollMonthDate: string;
  isPending?: boolean;
}

export function PaymentCoverSheetDialog({
  open,
  onOpenChange,
  runId,
  orgProfile,
  payrollMonthDate,
  isPending = false,
}: PaymentCoverSheetDialogProps) {
  const t = useTranslations('Payroll');
  const tCommon = useTranslations('Common');

  // Selected employee IDs (default: all selected)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // All items fetched for this run
  const [allItems, setAllItems] = useState<PayrollItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Report Type
  const [reportType, setReportType] = useState<ReportType>('salary');
  
  // Data for print
  const [payslipsForPrint, setPayslipsForPrint] = useState<PayslipDetail[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);

  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Print ref
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch all items when dialog opens
  useEffect(() => {
    if (open && runId) {
      setLoadingItems(true);
      payrollService.getPayrollItems(runId, { page: 1, limit: 1000 })
        .then((response) => {
          const items = response.data || [];
          setAllItems(items);
          setSelectedIds(new Set(items.map(item => item.id)));
        })
        .catch((err) => {
          console.error('Failed to fetch all payroll items', err);
        })
        .finally(() => {
          setLoadingItems(false);
        });
    }
  }, [open, runId]);

  // Fetch logo
  useEffect(() => {
    if (open && orgProfile?.logo_id) {
      orgProfileService
        .fetchLogoWithCache(orgProfile.logo_id)
        .then(setLogoUrl)
        .catch(() => setLogoUrl(null));
    }
  }, [open, orgProfile?.logo_id]);

  const toggleItem = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const selectAll = () => setSelectedIds(new Set(allItems.map(item => item.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const getEmployeeTypeBadge = (typeCode: string) => {
    const isFT = typeCode === 'full_time';
    return (
      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${
        isFT ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
      }`}>
        {isFT ? 'FT' : 'PT'}
      </span>
    );
  };

  const prepareData = async () => {
    const selectedItemIds = Array.from(selectedIds);
    // Sort to match the order in the list (items prop)
    const sortedIds = allItems
      .filter(item => selectedIds.has(item.id))
      .map(item => item.id);

    const details = await Promise.all(
        sortedIds.map(id => payrollService.getPayslipDetail(id))
    );
    // Filter out 0 amounts for specific report types if needed, but usually we list everyone selected
    return details;
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `payment_cover_${reportType}_${payrollMonthDate.substring(0, 7)}`,
    onAfterPrint: () => setPrinting(false),
  });

  const onPrintClick = async () => {
    if (selectedIds.size === 0) return;
    setPrinting(true);
    setLoading(true);
    try {
      const details = await prepareData();
      setPayslipsForPrint(details);
      setTimeout(() => {
        setLoading(false);
        handlePrint();
      }, 500); // Give time for image rendering
    } catch (error) {
      console.error('Error preparing print:', error);
      setLoading(false);
      setPrinting(false);
    }
  };

  const onPreviewClick = async () => {
    if (selectedIds.size === 0) return;
    setPreviewLoading(true);
    try {
      const details = await prepareData();
      setPayslipsForPrint(details);
      setShowPreview(true);
    } catch (error) {
      console.error('Error preparing preview:', error);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('print.paymentCoverSheet')}
            </DialogTitle>
          </DialogHeader>

          {/* Report Type Selection */}
          <div className="mb-4 space-y-3 p-4 border rounded-md bg-gray-50">
            <Label className="text-sm font-semibold text-gray-700">{t('print.reportType')}</Label>
            <RadioGroup value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="salary" id="r-salary" />
                  <Label htmlFor="r-salary">{t('print.types.salary')}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="tax" id="r-tax" />
                  <Label htmlFor="r-tax">{t('print.types.tax')}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sso" id="r-sso" />
                  <Label htmlFor="r-sso">{t('print.types.sso')}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pf" id="r-pf" />
                  <Label htmlFor="r-pf">{t('print.types.pf')}</Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          <div className="flex gap-2 mb-3">
            <Button variant="outline" size="sm" onClick={selectAll} disabled={selectedIds.size === allItems.length || loadingItems}>
              <CheckSquare className="h-4 w-4 mr-1" />
              {t('print.selectAll')}
            </Button>
            <Button variant="outline" size="sm" onClick={deselectAll} disabled={selectedIds.size === 0}>
              <Square className="h-4 w-4 mr-1" />
              {t('print.deselectAll')}
            </Button>
             <div className="flex-1 text-right text-sm text-gray-500">
              {t('print.selectedCount', { count: selectedIds.size })}
            </div>
          </div>

          <div className="h-[300px] border rounded-lg overflow-y-auto p-2 space-y-1">
            {loadingItems ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                Loading employees...
              </div>
            ) : (
              allItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-50 ${selectedIds.has(item.id) ? 'bg-blue-50' : ''}`}
                  onClick={() => toggleItem(item.id)}
                >
                  <Checkbox checked={selectedIds.has(item.id)} onCheckedChange={() => toggleItem(item.id)} />
                  {getEmployeeTypeBadge(item.employeeTypeCode)}
                  <div className="flex-1">
                    <div className="font-medium text-sm">{item.employeeName}</div>
                    <div className="text-xs text-gray-500">{item.employeeNumber}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{tCommon('cancel')}</Button>
            <Button variant="outline" onClick={onPreviewClick} disabled={selectedIds.size === 0 || previewLoading}>
              {previewLoading ? 'Loading...' : <><Eye className="h-4 w-4 mr-2" /> {t('print.preview')}</>}
            </Button>
            <Button onClick={onPrintClick} disabled={selectedIds.size === 0 || loading || printing}>
              {loading || printing ? 'Preparing...' : <><Printer className="h-4 w-4 mr-2" /> {t('print.button')}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden print content */}
      <div className="hidden">
        <PaymentCoverSheetTemplate
          ref={printRef}
          items={payslipsForPrint}
          orgProfile={orgProfile}
          logoUrl={logoUrl || undefined}
          payrollMonthDate={payrollMonthDate}
          type={reportType}
          isPending={isPending}
        />
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('print.preview')}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto bg-gray-100 p-4 border rounded-lg flex justify-center">
            <div className="bg-white shadow-lg origin-top scale-90">
               <PaymentCoverSheetTemplate
                items={payslipsForPrint}
                orgProfile={orgProfile}
                logoUrl={logoUrl || undefined}
                payrollMonthDate={payrollMonthDate}
                type={reportType}
                isPending={isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>{tCommon('close')}</Button>
            <Button onClick={() => { setShowPreview(false); onPrintClick(); }}>
              <Printer className="h-4 w-4 mr-2" /> {t('print.print')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
