"use client";

import { EmployeeSelector } from "@/components/common/employee-selector";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBranchChange } from '@/hooks/use-branch-change';
import { Link } from '@/i18n/routing';
import {
  AttendanceSummaryResponse,
  dashboardService,
} from "@/services/dashboard.service";
import { Employee, employeeService } from "@/services/employee.service";
import { format, startOfYear, endOfYear } from "date-fns";
import {
  AlertTriangle,
  Calendar,
  Clock,
  Clock3,
  Loader2,
  TrendingUp,
  Users,
  BarChart3,
  LineChart,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart,
  Line,
} from "recharts";

export function AttendanceChartWidget() {
  const t = useTranslations("Dashboard");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const [data, setData] = useState<AttendanceSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "late" | "leave" | "ot">("overview");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [chartView, setChartView] = useState<"line" | "bar">("bar");
  
  // Employee filter state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  // Fetch FT employees on mount
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoadingEmployees(true);
        const response = await employeeService.getEmployees({ 
          status: 'active', 
          employeeTypeCode: 'full_time',
          limit: 1000,
        });
        setEmployees(response.data);
      } catch (err) {
        console.error("Failed to fetch employees:", err);
      } finally {
        setLoadingEmployees(false);
      }
    };
    fetchEmployees();
  }, []);

  // Get date range for selected year
  const dateRange = useMemo(() => {
    const yearDate = new Date(selectedYear, 0, 1);
    return {
      startDate: format(startOfYear(yearDate), 'yyyy-MM-dd'),
      endDate: format(endOfYear(yearDate), 'yyyy-MM-dd'),
    };
  }, [selectedYear]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await dashboardService.getAttendanceSummary({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        groupBy: "month",
        employeeId: selectedEmployeeId || undefined,
      });
      setData(response);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch attendance summary:", err);
      setError(t("attendance.error"));
    } finally {
      setLoading(false);
    }
  }, [t, dateRange, selectedEmployeeId]);

  // Refetch when branch changes
  useBranchChange(fetchData);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatMonth = (period: string) => {
    const [year, month] = period.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString(locale, { month: "short" });
  };

  const chartData = useMemo(() => {
    if (!data) return [];
    // Filter only months from selected year and sort by month
    return data.breakdown
      .filter((item) => {
        const [year] = item.period.split("-");
        return parseInt(year) === selectedYear;
      })
      .sort((a, b) => {
        const [, monthA] = a.period.split("-");
        const [, monthB] = b.period.split("-");
        return parseInt(monthA) - parseInt(monthB);
      })
      .map((item) => ({
        period: formatMonth(item.period),
        lateCount: item.lateCount,
        lateMinutes: item.lateMinutes,
        leaveDays: item.leaveDays,
        leaveDoubleDays: item.leaveDoubleDays,
        leaveHours: item.leaveHours,
        otCount: item.otCount,
        otHours: item.otHours,
      }));
  }, [data, locale, selectedYear]);

  // Calculate totals from filtered breakdown (to match chart data)
  const filteredTotals = useMemo(() => {
    if (!data) return null;
    
    const filteredBreakdown = data.breakdown.filter((item) => {
      const [year] = item.period.split("-");
      return parseInt(year) === selectedYear;
    });

    return {
      lateCount: filteredBreakdown.reduce((sum, item) => sum + item.lateCount, 0),
      lateMinutes: filteredBreakdown.reduce((sum, item) => sum + item.lateMinutes, 0),
      leaveDays: filteredBreakdown.reduce((sum, item) => sum + item.leaveDays, 0),
      leaveDayCount: filteredBreakdown.reduce((sum, item) => sum + item.leaveDayCount, 0),
      leaveDoubleDays: filteredBreakdown.reduce((sum, item) => sum + item.leaveDoubleDays, 0),
      leaveDoubleCount: filteredBreakdown.reduce((sum, item) => sum + item.leaveDoubleCount, 0),
      leaveHours: filteredBreakdown.reduce((sum, item) => sum + item.leaveHours, 0),
      leaveHoursCount: filteredBreakdown.reduce((sum, item) => sum + item.leaveHoursCount, 0),
      otCount: filteredBreakdown.reduce((sum, item) => sum + item.otCount, 0),
      otHours: filteredBreakdown.reduce((sum, item) => sum + item.otHours, 0),
    };
  }, [data, selectedYear]);

  // Build URL for entry type card link
  const buildEntryTypeLink = (entryType: string) => {
    const yearDate = new Date(selectedYear, 0, 1);
    const startDate = format(startOfYear(yearDate), 'yyyy-MM-dd');
    const endDate = format(endOfYear(yearDate), 'yyyy-MM-dd');
    
    const params = new URLSearchParams();
    if (selectedEmployeeId) {
      params.set('employeeId', selectedEmployeeId);
    }
    params.set('entryType', entryType);
    params.set('startDate', startDate);
    params.set('endDate', endDate);
    
    return `/worklogs/ft?${params.toString()}`;
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4">
          {/* Title row with year selector */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                {t("attendance.title")}
              </CardTitle>
              <CardDescription>
                {t("attendance.yearlyOverview", { year: selectedYear })}
              </CardDescription>
            </div>
            <Select
              value={selectedYear.toString()}
              onValueChange={(v) => setSelectedYear(parseInt(v))}
            >
              <SelectTrigger className="w-[120px]" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Employee filter row */}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground shrink-0" />
            {loadingEmployees ? (
              <div className="flex-1 flex items-center justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <EmployeeSelector
                employees={employees}
                selectedEmployeeId={selectedEmployeeId}
                onSelect={setSelectedEmployeeId}
                placeholder={tCommon("all")}
                filterType="ft"
              />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error || !data ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {error || t("attendance.noData")}
          </p>
        ) : (
          <>
            {/* Summary Cards - 5 cards now */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-5 mb-6">
          {/* Late */}
          <Link 
            href={buildEntryTypeLink('late')}
            className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100 hover:bg-red-100 hover:border-red-200 transition-colors cursor-pointer"
          >
            <Clock className="h-6 w-6 text-red-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">
                {t("attendance.late")}
              </p>
              <p className="text-sm font-bold text-red-600 flex items-center gap-1">
                {filteredTotals?.lateMinutes.toFixed(0) ?? 0} {t("attendance.minutes")}
                <ExternalLink className="h-3 w-3 opacity-50" />
              </p>
              <p className="text-xs text-muted-foreground">
                {filteredTotals?.lateCount ?? 0} {t("attendance.count")}
              </p>
            </div>
          </Link>
          {/* Leave Day */}
          <Link 
            href={buildEntryTypeLink('leave_day')}
            className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-100 hover:bg-yellow-100 hover:border-yellow-200 transition-colors cursor-pointer"
          >
            <Calendar className="h-6 w-6 text-yellow-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">
                {t("attendance.leaveDay")}
              </p>
              <p className="text-sm font-bold text-yellow-700 flex items-center gap-1">
                {filteredTotals?.leaveDays.toFixed(1) ?? 0} {t("attendance.days")}
                <ExternalLink className="h-3 w-3 opacity-50" />
              </p>
              <p className="text-xs text-muted-foreground">
                {filteredTotals?.leaveDayCount ?? 0} {t("attendance.count")}
              </p>
            </div>
          </Link>
          {/* Leave Double */}
          <Link 
            href={buildEntryTypeLink('leave_double')}
            className="flex items-center gap-2 p-3 rounded-lg bg-orange-50 border border-orange-100 hover:bg-orange-100 hover:border-orange-200 transition-colors cursor-pointer"
          >
            <Calendar className="h-6 w-6 text-orange-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">
                {t("attendance.leaveDouble")}
              </p>
              <p className="text-sm font-bold text-orange-700 flex items-center gap-1">
                {filteredTotals?.leaveDoubleDays.toFixed(1) ?? 0} {t("attendance.days")}
                <ExternalLink className="h-3 w-3 opacity-50" />
              </p>
              <p className="text-xs text-muted-foreground">
                {filteredTotals?.leaveDoubleCount ?? 0} {t("attendance.count")}
              </p>
            </div>
          </Link>
          {/* Leave Hours */}
          <Link 
            href={buildEntryTypeLink('leave_hours')}
            className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100 hover:bg-amber-100 hover:border-amber-200 transition-colors cursor-pointer"
          >
            <Clock3 className="h-6 w-6 text-amber-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">
                {t("attendance.leaveHours")}
              </p>
              <p className="text-sm font-bold text-amber-700 flex items-center gap-1">
                {filteredTotals?.leaveHours.toFixed(1) ?? 0} {t("attendance.hours")}
                <ExternalLink className="h-3 w-3 opacity-50" />
              </p>
              <p className="text-xs text-muted-foreground">
                {filteredTotals?.leaveHoursCount ?? 0} {t("attendance.count")}
              </p>
            </div>
          </Link>
          {/* OT */}
          <Link 
            href={buildEntryTypeLink('ot')}
            className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100 hover:bg-blue-100 hover:border-blue-200 transition-colors cursor-pointer"
          >
            <AlertTriangle className="h-6 w-6 text-blue-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">
                {t("attendance.ot")}
              </p>
              <p className="text-sm font-bold text-blue-600 flex items-center gap-1">
                {filteredTotals?.otHours.toFixed(1) ?? 0} {t("attendance.hours")}
                <ExternalLink className="h-3 w-3 opacity-50" />
              </p>
              <p className="text-xs text-muted-foreground">
                {filteredTotals?.otCount ?? 0} {t("attendance.count")}
              </p>
            </div>
          </Link>
        </div>

        {/* Chart */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "overview" | "late" | "leave" | "ot")}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <TabsList className="w-full sm:w-auto h-auto p-1 grid grid-cols-2 sm:flex sm:h-9">
              <TabsTrigger value="overview" className="text-xs sm:text-sm">{t("attendance.overview")}</TabsTrigger>
              <TabsTrigger value="late" className="text-xs sm:text-sm">{t("attendance.late")}</TabsTrigger>
              <TabsTrigger value="leave" className="text-xs sm:text-sm">{t("attendance.leave")}</TabsTrigger>
              <TabsTrigger value="ot" className="text-xs sm:text-sm">{t("attendance.ot")}</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg self-end sm:self-auto">
              <button
                onClick={() => setChartView("bar")}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] sm:text-xs font-medium transition-all",
                  chartView === "bar" 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:bg-background/50"
                )}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                {tCommon("barChart")}
              </button>
              <button
                onClick={() => setChartView("line")}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] sm:text-xs font-medium transition-all",
                  chartView === "line" 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:bg-background/50"
                )}
              >
                <LineChart className="h-3.5 w-3.5" />
                {tCommon("lineChart")}
              </button>
            </div>
          </div>

          <div className="w-full overflow-x-auto pb-4 scrollbar-hide sm:scrollbar-default">
            <div className="h-[300px] min-w-[600px] sm:min-w-0">
              {activeTab === "overview" && (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis yAxisId="left" fontSize={12} />
                    <YAxis 
                      yAxisId="right" 
                      orientation="right" 
                      fontSize={12} 
                    />
                    <Tooltip />
                    <Legend />
                    {chartView === "line" ? (
                      <>
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="leaveDays"
                          name={`${t("attendance.leave")} (แกนซ้าย)`}
                          stroke="#eab308"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="leaveDoubleDays"
                          name={`${t("attendance.leaveDouble")} (แกนซ้าย)`}
                          stroke="#f97316"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="leaveHours"
                          name={`${t("attendance.leaveHours")} (แกนขวา)`}
                          stroke="#d97706"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="lateMinutes"
                          name={`${t("attendance.late")} (แกนขวา)`}
                          stroke="#ef4444"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="otHours"
                          name={`${t("attendance.ot")} (แกนขวา)`}
                          stroke="#3b82f6"
                          strokeWidth={3}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </>
                    ) : (
                      <>
                        <Bar
                          yAxisId="left"
                          dataKey="leaveDays"
                          name={`${t("attendance.leave")} (แกนซ้าย)`}
                          fill="#eab308"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          yAxisId="left"
                          dataKey="leaveDoubleDays"
                          name={`${t("attendance.leaveDouble")} (แกนซ้าย)`}
                          fill="#f97316"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          yAxisId="right"
                          dataKey="leaveHours"
                          name={`${t("attendance.leaveHours")} (แกนขวา)`}
                          fill="#d97706"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          yAxisId="right"
                          dataKey="lateMinutes"
                          name={`${t("attendance.late")} (แกนขวา)`}
                          fill="#ef4444"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          yAxisId="right"
                          dataKey="otHours"
                          name={`${t("attendance.ot")} (แกนขวา)`}
                          fill="#3b82f6"
                          radius={[4, 4, 0, 0]}
                        />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}

              {activeTab === "late" && (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {chartView === "bar" ? (
                      <Bar
                        dataKey="lateMinutes"
                        name={t("attendance.minutes")}
                        fill="#ef4444"
                        radius={[4, 4, 0, 0]}
                      />
                    ) : (
                      <Line
                        type="monotone"
                        dataKey="lateMinutes"
                        name={t("attendance.minutes")}
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}

              {activeTab === "leave" && (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis yAxisId="left" fontSize={12} />
                    <YAxis 
                      yAxisId="right" 
                      orientation="right" 
                      fontSize={12} 
                    />
                    <Tooltip />
                    <Legend />
                    {chartView === "bar" ? (
                      <>
                        <Bar
                          yAxisId="left"
                          dataKey="leaveDays"
                          name={`${t("attendance.leaveDay")} (แกนซ้าย)`}
                          fill="#eab308"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          yAxisId="left"
                          dataKey="leaveDoubleDays"
                          name={`${t("attendance.leaveDouble")} (แกนซ้าย)`}
                          fill="#f97316"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          yAxisId="right"
                          dataKey="leaveHours"
                          name={`${t("attendance.leaveHours")} (แกนขวา)`}
                          fill="#d97706"
                          radius={[4, 4, 0, 0]}
                        />
                      </>
                    ) : (
                      <>
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="leaveDays"
                          name={`${t("attendance.leaveDay")} (แกนซ้าย)`}
                          stroke="#eab308"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="leaveDoubleDays"
                          name={`${t("attendance.leaveDouble")} (แกนซ้าย)`}
                          stroke="#f97316"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="leaveHours"
                          name={`${t("attendance.leaveHours")} (แกนขวา)`}
                          stroke="#d97706"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}

              {activeTab === "ot" && (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {chartView === "bar" ? (
                      <Bar
                        dataKey="otHours"
                        name={t("attendance.hours")}
                        fill="#3b82f6"
                        radius={[4, 4, 0, 0]}
                      />
                    ) : (
                      <Line
                        type="monotone"
                        dataKey="otHours"
                        name={t("attendance.hours")}
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </Tabs>
      </>
    )}
  </CardContent>
</Card>
  );
}
