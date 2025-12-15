'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Printer, Check, X, CheckSquare, Square } from 'lucide-react';
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
import { PayslipPrintTemplate } from './payslip-print-template';
import {
  payrollService,
  PayrollItem,
  PayslipDetail,
  OrgProfileSnapshot,
} from '@/services/payroll.service';
import { orgProfileService } from '@/services/org-profile.service';

interface BatchPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runId: string;
  items: PayrollItem[];
  orgProfile?: OrgProfileSnapshot;
  bonusYear?: number | null;
  payrollMonthDate: string;
  periodStartDate: string;
}

export function BatchPrintDialog({
  open,
  onOpenChange,
  runId,
  items,
  orgProfile,
  bonusYear,
  payrollMonthDate,
  periodStartDate,
}: BatchPrintDialogProps) {
  const t = useTranslations('Payroll');
  const tCommon = useTranslations('Common');

  // Selected employee IDs (default: all selected)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Print options (default: both checked)
  const [printOriginal, setPrintOriginal] = useState(true);
  const [printCopy, setPrintCopy] = useState(true);
  
  // Payslip details for print
  const [payslipsForPrint, setPayslipsForPrint] = useState<PayslipDetail[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);

  // Print ref
  const printRef = useRef<HTMLDivElement>(null);

  // Initialize selection when dialog opens
  useEffect(() => {
    if (open && items.length > 0) {
      // Select all by default
      setSelectedIds(new Set(items.map(item => item.id)));
    }
  }, [open, items]);

  // Fetch logo
  useEffect(() => {
    if (open && orgProfile?.logo_id) {
      orgProfileService
        .fetchLogoWithCache(orgProfile.logo_id)
        .then(setLogoUrl)
        .catch(() => setLogoUrl(null));
    }
  }, [open, orgProfile?.logo_id]);

  // Toggle single item
  const toggleItem = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Select all
  const selectAll = () => {
    setSelectedIds(new Set(items.map(item => item.id)));
  };

  // Deselect all
  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // Get employee type badge
  const getEmployeeTypeBadge = (typeCode: string) => {
    const isFT = typeCode === 'full_time';
    return (
      <span
        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${
          isFT ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
        }`}
      >
        {isFT ? 'FT' : 'PT'}
      </span>
    );
  };

  // Fetch payslip details for selected items and print
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `payslips_${payrollMonthDate.substring(0, 7)}`,
    onBeforePrint: async () => {
      setLoading(true);
      try {
        // Fetch all selected payslip details
        const selectedItemIds = Array.from(selectedIds);
        const details = await Promise.all(
          selectedItemIds.map(id => payrollService.getPayslipDetail(id))
        );
        setPayslipsForPrint(details);
      } catch (error) {
        console.error('Failed to fetch payslip details for print:', error);
      } finally {
        setLoading(false);
      }
      return Promise.resolve();
    },
    onAfterPrint: () => {
      setPrinting(false);
    },
  });
  // Check if at least one print option is selected
  const canPrint = selectedIds.size > 0 && (printOriginal || printCopy);

  const onPrintClick = async () => {
    if (!canPrint) return;
    
    setPrinting(true);
    setLoading(true);
    
    try {
      // Fetch all selected payslip details first
      const selectedItemIds = Array.from(selectedIds);
      const details = await Promise.all(
        selectedItemIds.map(id => payrollService.getPayslipDetail(id))
      );
      setPayslipsForPrint(details);
      
      // Wait for state update and then print
      setTimeout(() => {
        setLoading(false);
        handlePrint();
      }, 100);
    } catch (error) {
      console.error('Failed to fetch payslip details for print:', error);
      setLoading(false);
      setPrinting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              {t('print.selectEmployees')}
            </DialogTitle>
          </DialogHeader>

          {/* Selection Controls */}
          <div className="flex gap-2 mb-3">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              disabled={selectedIds.size === items.length}
            >
              <CheckSquare className="h-4 w-4 mr-1" />
              {t('print.selectAll')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deselectAll}
              disabled={selectedIds.size === 0}
            >
              <Square className="h-4 w-4 mr-1" />
              {t('print.deselectAll')}
            </Button>
            <div className="flex-1 text-right text-sm text-gray-500">
              {t('print.selectedCount', { count: selectedIds.size })}
            </div>
          </div>

          {/* Print Options */}
          <div className="flex items-center gap-4 mb-3 p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-600">พิมพ์:</span>
            <div className="flex items-center gap-2">
              <Checkbox
                id="printOriginal"
                checked={printOriginal}
                onCheckedChange={(checked) => {
                  // Only allow unchecking if copy is checked
                  if (!checked && !printCopy) return;
                  setPrintOriginal(checked === true);
                }}
              />
              <label htmlFor="printOriginal" className="text-sm cursor-pointer">ต้นฉบับ</label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="printCopy"
                checked={printCopy}
                onCheckedChange={(checked) => {
                  // Only allow unchecking if original is checked
                  if (!checked && !printOriginal) return;
                  setPrintCopy(checked === true);
                }}
              />
              <label htmlFor="printCopy" className="text-sm cursor-pointer">สำเนา</label>
            </div>
          </div>

          {/* Employee List */}
          <div className="h-[400px] border rounded-lg overflow-y-auto">
            <div className="p-2 space-y-1">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-50 ${
                    selectedIds.has(item.id) ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => toggleItem(item.id)}
                >
                  <Checkbox
                    checked={selectedIds.has(item.id)}
                    onCheckedChange={() => toggleItem(item.id)}
                  />
                  {getEmployeeTypeBadge(item.employeeTypeCode)}
                  <div className="flex-1">
                    <div className="font-medium text-sm">{item.employeeName}</div>
                    <div className="text-xs text-gray-500">{item.employeeNumber}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-green-600">
                      {item.netPay?.toLocaleString('th-TH', {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                    <div className="text-[10px] text-gray-400">บาท</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={onPrintClick}
              disabled={selectedIds.size === 0 || loading || printing}
            >
              {loading || printing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  กำลังเตรียมพิมพ์...
                </>
              ) : (
                <>
                  <Printer className="h-4 w-4 mr-2" />
                  {t('print.button')} ({selectedIds.size})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden print content */}
      <div className="hidden">
        <div ref={printRef}>
          {payslipsForPrint.map((payslip) => (
            <PayslipPrintTemplate
              key={payslip.id}
              payslip={payslip}
              orgProfile={orgProfile}
              logoUrl={logoUrl || undefined}
              bonusYear={bonusYear}
              payrollMonthDate={payrollMonthDate}
              periodStartDate={periodStartDate}
              printOriginal={printOriginal}
              printCopy={printCopy}
            />
          ))}
        </div>
      </div>
    </>
  );
}

export default BatchPrintDialog;
