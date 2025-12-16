'use client';

import { useTranslations } from 'next-intl';
import { ExpiringDocumentsWidget } from '@/components/dashboard/expiring-documents-widget';

export default function DashboardPage() {
  const tMenu = useTranslations('Menu');
  const tDashboard = useTranslations('Dashboard');

  return (
    <>
      <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6">
        {tMenu('dashboard')}
      </h1>
      
      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        {/* Expiring Documents Widget */}
        <ExpiringDocumentsWidget />
        
        {/* Placeholder for more widgets */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-center space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">
              {tDashboard('mainContentArea')}
            </h2>
            <p className="text-sm text-gray-600 max-w-2xl mx-auto">
              {tDashboard('mainContentDescription')}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
