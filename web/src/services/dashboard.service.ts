import { apiClient } from '@/lib/api-client';

// Employee Summary
export interface EmployeeSummaryResponse {
  totalEmployees: number;
  activeEmployees: number;
  fullTimeCount: number;
  partTimeCount: number;
  newThisMonth: number;
  terminatedThisMonth: number;
  byDepartment: DepartmentCount[];
}

export interface DepartmentCount {
  departmentId: string | null;
  departmentName: string;
  count: number;
}

// Attendance Summary
export interface AttendanceTotals {
  lateCount: number;
  lateMinutes: number;
  leaveDayCount: number;
  leaveDays: number;
  leaveHoursCount: number;
  leaveHours: number;
  leaveDoubleCount: number;
  leaveDoubleDays: number;
  otCount: number;
  otHours: number;
}

export interface AttendanceBreakdown {
  period: string;
  lateCount: number;
  lateMinutes: number;
  leaveDayCount: number;
  leaveDays: number;
  leaveHoursCount: number;
  leaveHours: number;
  leaveDoubleCount: number;
  leaveDoubleDays: number;
  otCount: number;
  otHours: number;
}

export interface AttendanceSummaryResponse {
  period: {
    startDate: string;
    endDate: string;
  };
  totals: AttendanceTotals;
  breakdown: AttendanceBreakdown[];
}

// Payroll Summary
export interface LatestRunDTO {
  id: string;
  payrollMonthDate: string;
  status: string;
  totalNetPay: number;
  totalTax: number;
  totalSso: number;
  totalPf: number;
  employeeCount: number;
}

export interface YearlyTotalsDTO {
  totalNetPay: number;
  totalTax: number;
  totalSso: number;
  totalPf: number;
}

export interface MonthlyBreakdownDTO {
  month: string;
  netPay: number;
  tax: number;
  sso: number;
  pf: number;
}

export interface PayrollSummaryResponse {
  year: number;
  latestRun: LatestRunDTO | null;
  yearlyTotals: YearlyTotalsDTO;
  monthlyBreakdown: MonthlyBreakdownDTO[];
}

// Financial Summary
export interface PendingItemDTO {
  count: number;
  totalAmount: number;
}

export interface FinancialSummaryResponse {
  pendingAdvances: PendingItemDTO;
  pendingLoans: PendingItemDTO;
  outstandingInstallments: PendingItemDTO;
  pendingBonusCycles: PendingItemDTO;
  pendingSalaryRaiseCycles: PendingItemDTO;
}

export const dashboardService = {
  getEmployeeSummary: async (): Promise<EmployeeSummaryResponse> => {
    return apiClient.get<EmployeeSummaryResponse>('/dashboard/employee-summary');
  },

  getAttendanceSummary: async (params: {
    startDate: string;
    endDate: string;
    groupBy?: 'month' | 'day';
    departmentId?: string;
    employeeId?: string;
  }): Promise<AttendanceSummaryResponse> => {
    const query = new URLSearchParams();
    query.append('startDate', params.startDate);
    query.append('endDate', params.endDate);
    if (params.groupBy) query.append('groupBy', params.groupBy);
    if (params.departmentId) query.append('departmentId', params.departmentId);
    if (params.employeeId) query.append('employeeId', params.employeeId);
    
    return apiClient.get<AttendanceSummaryResponse>(`/dashboard/attendance-summary?${query.toString()}`);
  },

  getPayrollSummary: async (year?: number): Promise<PayrollSummaryResponse> => {
    const query = year ? `?year=${year}` : '';
    return apiClient.get<PayrollSummaryResponse>(`/dashboard/payroll-summary${query}`);
  },

  getFinancialSummary: async (): Promise<FinancialSummaryResponse> => {
    return apiClient.get<FinancialSummaryResponse>('/dashboard/financial-summary');
  },

  getAttendanceTopEmployees: async (params: {
    periodType: 'month' | 'year';
    year: number;
    month?: number;
    limit?: number;
  }): Promise<AttendanceTopEmployeesResponse> => {
    const query = new URLSearchParams();
    query.append('periodType', params.periodType);
    query.append('year', params.year.toString());
    if (params.month) query.append('month', params.month.toString());
    if (params.limit) query.append('limit', params.limit.toString());
    
    return apiClient.get<AttendanceTopEmployeesResponse>(`/dashboard/attendance-top-employees?${query.toString()}`);
  },
};

// Top Employees
export interface TopEmployeeDTO {
  employeeId: string;
  employeeNumber: string;
  fullName: string;
  photoId: string | null;
  count: number;
  total: number;
}

export interface AttendanceTopEmployeesResponse {
  period: {
    startDate: string;
    endDate: string;
  };
  late: TopEmployeeDTO[];
  lateCount: TopEmployeeDTO[];
  leaveDay: TopEmployeeDTO[];
  leaveDouble: TopEmployeeDTO[];
  leaveHours: TopEmployeeDTO[];
  ot: TopEmployeeDTO[];
}
