'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Banknote, HandCoins, Coins, Gift, TrendingUp, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { dashboardService, FinancialSummaryResponse } from '@/services/dashboard.service';
import { useBranchChange } from '@/hooks/use-branch-change';

export function PendingItemsWidget() {
  const t = useTranslations('Dashboard');
  const locale = useLocale();
  const [data, setData] = useState<FinancialSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await dashboardService.getFinancialSummary();
      setData(response);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch financial summary:', err);
      setError(t('pending.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Refetch when branch changes
  useBranchChange(fetchData);

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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-amber-500" />
            {t('pending.title')}
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
            <Banknote className="h-5 w-5 text-amber-500" />
            {t('pending.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">{error || t('pending.noData')}</p>
        </CardContent>
      </Card>
    );
  }

  const items = [
    {
      title: t('pending.advances'),
      count: data.pendingAdvances.count,
      amount: data.pendingAdvances.totalAmount,
      icon: Banknote,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-100',
    },
    {
      title: t('pending.loans'),
      count: data.pendingLoans.count,
      amount: data.pendingLoans.totalAmount,
      icon: HandCoins,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-100',
    },
    {
      title: t('pending.installments'),
      count: data.outstandingInstallments.count,
      amount: data.outstandingInstallments.totalAmount,
      icon: Coins,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-100',
    },
    {
      title: t('pending.bonusCycles'),
      count: data.pendingBonusCycles.count,
      amount: data.pendingBonusCycles.totalAmount,
      icon: Gift,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-100',
    },
    {
      title: t('pending.salaryRaise'),
      count: data.pendingSalaryRaiseCycles.count,
      amount: data.pendingSalaryRaiseCycles.totalAmount,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-100',
    },
  ];

  const totalPending = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-amber-500" />
            {t('pending.title')}
          </CardTitle>
          {totalPending > 0 && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700">
              {totalPending} {t('pending.items')}
            </Badge>
          )}
        </div>
        <CardDescription>
          {t('pending.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={index}
              className={`flex items-center justify-between p-3 rounded-lg ${item.bgColor} border ${item.borderColor}`}
            >
              <div className="flex items-center gap-3">
                <item.icon className={`h-5 w-5 ${item.color}`} />
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.count > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {item.count} {t('pending.items')}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                {item.count > 0 ? (
                  <span className={`font-semibold ${item.color}`}>
                    {formatCurrency(item.amount)}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
