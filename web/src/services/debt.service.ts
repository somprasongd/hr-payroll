import { apiClient } from '@/lib/api-client';

export interface DebtTxn {
  id: string;
  employeeId: string;
  employeeName?: string; // Joined from backend or frontend
  txnDate: string;
  txnType: 'loan' | 'other' | 'repayment' | 'installment';
  otherDesc?: string;
  amount: number;
  reason?: string;
  payrollMonthDate?: string;
  status: 'pending' | 'approved';
  parentId?: string;
  outstandingBalance?: number;
  installments?: DebtTxn[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDebtPlanRequest {
  employeeId: string;
  txnType: 'loan' | 'other';
  otherDesc?: string;
  txnDate: string;
  amount: number;
  reason?: string;
  installments: {
    amount: number;
    payrollMonthDate: string;
  }[];
}

export interface ManualRepaymentRequest {
  employeeId: string;
  txnDate: string;
  amount: number;
  reason?: string;
}

export const debtService = {
  async getDebtTxns(params?: {
    employeeId?: string;
    type?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    return apiClient.get<{ data: DebtTxn[]; meta: any }>('/debt-txns', { params });
  },

  async getDebtTxn(id: string) {
    return apiClient.get<DebtTxn>(`/debt-txns/${id}`);
  },

  async createDebtPlan(data: CreateDebtPlanRequest) {
    return apiClient.post<DebtTxn>('/debt-txns/create-plan', data);
  },

  async approveDebtTxn(id: string) {
    return apiClient.post<DebtTxn>(`/debt-txns/${id}/approve`);
  },

  async createRepayment(data: ManualRepaymentRequest) {
    return apiClient.post<DebtTxn>('/debt-txns/repayment', data);
  },
  
  async deleteDebtTxn(id: string) {
    return apiClient.delete<void>(`/debt-txns/${id}`);
  },

  async getOutstandingInstallments(employeeId: string) {
    return apiClient.get<{
      employeeId: string;
      employeeName: string;
      outstandingAmount: number;
      installments: DebtTxn[];
      meta: any;
    }>(`/debt-txns/${employeeId}/outstanding-installments`);
  }
};
