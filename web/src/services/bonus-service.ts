import { apiClient } from "@/lib/api-client";

export interface BonusCycle {
  id: string;
  payrollMonthDate: string;
  periodStartDate: string;
  periodEndDate: string;
  status: 'pending' | 'approved' | 'rejected';
  totalEmployees?: number;
  totalBonusAmount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface BonusItem {
  id: string;
  cycleId: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  currentSalary: number;
  tenureDays: number;
  stats: {
    lateMinutes: number;
    leaveDays: number;
    leaveDoubleDays: number;
    leaveHours: number;
    otHours: number;
  };
  bonusMonths: number;
  bonusAmount: number;
}

export interface CreateBonusCycleRequest {
  payrollMonthDate: string;
  periodStartDate: string;
  periodEndDate: string;
}

export interface UpdateBonusCycleRequest {
  periodEndDate?: string;
  status?: 'approved' | 'rejected';
}

export interface UpdateBonusItemRequest {
  bonusMonths?: number;
  bonusAmount: number;
}

export const bonusService = {
  getCycles: async (params?: { page?: number; limit?: number; status?: string; year?: number }) => {
    const response = await apiClient.get<{ data: BonusCycle[]; meta: any }>("/bonus-cycles", { params });
    return response.data;
  },

  createCycle: async (data: CreateBonusCycleRequest) => {
    const response = await apiClient.post<BonusCycle>("/bonus-cycles", data);
    return response;
  },

  getCycle: async (id: string) => {
    const response = await apiClient.get<BonusCycle>(`/bonus-cycles/${id}`);
    return response;
  },

  updateCycle: async (id: string, data: UpdateBonusCycleRequest) => {
    const response = await apiClient.patch<BonusCycle>(`/bonus-cycles/${id}`, data);
    return response;
  },

  approveCycle: async (id: string) => {
    const response = await apiClient.patch<BonusCycle>(`/bonus-cycles/${id}`, { status: 'approved' });
    return response;
  },

  deleteCycle: async (id: string) => {
    await apiClient.delete(`/bonus-cycles/${id}`);
  },

  getBonusItems: async (cycleId: string, params?: { search?: string; departmentId?: string }) => {
    const response = await apiClient.get<{ data: BonusItem[] }>(`/bonus-cycles/${cycleId}/items`, { params });
    return response.data;
  },

  updateBonusItem: async (id: string, data: UpdateBonusItemRequest) => {
    const response = await apiClient.patch<BonusItem>(`/bonus-items/${id}`, data);
    return response;
  },
};
