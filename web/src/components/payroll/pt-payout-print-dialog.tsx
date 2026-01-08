'use client';

import { useRef, useState, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { orgProfileService, OrgProfile } from '@/services/org-profile.service';
import { payoutPtService, PayoutPt } from '@/services/payout-pt.service';
import { employeeService, Employee } from '@/services/employee.service';
import { PtPayoutPrintTemplate } from './pt-payout-print-template';

interface PtPayoutPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payoutId: string;
}

export function PtPayoutPrintDialog({ open, onOpenChange, payoutId }: PtPayoutPrintDialogProps) {
  const t = useTranslations('Payouts.PT.print'); // Assuming you want a specific translation namespace
  const componentRef = useRef<HTMLDivElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [payout, setPayout] = useState<PayoutPt | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [orgProfile, setOrgProfile] = useState<OrgProfile | null>(null);
  const [logoUrl, setLogoUrl] = useState<string>('');
  
  // Print options
  const [printOriginal, setPrintOriginal] = useState(true);
  const [printCopy, setPrintCopy] = useState(true);

  useEffect(() => {
    if (open && payoutId) {
      fetchData();
    }
  }, [open, payoutId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const payoutData = await payoutPtService.getPayout(payoutId);
      setPayout(payoutData);

      // Fetch employee data if we have an employeeId
      let employeeData: Employee | null = null;
      if (payoutData.employeeId) {
        employeeData = await employeeService.getEmployee(payoutData.employeeId);
        setEmployee(employeeData);
      }

      const profileData = await orgProfileService.getEffective();
      setOrgProfile(profileData);

      if (profileData?.logoId) {
        const url = await orgProfileService.fetchLogoWithCache(profileData.logoId);
        setLogoUrl(url || '');
      }
    } catch (error) {
      console.error('Failed to fetch print data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `PTAdvance_${employee?.employeeNumber || ''}_${employee?.firstName || ''}${employee?.lastName || ''}`,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            {t('title')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          <div className="max-w-[210mm] mx-auto bg-white shadow-lg min-h-[297mm]">
            {loading ? (
              <div className="h-[400px] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : payout ? (
              <PtPayoutPrintTemplate
                ref={componentRef}
                payout={payout}
                employee={employee}
                orgProfile={orgProfile}
                logoUrl={logoUrl}
                printOriginal={printOriginal}
                printCopy={printCopy}
              />
            ) : (
                <div className="p-8 text-center text-gray-500">Failed to load data</div>
            )}
          </div>
        </div>

        <div className="p-4 border-t bg-white flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="original" 
                checked={printOriginal} 
                onCheckedChange={(c) => setPrintOriginal(!!c)} 
              />
              <Label htmlFor="original">{t('options.original')}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="copy" 
                checked={printCopy} 
                onCheckedChange={(c) => setPrintCopy(!!c)} 
              />
              <Label htmlFor="copy">{t('options.copy')}</Label>
            </div>
          </div>
          
          <div className="flex gap-2">
             <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('close')}
            </Button>
            <Button onClick={() => handlePrint()} disabled={loading || (!printOriginal && !printCopy)}>
              <Printer className="w-4 h-4 mr-2" />
              {t('printButton')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
