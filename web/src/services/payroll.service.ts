import { apiClient } from '@/lib/api-client';

export interface PayrollRun {
  id: string;
  monthDate: string;
  status: string;
  cycleStartDate: string;
  cycleEndDate: string;
  createdAt: string;
  updatedAt: string;
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
  monthDate?: string;
  status?: string;
}

export const payrollService = {
  async getPayrollRuns(params?: PayrollRunsQueryParams): Promise<PayrollRunsResponse> {
    const response = await apiClient.get<PayrollRunsResponse>('/payroll-runs', { params });
    return response.data;
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

  async validatePayrollMonth(monthDate: string): Promise<{ exists: boolean; approved: boolean }> {
    try {
      const response = await this.getPayrollRuns({ monthDate, limit: 1 });
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
};
