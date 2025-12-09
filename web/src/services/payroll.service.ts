import { apiClient } from '@/lib/api-client';

export interface PayrollRun {
  id: string;
  payrollMonthDate: string;
  periodStartDate: string;
  payDate: string;
  status: string;
  totalEmployees?: number;
  totalNetPay?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollRunDetail extends PayrollRun {
  totals?: {
    totalIncome: number;
    totalDeduction: number;
    totalNetPay: number;
  };
}

export interface PayrollRunsResponse {
  data: PayrollRun[];
  meta: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

export interface PayrollRunsQueryParams {
  page?: number;
  limit?: number;
  payrollMonthDate?: string;
  status?: string;
  year?: number;
}

// Payroll Item (Payslip list item)
export interface PayrollItem {
  id: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  employeeTypeCode: string;
  employeeTypeName?: string;
  salaryAmount: number;
  incomeTotal: number;
  deductionTotal: number;
  netPay: number;
}

export interface PayrollItemsResponse {
  data: PayrollItem[];
  meta: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

export interface PayrollItemsQueryParams {
  search?: string;
  employeeTypeCode?: string;
  page?: number;
  limit?: number;
}

// Payslip Detail
export interface OtherIncomeItem {
  name: string;
  value: number;
}

export interface LoanRepaymentItem {
  name: string;
  value: number;
}

export interface PayslipDetail {
  id: string;
  runId: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  employeeTypeCode: string;
  bankAccount?: string;
  
  // Income
  salaryAmount: number;
  otHours: number;
  otAmount: number;
  bonusAmount: number;
  housingAllowance: number;
  attendanceBonusNoLate: number;
  attendanceBonusNoLeave: number;
  leaveCompensationAmount: number;
  doctorFee: number;
  othersIncome: OtherIncomeItem[];
  incomeTotal: number;
  
  // Employee flags for field permissions
  ssoContribute: boolean;
  providentFundContribute: boolean;
  withholdTax: boolean;
  allowHousing: boolean;
  allowWater: boolean;
  allowElectric: boolean;
  allowInternet: boolean;
  allowDoctorFee: boolean;
  
  // Attendance deductions
  lateMinutesQty: number;
  lateMinutesDeduction: number;
  leaveDaysQty: number;
  leaveDaysDeduction: number;
  leaveDoubleQty: number;
  leaveDoubleDeduction: number;
  leaveHoursQty: number;
  leaveHoursDeduction: number;
  
  // Tax/SSO/PF
  taxMonthAmount: number;
  taxAccumPrev: number;
  taxAccumTotal: number;
  ssoMonthAmount: number;
  ssoAccumPrev: number;
  ssoAccumTotal: number;
  pfMonthAmount: number;
  pfAccumPrev: number;
  pfAccumTotal: number;
  
  // Utilities
  waterMeterPrev: number | null;
  waterMeterCurr: number | null;
  waterAmount: number;
  waterRatePerUnit: number;
  electricMeterPrev: number | null;
  electricMeterCurr: number | null;
  electricAmount: number;
  electricityRatePerUnit: number;
  internetAmount: number;
  
  // Advance & Loans
  advanceAmount: number;
  advanceDiffAmount: number;
  advanceRepayAmount: number;
  loanOutstandingPrev: number;
  loanRepayments: LoanRepaymentItem[];
  loanOutstandingTotal: number;
  
  // Totals
  deductionTotal: number;
  netPay: number;
}

// Update Payslip Request
export interface UpdatePayslipRequest {
  leaveCompensationAmount?: number;
  doctorFee?: number;
  othersIncome?: OtherIncomeItem[];
  taxMonthAmount?: number;
  pfMonthAmount?: number;
  waterMeterPrev?: number | null;
  waterMeterCurr?: number | null;
  waterAmount?: number;
  electricMeterPrev?: number | null;
  electricMeterCurr?: number | null;
  electricAmount?: number;
  internetAmount?: number;
  advanceRepayAmount?: number;
  loanRepayments?: LoanRepaymentItem[];
}

export interface CreatePayrollRunRequest {
  payrollMonthDate: string;
  periodStartDate: string;
  payDate: string;
  socialSecurityRateEmployee: number;
  socialSecurityRateEmployer: number;
}

export const payrollService = {
  async getPayrollRuns(params?: PayrollRunsQueryParams): Promise<PayrollRunsResponse> {
    return apiClient.get<PayrollRunsResponse>('/payroll-runs', { params });
  },

  async getPayrollRunDetail(id: string): Promise<PayrollRunDetail> {
    return apiClient.get<PayrollRunDetail>(`/payroll-runs/${id}`);
  },

  async getPendingPayrollRun(): Promise<PayrollRun | null> {
    try {
      const response = await this.getPayrollRuns({ status: 'pending', limit: 1 });
      return response?.data && response.data.length > 0 ? response.data[0] : null;
    } catch (error) {
      console.error('Failed to fetch pending payroll run', error);
      return null;
    }
  },

  async validatePayrollMonth(payrollMonthDate: string): Promise<{ exists: boolean; approved: boolean }> {
    try {
      const response = await this.getPayrollRuns({ payrollMonthDate, limit: 1 });
      if (!response?.data || response.data.length === 0) {
        return { exists: false, approved: false };
      }
      const run = response.data[0];
      return { exists: true, approved: run.status === 'approved' };
    } catch (error) {
      console.error('Failed to validate payroll month', error);
      return { exists: false, approved: false };
    }
  },

  async createPayrollRun(data: CreatePayrollRunRequest): Promise<PayrollRun> {
    return apiClient.post<PayrollRun>('/payroll-runs', data);
  },

  async deletePayrollRun(id: string): Promise<void> {
    return apiClient.delete<void>(`/payroll-runs/${id}`);
  },

  // Payroll Items (Payslips)
  async getPayrollItems(runId: string, params?: PayrollItemsQueryParams): Promise<PayrollItemsResponse> {
    return apiClient.get<PayrollItemsResponse>(`/payroll-runs/${runId}/items`, { params });
  },

  async getPayslipDetail(itemId: string): Promise<PayslipDetail> {
    return apiClient.get<PayslipDetail>(`/payroll-items/${itemId}`);
  },

  async updatePayslip(itemId: string, data: UpdatePayslipRequest): Promise<PayslipDetail> {
    return apiClient.patch<PayslipDetail>(`/payroll-items/${itemId}`, data);
  },

  async approvePayrollRun(id: string): Promise<PayrollRunDetail> {
    return apiClient.patch<PayrollRunDetail>(`/payroll-runs/${id}`, { status: 'approved' });
  },
};

