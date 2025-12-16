'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { activityLogService, ActivityLog } from '@/services/activity-log.service';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';

export function LatestActivityWidget() {
  const t = useTranslations('ActivityLog');
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLatest = async () => {
      try {
        const response = await activityLogService.getLatestLogs(5);
        setLogs(response.data || []);
      } catch (error) {
        console.error('Failed to fetch latest activity:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLatest();
  }, []);

  return (
    <Card className="col-span-1 h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">
          {t('title')}
        </CardTitle>
        <Button variant="ghost" size="sm" asChild className="h-8 px-2 lg:px-3 text-xs">
            <Link href="/admin/activity-logs">
              View All <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t('noData')}</p>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <div key={log.id} className="flex flex-col space-y-1 border-b pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{log.userName}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(log.createdAt), 'MMM d, HH:mm')}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                     <Badge variant={log.action === 'DELETE' ? 'destructive' : log.action === 'UPDATE' ? 'secondary' : 'default'} className="px-1 py-0 text-[10px]">
                        {log.action}
                     </Badge>
                     <span className="text-muted-foreground">on {log.entity}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
