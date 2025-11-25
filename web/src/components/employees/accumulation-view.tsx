import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Edit, Loader2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { accumulationService, AccumulationRecord } from '@/services/accumulation.service';
import { useAuthStore } from '@/store/auth-store';
import { AccumulationAdjustDialog } from './accumulation-adjust-dialog';

interface AccumulationViewProps {
  employeeId: string;
}

export function AccumulationView({ employeeId }: AccumulationViewProps) {
  const t = useTranslations('Accumulation');
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<AccumulationRecord[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [adjustDialog, setAdjustDialog] = useState<{
    open: boolean;
    type: string;
    year?: number;
    amount: number;
  }>({
    open: false,
    type: '',
    amount: 0,
  });

  const fetchAccumulations = async () => {
    try {
      setLoading(true);
      const response = await accumulationService.getAccumulations(employeeId);
      setRecords(response?.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccumulations();
  }, [employeeId]);

  const getAmount = (type: string, year?: number) => {
    const record = records.find(
      (r) => r.accumType === type && (year === undefined || r.accumYear === year)
    );
    return record?.amount || 0;
  };

  const handleAdjust = (type: string, year?: number) => {
    setAdjustDialog({
      open: true,
      type,
      year,
      amount: getAmount(type, year),
    });
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Select
          value={selectedYear.toString()}
          onValueChange={(v) => setSelectedYear(parseInt(v))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('selectYear')} />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Social Security */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('types.sso')} ({selectedYear})
            </CardTitle>
            {isAdmin && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleAdjust('sso', selectedYear)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getAmount('sso', selectedYear).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        {/* Tax */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('types.tax')} ({selectedYear})
            </CardTitle>
            {isAdmin && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleAdjust('tax', selectedYear)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getAmount('tax', selectedYear).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        {/* Provident Fund */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('types.pf')} ({t('lifetime')})
            </CardTitle>
            {isAdmin && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleAdjust('pf', undefined)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getAmount('pf', undefined).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mt-4">
        {/* Loan Outstanding */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('types.loan_outstanding')} ({t('lifetime')})
            </CardTitle>
            {isAdmin && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleAdjust('loan_outstanding', undefined)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getAmount('loan_outstanding', undefined).toLocaleString()}
            </div>
          </CardContent>
        </Card>

      </div>

      <AccumulationAdjustDialog
        open={adjustDialog.open}
        onOpenChange={(open) => setAdjustDialog((prev) => ({ ...prev, open }))}
        employeeId={employeeId}
        type={adjustDialog.type}
        year={adjustDialog.year}
        currentAmount={adjustDialog.amount}
        onSuccess={fetchAccumulations}
      />
    </div>
  );
}
