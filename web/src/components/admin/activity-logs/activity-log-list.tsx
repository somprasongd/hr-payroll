'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { GenericDataTable } from '@/components/common/generic-data-table';
import { activityLogService, ActivityLog, FilterOptions } from '@/services/activity-log.service';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Eye } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { subDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface ActivityLogListProps {
  showFilters?: boolean;
}

export function ActivityLogList({ showFilters = false }: ActivityLogListProps) {
  const t = useTranslations('ActivityLog');
  const { toast } = useToast();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const LIMIT = 10;
  
  // Filter options from API
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ actions: [], entities: [] });
  
  // Filter State
  const [filters, setFilters] = useState({
    fromDate: format(subDays(new Date(), 3), 'yyyy-MM-dd'),
    toDate: format(new Date(), 'yyyy-MM-dd'),
    userName: '',
    action: 'ALL',
    entity: 'ALL'
  });

  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  const fetchFilterOptions = async () => {
    try {
      const options = await activityLogService.getFilterOptions();
      setFilterOptions(options);
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
    }
  };

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const params: any = {
        page: currentPage,
        limit: LIMIT,
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        userName: filters.userName,
      };
      
      if (filters.action !== 'ALL') params.action = filters.action;
      if (filters.entity !== 'ALL') params.entity = filters.entity;

      const response = await activityLogService.getLogs(params);
      setLogs(response.data);
      setTotalPages(Math.ceil((response.meta.total || 0) / LIMIT) || 1);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch activity logs',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [currentPage]); // triggering fetch on page change

  const handleSearch = () => {
      setCurrentPage(1);
      fetchLogs();
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const columns = [
    {
      id: 'createdAt',
      header: t('fields.timestamp'),
      accessorFn: (row: ActivityLog) => row.createdAt,
      cell: (info: any) => format(new Date(info.getValue()), 'dd/MM/yyyy HH:mm:ss'),
    },
    {
      id: 'userName',
      header: t('fields.user'),
      accessorFn: (row: ActivityLog) => row.userName,
    },
    {
      id: 'action',
      header: t('fields.action'),
      accessorFn: (row: ActivityLog) => row.action,
      cell: (info: any) => {
        const val = info.getValue() as string;
        let variant = 'default';
        if (val === 'CREATE') variant = 'default';
        if (val === 'UPDATE') variant = 'secondary';
        if (val === 'DELETE') variant = 'destructive';
        return <Badge variant={variant as any}>{val}</Badge>;
      },
    },
    {
      id: 'entity',
      header: t('fields.entity'),
      accessorFn: (row: ActivityLog) => row.entity,
      cell: (info: any) => <Badge variant="outline">{info.getValue()}</Badge>,
    },
    {
        id: 'entityId',
        header: 'ID',
        accessorFn: (row: ActivityLog) => row.entityId,
        cell: (info: any) => <span className="text-xs text-muted-foreground">{info.getValue().substring(0, 8)}...</span>
    }
  ];

  const actions = [
      {
          label: t('actions.viewDetails'),
          icon: <Eye className="h-4 w-4" />,
          onClick: (log: ActivityLog) => setSelectedLog(log)
      }
  ];

  return (
    <div className="space-y-4">
      <div className={cn(
          "flex flex-wrap gap-4 items-end bg-white p-4 rounded-lg border shadow-sm transition-all",
          !showFilters && "hidden md:flex"
      )}>
        <div className="grid w-full max-w-sm items-center gap-1.5">
            <label className="text-sm font-medium">{t('filters.dateRange')}</label>
            <div className="flex gap-2">
                <Input 
                    type="date" 
                    value={filters.fromDate} 
                    onChange={(e) => setFilters({...filters, fromDate: e.target.value})}
                    className="w-[140px]"
                />
                <span className="self-center">-</span>
                <Input 
                    type="date" 
                    value={filters.toDate} 
                    onChange={(e) => setFilters({...filters, toDate: e.target.value})}
                    className="w-[140px]"
                />
            </div>
        </div>

        <div className="grid w-full max-w-[200px] items-center gap-1.5">
             <label className="text-sm font-medium">{t('filters.user')}</label>
             <Input 
                placeholder={t('filters.userPlaceholder')} 
                value={filters.userName}
                onChange={(e) => setFilters({...filters, userName: e.target.value})}
             />
        </div>

        <div className="grid w-full max-w-[150px] items-center gap-1.5">
            <label className="text-sm font-medium">{t('filters.action')}</label>
            <Select value={filters.action} onValueChange={(val) => setFilters({...filters, action: val})}>
                <SelectTrigger>
                    <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ALL">{t('filters.all')}</SelectItem>
                    {filterOptions.actions.map((action) => (
                      <SelectItem key={action} value={action}>{action}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>

        <div className="grid w-full max-w-[200px] items-center gap-1.5">
            <label className="text-sm font-medium">{t('filters.entity')}</label>
             <Select value={filters.entity} onValueChange={(val) => setFilters({...filters, entity: val})}>
                <SelectTrigger>
                    <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ALL">{t('filters.all')}</SelectItem>
                    {filterOptions.entities.map((entity) => (
                      <SelectItem key={entity} value={entity}>{entity}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>

        <Button onClick={handleSearch}>{t('actions.search')}</Button>
      </div>

      <GenericDataTable
        data={logs}
        columns={columns}
        loading={isLoading}
        emptyStateText={t('noData')}
        actions={actions}
        pagination={{
            currentPage,
            totalPages,
            onPageChange: handlePageChange
        }}
      />
      
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-xl">
             <DialogHeader>
                <DialogTitle>{t('detailsTitle')}</DialogTitle>
                <DialogDescription>
                    {selectedLog && `${selectedLog.action} on ${selectedLog.entity}`}
                </DialogDescription>
             </DialogHeader>
             <div className="max-h-[60vh] overflow-y-auto bg-slate-100 p-4 rounded-md">
                <pre className="text-sm whitespace-pre-wrap">
                    {selectedLog && JSON.stringify(selectedLog.details, null, 2)}
                </pre>
             </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
