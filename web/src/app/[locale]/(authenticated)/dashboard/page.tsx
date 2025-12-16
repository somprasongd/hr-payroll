'use client';

import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/store/auth-store';
import { ExpiringDocumentsWidget } from '@/components/dashboard/expiring-documents-widget';
import { LatestActivityWidget } from '@/components/dashboard/latest-activity-widget';

export default function DashboardPage() {
  const tMenu = useTranslations('Menu');
  const tDashboard = useTranslations('Dashboard');
  const { user } = useAuthStore();

  return (
    <>
      <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6">
        {tMenu('dashboard')}
      </h1>
      
      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        {/* Expiring Documents Widget */}
        <ExpiringDocumentsWidget />
        
        {/* Latest Activity Widget - Admin Only */}
        {user?.role === 'admin' && <LatestActivityWidget />}
      </div>
    </>
  );
}
