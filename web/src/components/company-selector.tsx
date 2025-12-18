'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Building2, ChevronRight } from 'lucide-react';
import { Company, Branch } from '@/store/tenant-store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CompanySelectorProps {
  open: boolean;
  companies: Company[];
  branches: Branch[];
  onSelect: (company: Company, branches: Branch[]) => void;
}

export function CompanySelector({ open, companies, branches, onSelect }: CompanySelectorProps) {
  const t = useTranslations('Tenant');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedBranches, setSelectedBranches] = useState<Branch[]>([]);
  const [step, setStep] = useState<'company' | 'branch'>('company');

  const handleCompanySelect = (company: Company) => {
    setSelectedCompany(company);
    
    // Filter branches for selected company
    const companyBranches = branches.filter(b => b.companyId === company.id);
    
    // If only one branch, auto-select and proceed
    if (companyBranches.length === 1) {
      onSelect(company, companyBranches);
      return;
    }
    
    // If multiple branches, show branch selection
    setSelectedBranches(companyBranches.filter(b => b.isDefault));
    setStep('branch');
  };

  // Single branch selection - only one branch can be selected at a time
  const handleBranchSelect = (branch: Branch) => {
    setSelectedBranches([branch]);
  };

  const handleConfirm = () => {
    if (selectedCompany && selectedBranches.length > 0) {
      onSelect(selectedCompany, selectedBranches);
    }
  };

  const companyBranches = selectedCompany 
    ? branches.filter(b => b.companyId === selectedCompany.id)
    : [];

  // If only one company, auto-select using useEffect to avoid setState during render
  useEffect(() => {
    if (companies.length === 1 && !selectedCompany) {
      handleCompanySelect(companies[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies, selectedCompany]);

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {step === 'company' ? t('selectCompany') : t('selectBranches')}
          </DialogTitle>
          <DialogDescription>
            {step === 'company' 
              ? t('selectCompanyDescription')
              : t('selectBranchDescription')
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {step === 'company' ? (
            // Company selection
            companies.map((company) => (
              <button
                key={company.id}
                onClick={() => handleCompanySelect(company)}
                className={cn(
                  "w-full flex items-center justify-between p-3 rounded-lg border transition-colors",
                  "hover:bg-accent hover:border-primary/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">{company.name}</div>
                    <div className="text-sm text-muted-foreground">{company.code}</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))
          ) : (
            // Branch selection
            companyBranches.map((branch) => {
              const isSelected = selectedBranches.some(b => b.id === branch.id);
              return (
                <button
                  key={branch.id}
                  onClick={() => handleBranchSelect(branch)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-lg border transition-colors",
                    isSelected 
                      ? "bg-primary/10 border-primary" 
                      : "hover:bg-accent"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-4 w-4 rounded-full border-2 flex items-center justify-center",
                      isSelected 
                        ? "border-primary" 
                        : "border-muted-foreground"
                    )}>
                      {isSelected && (
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <div className="text-left">
                      <div className="font-medium flex items-center gap-2">
                        {branch.name}
                        {branch.isDefault && (
                          <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                            {t('default')}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">{branch.code}</div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {step === 'branch' && (
          <div className="flex gap-2 pt-4">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => {
                setStep('company');
                setSelectedCompany(null);
                setSelectedBranches([]);
              }}
            >
              {t('back')}
            </Button>
            <Button 
              className="flex-1"
              onClick={handleConfirm}
              disabled={selectedBranches.length === 0}
            >
              {t('confirm')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
