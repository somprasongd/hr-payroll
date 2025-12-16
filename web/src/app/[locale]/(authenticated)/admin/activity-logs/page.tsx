'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ActivityLogList } from '@/components/admin/activity-logs/activity-log-list';
import { Button } from '@/components/ui/button';
import { Filter } from 'lucide-react';

export default function ActivityLogsPage() {
  const t = useTranslations('ActivityLog');
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground hidden sm:block">
            {t('description')}
          </p>
        </div>
        <div>
          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ActivityLogList showFilters={showFilters} />
    </div>
  );
}
