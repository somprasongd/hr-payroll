import { apiClient } from '@/lib/api-client';

export interface PayoutPtItem {
  worklogId: string;
  workDate: string;
  totalHours: number;
}

export interface PayoutPt {
  id: string;
  employeeId: string;
  status: 'to_pay' | 'paid';
  totalHours: number;
  amount: number;
  itemCount: number;
  items?: PayoutPtItem[];
  hourlyRate: number;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  paidBy?: string;
}

export interface CreatePayoutPtRequest {
  employeeId: string;
  worklogIds: string[];
}

export interface GetPayoutsPtParams {
  page?: number;
  limit?: number;
  employeeId?: string;
  status?: 'to_pay' | 'paid';
}

export const payoutPtService = {
  getPayouts: async (params?: GetPayoutsPtParams) => {
    const response = await apiClient.get<{ data: PayoutPt[]; meta: any }>('/payouts/pt', { params });
    return response;
  },

  getPayout: async (id: string) => {
    const response = await apiClient.get<{ payout: PayoutPt; items: PayoutPtItem[] }>(`/payouts/pt/${id}`);
    return {
      ...response.payout,
      items: response.items,
    };
  },

  createPayout: async (data: CreatePayoutPtRequest) => {
    const response = await apiClient.post<PayoutPt>('/payouts/pt', data);
    return response;
  },

  markAsPaid: async (id: string) => {
    const response = await apiClient.post(`/payouts/pt/${id}/pay`);
    return response;
  },
};
