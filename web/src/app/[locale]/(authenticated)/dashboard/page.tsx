'use client';

import { useTranslations } from 'next-intl';
import { useState } from "react";

export default function DashboardPage() {
  const tMenu = useTranslations('Menu');
  const tDashboard = useTranslations('Dashboard');
  const [activeMenu] = useState('dashboard');

  return (
    <>
      <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6">
        {tMenu('dashboard')}
      </h1>
      
      <div className="bg-white rounded-lg border border-gray-200 p-6 md:p-12">
        <div className="text-center space-y-4">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
            {tDashboard('mainContentArea')}
          </h2>
          <p className="text-sm md:text-base text-gray-600 max-w-2xl mx-auto">
            {tDashboard('mainContentDescription')}
          </p>
          <p className="text-xs md:text-sm text-gray-500 max-w-2xl mx-auto">
            {tDashboard('mainContentExample')}
          </p>
        </div>
      </div>
    </>
  );
}
