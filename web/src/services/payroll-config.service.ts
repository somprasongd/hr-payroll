/**
 * Payroll Configuration Service
 * 
 * Handles payroll configuration-related API calls
 */

import { apiClient } from '@/lib/api-client';

export interface PayrollConfig {
  id: string;
  versionNo: number;
  startDate: string;
  endDate: string | null;
  status: 'active' | 'retired';
  hourlyRate: number;
  otHourlyRate: number;
  attendanceBonusNoLate: number;
  attendanceBonusNoLeave: number;
  housingAllowance: number;
  waterRatePerUnit: number;
  electricityRatePerUnit: number;
  internetFeeMonthly: number;
  socialSecurityRateEmployee: number; // Stored as decimal (e.g., 0.05 for 5%)
  socialSecurityRateEmployer: number; // Stored as decimal (e.g., 0.05 for 5%)
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePayrollConfigRequest {
  startDate: string;
  hourlyRate: number;
  otHourlyRate: number;
  attendanceBonusNoLate: number;
  attendanceBonusNoLeave: number;
  housingAllowance: number;
  waterRatePerUnit: number;
  electricityRatePerUnit: number;
  internetFeeMonthly: number;
  socialSecurityRateEmployee: number; // Should be decimal (e.g., 0.05 for 5%)
  socialSecurityRateEmployer: number; // Should be decimal (e.g., 0.05 for 5%)
  note: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export const payrollConfigService = {
  /**
   * Get the currently effective payroll configuration
   */
  async getEffective(): Promise<PayrollConfig> {
    return apiClient.get<PayrollConfig>('/admin/payroll-configs/effective');
  },

  /**
   * Get all payroll configurations (history)
   * Returns paginated response
   */
  async getAll(): Promise<PaginatedResponse<PayrollConfig>> {
    return apiClient.get<PaginatedResponse<PayrollConfig>>('/admin/payroll-configs');
  },

  /**
   * Get a specific payroll configuration by ID
   */
  async getById(id: string): Promise<PayrollConfig> {
    return apiClient.get<PayrollConfig>(`/admin/payroll-configs/${id}`);
  },

  /**
   * Create a new payroll configuration
   */
  async create(data: CreatePayrollConfigRequest): Promise<PayrollConfig> {
    return apiClient.post<PayrollConfig>('/admin/payroll-configs', data);
  },
};
