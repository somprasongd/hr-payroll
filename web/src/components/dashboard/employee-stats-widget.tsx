'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Users, UserPlus, UserMinus, Briefcase, Clock, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { dashboardService, EmployeeSummaryResponse } from '@/services/dashboard.service';
import { useBranchChange } from '@/hooks/use-branch-change';
import { useAuthStore } from '@/store/auth-store';

export function EmployeeStatsWidget() {
  const t = useTranslations('Dashboard');
  const { user } = useAuthStore();
  const [data, setData] = useState<EmployeeSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Timekeeper should not be able to click on stat cards
  const isTimekeeper = user?.role === 'timekeeper';

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await dashboardService.getEmployeeSummary();
      setData(response);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch employee summary:', err);
      setError(t('employeeStats.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Refetch when branch changes
  useBranchChange(fetchData);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="col-span-full">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">{error || t('employeeStats.noData')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = [
    {
      title: t('employeeStats.activeEmployees'),
      value: data.activeEmployees,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      href: '/employees',
    },
    {
      title: t('employeeStats.fullTime'),
      value: data.fullTimeCount,
      icon: Briefcase,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      href: '/employees?employeeType=FT',
    },
    {
      title: t('employeeStats.partTime'),
      value: data.partTimeCount,
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      href: '/employees?employeeType=PT',
    },
    {
      title: t('employeeStats.newThisMonth'),
      value: data.newThisMonth,
      icon: UserPlus,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
      subtitle: data.terminatedThisMonth > 0 ? `(-${data.terminatedThisMonth})` : undefined,
      subtitleIcon: UserMinus,
      href: '/employees?newThisMonth=true',
    },
  ];

  // Card content component to avoid duplication
  const StatCardContent = ({ stat }: { stat: typeof stats[0] }) => (
    <CardContent className="pt-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
          <div className="flex items-center gap-2">
            <div className="flex items-baseline gap-1">
              <p className="text-2xl font-bold">{stat.value.toLocaleString()}</p>
              {!isTimekeeper && <ExternalLink className="h-3 w-3 text-muted-foreground opacity-50" />}
            </div>
            {'subtitle' in stat && stat.subtitle && (
              <span className="text-sm text-red-500 flex items-center gap-1">
                {'subtitleIcon' in stat && stat.subtitleIcon && <stat.subtitleIcon className="h-3 w-3" />}
                {stat.subtitle}
              </span>
            )}
          </div>
        </div>
        <div className={`rounded-full p-3 ${stat.bgColor}`}>
          <stat.icon className={`h-5 w-5 ${stat.color}`} />
        </div>
      </div>
    </CardContent>
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        isTimekeeper ? (
          // Timekeeper: non-clickable card
          <Card key={index}>
            <StatCardContent stat={stat} />
          </Card>
        ) : (
          // Other roles: clickable card with link
          <Link key={index} href={stat.href}>
            <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group">
              <StatCardContent stat={stat} />
            </Card>
          </Link>
        )
      ))}
    </div>
  );
}
