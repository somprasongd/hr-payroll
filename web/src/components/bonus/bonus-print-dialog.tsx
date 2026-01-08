'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BonusPrintTemplate } from './bonus-print-template';
import {
  bonusService,
  BonusItem,
  BonusCycle,
} from '@/services/bonus-service';
import { orgProfileService } from '@/services/org-profile.service';
import { OrgProfileSnapshot } from '@/services/payroll.service';

interface BonusPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycle: BonusCycle;
}

export function BonusPrintDialog({
  open,
  onOpenChange,
  cycle,
}: BonusPrintDialogProps) {
  const t = useTranslations('Bonus.print');
  const tCommon = useTranslations('Common');
  const [items, setItems] = useState<BonusItem[]>([]);
  const [orgProfile, setOrgProfile] = useState<OrgProfileSnapshot | undefined>(undefined);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && cycle.id) {
      setLoading(true);
      Promise.all([
        bonusService.getBonusItems(cycle.id).then(res => res || []), // Ensure it returns array
        orgProfileService.getEffective()
      ])
        .then(([itemsData, orgProfileData]) => {
          setItems(itemsData || []);
          
          // Map camelCase to snake_case for the template
          const mappedProfile: OrgProfileSnapshot = {
            company_name: orgProfileData.companyName,
            address_line1: orgProfileData.addressLine1,
            address_line2: orgProfileData.addressLine2,
            subdistrict: orgProfileData.subdistrict,
            district: orgProfileData.district,
            province: orgProfileData.province,
            postal_code: orgProfileData.postalCode,
            phone_main: orgProfileData.phoneMain,
            phone_alt: orgProfileData.phoneAlt,
            email: orgProfileData.email,
            tax_id: orgProfileData.taxId,
            logo_id: orgProfileData.logoId,
            slip_footer_note: orgProfileData.slipFooterNote,
          };

          setOrgProfile(mappedProfile);
          if (orgProfileData.logoId) {
            return orgProfileService.fetchLogoWithCache(orgProfileData.logoId);
          }
          return null;
        })
        .then((url) => {
           setLogoUrl(url);
        })
        .catch((err) => {
          console.error('Failed to fetch data for print preview:', err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, cycle.id]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `bonus_summary_${cycle.payrollMonthDate.substring(0, 7)}`,
    onAfterPrint: () => setPrinting(false),
  });

  const onPrintClick = () => {
    setPrinting(true);
    // Tiny delay to ensure ref is ready/rendered if needed
    setTimeout(() => {
      handlePrint();
    }, 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            {t('title')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto bg-gray-100 p-4 border rounded-lg flex justify-center">
            {loading ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                    Loading preview...
                </div>
            ) : (
                <div className="bg-white shadow-lg origin-top scale-90">
                    <BonusPrintTemplate
                        ref={printRef}
                        items={items}
                        orgProfile={orgProfile}
                        logoUrl={logoUrl || undefined}
                        periodStartDate={cycle.periodStartDate}
                        periodEndDate={cycle.periodEndDate}
                    />
                </div>
            )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon('close')}
          </Button>
          <Button onClick={onPrintClick} disabled={loading || printing}>
            <Printer className="h-4 w-4 mr-2" />
            {printing ? t('printing') : t('printButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
