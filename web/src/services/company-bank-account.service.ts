import { apiClient } from '@/lib/api-client';
import { Bank } from './master-data.service';

export interface CompanyBankAccount {
  id: string;
  companyId: string;
  bankId: string;
  branchId: string | null; // null = Central Account
  accountNumber: string;
  accountName: string;
  isActive: boolean;
  // Enriched fields from API
  bankCode: string;
  bankNameTh: string;
  bankNameEn: string;
  branchName: string;
}

export interface CreateCompanyBankAccountRequest {
  bankId: string;
  branchId?: string | null;
  accountNumber: string;
  accountName: string;
}

export interface UpdateCompanyBankAccountRequest {
  bankId: string;
  branchId?: string | null;
  accountNumber: string;
  accountName: string;
  isActive: boolean;
}

export const companyBankAccountService = {
  // Get bank accounts with optional filters
  list: async (params?: { 
    branchId?: string; 
    includeCentral?: boolean; 
    isActive?: boolean;
  }): Promise<CompanyBankAccount[]> => {
    const query = new URLSearchParams();
    if (params?.branchId) query.append('branchId', params.branchId);
    if (params?.includeCentral) query.append('includeCentral', 'true');
    if (params?.isActive !== undefined) query.append('isActive', params.isActive.toString());
    const queryString = query.toString();
    return apiClient.get<CompanyBankAccount[]>(`/admin/company/bank-accounts${queryString ? `?${queryString}` : ''}`);
  },

  // Get a single bank account by ID
  getById: async (id: string): Promise<CompanyBankAccount> => {
    return apiClient.get<CompanyBankAccount>(`/admin/company/bank-accounts/${id}`);
  },

  // Create a new bank account
  create: async (data: CreateCompanyBankAccountRequest): Promise<CompanyBankAccount> => {
    return apiClient.post<CompanyBankAccount>('/admin/company/bank-accounts', data);
  },

  // Update an existing bank account
  update: async (id: string, data: UpdateCompanyBankAccountRequest): Promise<CompanyBankAccount> => {
    return apiClient.put<CompanyBankAccount>(`/admin/company/bank-accounts/${id}`, data);
  },

  // Delete a bank account
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/company/bank-accounts/${id}`);
  },
};

// Re-export Bank type for convenience
export type { Bank };
