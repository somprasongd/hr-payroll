/**
 * Payroll Configuration Service
 * 
 * Handles payroll configuration-related API calls
 */

import { apiClient } from '@/lib/api-client';

// Tax progressive bracket for Thai income tax calculation
export interface TaxProgressiveBracket {
  min: number;
  max: number | null; // null means no upper limit
  rate: number; // Decimal (e.g., 0.05 for 5%)
}

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
  socialSecurityWageCap: number;
  // Tax configuration for Section 40(1) - Regular employees
  taxApplyStandardExpense: boolean; // Whether to apply 50% standard expense deduction (max 100,000)
  taxStandardExpenseRate: number; // Decimal (e.g., 0.5 for 50%)
  taxStandardExpenseCap: number; // Maximum standard expense deduction cap
  taxApplyPersonalAllowance: boolean; // Whether to apply personal allowance
  taxPersonalAllowanceAmount: number; // Personal allowance amount (e.g., 60,000)
  taxProgressiveBrackets: TaxProgressiveBracket[]; // Progressive tax brackets (0-35%)
  // Tax configuration for Section 40(2) - Freelance/Contract workers
  withholdingTaxRateService: number; // Withholding tax rate for freelance (e.g., 0.03 for 3%)
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
  socialSecurityWageCap: number;
  // Tax configuration for Section 40(1) - Regular employees
  taxApplyStandardExpense: boolean;
  taxStandardExpenseRate: number;
  taxStandardExpenseCap: number;
  taxApplyPersonalAllowance: boolean;
  taxPersonalAllowanceAmount: number;
  taxProgressiveBrackets: TaxProgressiveBracket[];
  // Tax configuration for Section 40(2) - Freelance/Contract workers
  withholdingTaxRateService: number;
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
  async getAll(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<PayrollConfig>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    
    return apiClient.get<PaginatedResponse<PayrollConfig>>(`/admin/payroll-configs?${query.toString()}`);
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
