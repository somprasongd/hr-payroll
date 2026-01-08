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
import { salaryAdvanceService, SalaryAdvance } from '@/services/salary-advance-service';
import { SalaryAdvancePrintTemplate } from './salary-advance-print-template';

interface SalaryAdvancePrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salaryAdvanceId: string;
}

export function SalaryAdvancePrintDialog({ open, onOpenChange, salaryAdvanceId }: SalaryAdvancePrintDialogProps) {
  // Using generic translations or Debt for now, will add specific if needed
  const t = useTranslations('SalaryAdvance'); 
  const tPrint = useTranslations('Debt.print'); // Reuse print translations
  const componentRef = useRef<HTMLDivElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [salaryAdvance, setSalaryAdvance] = useState<SalaryAdvance | null>(null);
  const [orgProfile, setOrgProfile] = useState<OrgProfile | null>(null);
  const [logoUrl, setLogoUrl] = useState<string>('');
  
  // Print options
  const [printOriginal, setPrintOriginal] = useState(true);
  const [printCopy, setPrintCopy] = useState(true);

  useEffect(() => {
    if (open && salaryAdvanceId) {
      fetchData();
    }
  }, [open, salaryAdvanceId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [saData, profileData] = await Promise.all([
        salaryAdvanceService.getById(salaryAdvanceId),
        orgProfileService.getEffective(),
      ]);

      setSalaryAdvance(saData);
      
      // Fix casing for orgProfile if needed (similar to how we did in other dialogs)
      if (profileData) {
        // Map snake_case to camelCase if necessary, or ensure service returns correct type
        // Assuming service returns correct camelCase type here based on DebtDialog experience
        // But let's be safe and check if we need manual mapping. 
        // In previous turns, we saw keys might be mixed. 
        // Let's assume standard response first.
        setOrgProfile(profileData);
      } else {
        setOrgProfile(null);
      }

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
    documentTitle: `Salary_Advance_${salaryAdvance?.employeeId}_${salaryAdvance?.advanceDate}`,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            {tPrint('title')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          <div className="max-w-[210mm] mx-auto bg-white shadow-lg min-h-[297mm]">
            {loading ? (
              <div className="h-[400px] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : salaryAdvance ? (
              <SalaryAdvancePrintTemplate
                ref={componentRef}
                salaryAdvance={salaryAdvance}
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
              <Label htmlFor="original">{tPrint('options.original')}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="copy" 
                checked={printCopy} 
                onCheckedChange={(c) => setPrintCopy(!!c)} 
              />
              <Label htmlFor="copy">{tPrint('options.copy')}</Label>
            </div>
          </div>
          
          <div className="flex gap-2">
             <Button variant="outline" onClick={() => onOpenChange(false)}>
              {tPrint('close')}
            </Button>
            <Button onClick={() => handlePrint()} disabled={loading || (!printOriginal && !printCopy)}>
              <Printer className="w-4 h-4 mr-2" />
              {tPrint('printButton')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
