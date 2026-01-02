"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  TrendingUp,
  Clock,
  Calendar,
  AlertTriangle,
  Loader2,
  Clock3,
  Users,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  dashboardService,
  AttendanceSummaryResponse,
} from "@/services/dashboard.service";
import { employeeService, Employee } from "@/services/employee.service";
import { EmployeeSelector } from "@/components/common/employee-selector";

export function AttendanceChartWidget() {
  const t = useTranslations("Dashboard");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const [data, setData] = useState<AttendanceSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"late" | "leave" | "ot">("late");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
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
    const startDate = new Date(selectedYear, 0, 1); // Jan 1
    const endDate = new Date(selectedYear, 11, 31); // Dec 31
    return {
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
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
    return data.breakdown.map((item) => ({
      period: formatMonth(item.period),
      lateCount: item.lateCount,
      lateMinutes: item.lateMinutes,
      leaveDays: item.leaveDays,
      leaveDoubleDays: item.leaveDoubleDays,
      leaveHours: item.leaveHours,
      otCount: item.otCount,
      otHours: item.otHours,
    }));
  }, [data, locale]);

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
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100">
            <Clock className="h-6 w-6 text-red-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">
                {t("attendance.late")}
              </p>
              <p className="text-sm font-bold text-red-600">
                {data.totals.lateCount} {t("attendance.count")}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.totals.lateMinutes.toFixed(0)} {t("attendance.minutes")}
              </p>
            </div>
          </div>
          {/* Leave Day */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-100">
            <Calendar className="h-6 w-6 text-yellow-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">
                {t("attendance.leaveDay")}
              </p>
              <p className="text-sm font-bold text-yellow-700">
                {data.totals.leaveDays.toFixed(1)} {t("attendance.days")}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.totals.leaveDayCount} {t("attendance.count")}
              </p>
            </div>
          </div>
          {/* Leave Double */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-50 border border-orange-100">
            <Calendar className="h-6 w-6 text-orange-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">
                {t("attendance.leaveDouble")}
              </p>
              <p className="text-sm font-bold text-orange-700">
                {data.totals.leaveDoubleDays.toFixed(1)} {t("attendance.days")}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.totals.leaveDoubleCount} {t("attendance.count")}
              </p>
            </div>
          </div>
          {/* Leave Hours */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100">
            <Clock3 className="h-6 w-6 text-amber-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">
                {t("attendance.leaveHours")}
              </p>
              <p className="text-sm font-bold text-amber-700">
                {data.totals.leaveHours.toFixed(1)} {t("attendance.hours")}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.totals.leaveHoursCount} {t("attendance.count")}
              </p>
            </div>
          </div>
          {/* OT */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100">
            <AlertTriangle className="h-6 w-6 text-blue-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">
                {t("attendance.ot")}
              </p>
              <p className="text-sm font-bold text-blue-600">
                {data.totals.otHours.toFixed(1)} {t("attendance.hours")}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.totals.otCount} {t("attendance.count")}
              </p>
            </div>
          </div>
        </div>

        {/* Chart */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "late" | "leave" | "ot")}
        >
          <TabsList className="mb-4">
            <TabsTrigger value="late">{t("attendance.late")}</TabsTrigger>
            <TabsTrigger value="leave">{t("attendance.leaveDay")}</TabsTrigger>
            <TabsTrigger value="ot">{t("attendance.ot")}</TabsTrigger>
          </TabsList>

          <div className="h-[300px] w-full">
            {activeTab === "late" && (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="lateCount"
                    name={t("attendance.count")}
                    fill="#ef4444"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}

            {activeTab === "leave" && (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="leaveDays"
                    name={t("attendance.leaveDay")}
                    fill="#eab308"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="leaveDoubleDays"
                    name={t("attendance.leaveDouble")}
                    fill="#f97316"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="leaveHours"
                    name={t("attendance.leaveHours")}
                    fill="#d97706"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}

            {activeTab === "ot" && (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="otHours"
                    name={t("attendance.hours")}
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Tabs>
      </>
    )}
  </CardContent>
</Card>
  );
}
