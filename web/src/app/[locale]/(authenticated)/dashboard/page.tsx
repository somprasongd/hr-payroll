'use client';

import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/store/auth-store';
import { EmployeeStatsWidget } from '@/components/dashboard/employee-stats-widget';
import { AttendanceChartWidget } from '@/components/dashboard/attendance-chart-widget';
import { AttendanceLeaderboardWidget } from '@/components/dashboard/attendance-leaderboard-widget';
import { PayrollSummaryWidget } from '@/components/dashboard/payroll-summary-widget';
import { PendingItemsWidget } from '@/components/dashboard/pending-items-widget';
import { ExpiringDocumentsWidget } from '@/components/dashboard/expiring-documents-widget';
import { LatestActivityWidget } from '@/components/dashboard/latest-activity-widget';

export default function DashboardPage() {
  const tMenu = useTranslations('Menu');
  const { user } = useAuthStore();
  
  // Timekeeper should not see payroll, pending items, expiring docs, or activity widgets
  const isTimekeeper = user?.role === 'timekeeper';

  return (
    <>
      <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6">
        {tMenu('dashboard')}
      </h1>
      
      {/* Row 1: Employee Stats */}
      <div className="mb-6">
        <EmployeeStatsWidget />
      </div>
      
      {/* Row 2: Attendance Chart */}
      <div className="mb-6">
        <AttendanceChartWidget />
      </div>
      
      {/* Row 3: Attendance Leaderboard */}
      <div className="mb-6">
        <AttendanceLeaderboardWidget />
      </div>
      
      {/* Row 4: Payroll Summary | Pending Items - hidden for timekeeper */}
      {!isTimekeeper && (
        <div className="grid gap-4 md:gap-6 lg:grid-cols-2 mb-6">
          <PayrollSummaryWidget />
          <PendingItemsWidget />
        </div>
      )}
      
      {/* Row 5: Expiring Documents | Latest Activity - hidden for timekeeper */}
      {!isTimekeeper && (
        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
          <ExpiringDocumentsWidget />
          {user?.role === 'admin' && <LatestActivityWidget />}
        </div>
      )}
    </>
  );
}
