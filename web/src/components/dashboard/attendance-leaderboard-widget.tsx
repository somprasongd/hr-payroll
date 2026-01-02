'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Trophy, Loader2, Clock, Calendar, Clock3, AlertTriangle, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { dashboardService, TopEmployeeDTO, AttendanceTopEmployeesResponse } from '@/services/dashboard.service';
import { EmployeeTypeBadge } from '@/components/common/employee-type-badge';
import { EmployeePhoto } from '@/components/common/employee-photo';

export function AttendanceLeaderboardWidget() {
  const t = useTranslations('Dashboard');
  const tCommon = useTranslations('Common');
  const locale = useLocale();
  
  const [data, setData] = useState<AttendanceTopEmployeesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter state
  const [periodType, setPeriodType] = useState<'month' | 'year'>('month');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const date = new Date(2000, i, 1);
      return {
        value: i + 1,
        label: date.toLocaleDateString(locale, { month: 'long' }),
      };
    });
  }, [locale]);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 11 }, (_, i) => currentYear - i);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await dashboardService.getAttendanceTopEmployees({
        periodType,
        year: selectedYear,
        month: periodType === 'month' ? selectedMonth : undefined,
        limit: 10,
      });
      setData(response);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch attendance top employees:', err);
      setError(t('attendance.error'));
    } finally {
      setLoading(false);
    }
  }, [t, periodType, selectedYear, selectedMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const renderEmployeeList = (employees: TopEmployeeDTO[], unit: string) => {
    if (!employees || employees.length === 0) {
      return (
        <p className="text-sm text-muted-foreground text-center py-4">
          {t('attendance.noData')}
        </p>
      );
    }

    return (
      <div className="space-y-2">
        {employees.map((emp, index) => (
          <div
            key={emp.employeeId}
            className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
          >
            <span className="w-6 text-center font-bold text-muted-foreground text-sm">
              {index + 1}
            </span>
            <EmployeeTypeBadge typeName="พนักงานประจำ" />
            <EmployeePhoto
              photoId={emp.photoId || undefined}
              firstName={emp.fullName.split(' ')[0] || ''}
              lastName={emp.fullName.split(' ')[1] || ''}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {emp.employeeNumber} - {emp.fullName}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">
                {emp.total.toFixed(unit === t('attendance.count') ? 0 : 1)}
              </p>
              <p className="text-xs text-muted-foreground">{unit}</p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Top 10 สถิติการมาทำงาน
            </CardTitle>
          </div>
          
          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Period type selector */}
            <Select
              value={periodType}
              onValueChange={(v) => setPeriodType(v as 'month' | 'year')}
            >
              <SelectTrigger className="w-[120px]" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">รายเดือน</SelectItem>
                <SelectItem value="year">รายปี</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Month selector (only when periodType is month) */}
            {periodType === 'month' && (
              <Select
                value={selectedMonth.toString()}
                onValueChange={(v) => setSelectedMonth(parseInt(v))}
              >
                <SelectTrigger className="w-[140px]" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={m.value.toString()}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {/* Year selector */}
            <Select
              value={selectedYear.toString()}
              onValueChange={(v) => setSelectedYear(parseInt(v))}
            >
              <SelectTrigger className="w-[100px]" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {error}
          </p>
        ) : (
          <Tabs defaultValue="late">
            <TabsList className="grid w-full grid-cols-5 mb-4">
              <TabsTrigger value="late" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                มาสาย
              </TabsTrigger>
              <TabsTrigger value="leaveDay" className="text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                ลา(วัน)
              </TabsTrigger>
              <TabsTrigger value="leaveDouble" className="text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                ลา(2แรง)
              </TabsTrigger>
              <TabsTrigger value="leaveHours" className="text-xs">
                <Clock3 className="h-3 w-3 mr-1" />
                ลา(ชม)
              </TabsTrigger>
              <TabsTrigger value="ot" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                OT
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="late">
              {renderEmployeeList(data?.late || [], t('attendance.minutes'))}
            </TabsContent>
            <TabsContent value="leaveDay">
              {renderEmployeeList(data?.leaveDay || [], t('attendance.days'))}
            </TabsContent>
            <TabsContent value="leaveDouble">
              {renderEmployeeList(data?.leaveDouble || [], t('attendance.days'))}
            </TabsContent>
            <TabsContent value="leaveHours">
              {renderEmployeeList(data?.leaveHours || [], t('attendance.hours'))}
            </TabsContent>
            <TabsContent value="ot">
              {renderEmployeeList(data?.ot || [], t('attendance.hours'))}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
