'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { CreditCard, Wallet, Receipt, Loader2, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { dashboardService, PayrollSummaryResponse } from '@/services/dashboard.service';

export function PayrollSummaryWidget() {
  const t = useTranslations('Dashboard');
  const locale = useLocale();
  const [data, setData] = useState<PayrollSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await dashboardService.getPayrollSummary();
      setData(response);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch payroll summary:', err);
      setError(t('payroll.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'THB',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatMonth = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-green-500" />
            {t('payroll.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-green-500" />
            {t('payroll.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">{error || t('payroll.noData')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-green-500" />
          {t('payroll.title')}
        </CardTitle>
        <CardDescription>
          {t('payroll.yearly', { year: data.year })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Latest Run */}
        {data.latestRun && (
          <div className="mb-4 p-4 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">{t('payroll.latestRun')}</span>
              <Badge variant={data.latestRun.status === 'approved' ? 'default' : 'secondary'} className="flex items-center gap-1">
                {data.latestRun.status === 'approved' ? (
                  <CheckCircle className="h-3 w-3" />
                ) : (
                  <Clock className="h-3 w-3" />
                )}
                {data.latestRun.status}
              </Badge>
            </div>
            <p className="text-lg font-bold text-green-700 mb-1">
              {formatMonth(data.latestRun.payrollMonthDate)}
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">{t('payroll.totalNetPay')}:</span>
                <p className="font-semibold">{formatCurrency(data.latestRun.totalNetPay)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t('payroll.employees')}:</span>
                <p className="font-semibold">{data.latestRun.employeeCount} {t('payroll.people')}</p>
              </div>
            </div>
          </div>
        )}

        {/* Yearly Totals */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-green-600" />
              <span className="text-sm">{t('payroll.totalNetPay')}</span>
            </div>
            <span className="font-bold text-green-700">{formatCurrency(data.yearlyTotals.totalNetPay)}</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-orange-600" />
              <span className="text-sm">{t('payroll.totalTax')}</span>
            </div>
            <span className="font-semibold text-orange-700">{formatCurrency(data.yearlyTotals.totalTax)}</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-blue-600" />
              <span className="text-sm">{t('payroll.totalSso')}</span>
            </div>
            <span className="font-semibold text-blue-700">{formatCurrency(data.yearlyTotals.totalSso)}</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-purple-600" />
              <span className="text-sm">{t('payroll.totalPf')}</span>
            </div>
            <span className="font-semibold text-purple-700">{formatCurrency(data.yearlyTotals.totalPf)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
