import { apiClient } from '@/lib/api-client';

export interface AccumulationRecord {
  id: string;
  accumType: string;
  accumYear?: number;
  amount: number;
  updatedAt: string;
  updatedBy: string;
}

export interface AccumulationListResponse {
  data: AccumulationRecord[];
}

export interface UpsertAccumulationRequest {
  accumType: string;
  accumYear?: number;
  amount: number;
}

export const accumulationService = {
  getAccumulations: async (employeeId: string) => {
    return apiClient.get<AccumulationListResponse>(`/employees/${employeeId}/accumulations`);
  },

  upsertAccumulation: async (employeeId: string, data: UpsertAccumulationRequest) => {
    return apiClient.post<{ record: AccumulationRecord }>(`/employees/${employeeId}/accumulations`, data);
  },

  deleteAccumulation: async (accumId: string) => {
    return apiClient.delete(`/employees/accumulations/${accumId}`);
  },
};
