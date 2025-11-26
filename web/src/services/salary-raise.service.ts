import { apiClient } from '@/lib/api-client';

export interface SalaryRaiseCycle {
  id: string;
  periodStartDate: string;
  periodEndDate: string;
  status: 'pending' | 'approved' | 'rejected';
  note?: string;
  totalEmployees?: number;
  totalRaiseAmount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryRaiseItem {
  id: string;
  cycleId: string;
  employeeId: string;
  employeeName: string;
  tenureDays: number;
  currentSalary: number;
  currentSsoWage?: number;
  raisePercent: number;
  raiseAmount: number;
  newSalary: number;
  newSsoWage?: number;
  stats: {
    lateMinutes: number;
    leaveDays: number;
    leaveDoubleDays: number;
    leaveHours: number;
    otHours: number;
  };
  updatedAt: string;
}

export interface CreateCycleRequest {
  periodStartDate: string;
  periodEndDate: string;
}

export interface UpdateCycleRequest {
  periodEndDate?: string;
  status?: 'approved' | 'rejected';
}

export interface UpdateCycleItemRequest {
  raisePercent?: number;
  raiseAmount?: number;
  newSsoWage?: number;
}

export interface CycleListResponse {
  data: SalaryRaiseCycle[];
  meta: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
  };
}

export interface CycleItemListResponse {
  data: SalaryRaiseItem[];
}

export const salaryRaiseService = {
  getCycles: async (params?: { page?: number; limit?: number; status?: string; year?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.status) query.append('status', params.status);
    if (params?.year) query.append('year', params.year.toString());
    
    return apiClient.get<CycleListResponse>(`/salary-raise-cycles?${query.toString()}`);
  },

  getCycle: async (id: string) => {
    return apiClient.get<SalaryRaiseCycle>(`/salary-raise-cycles/${id}`);
  },

  createCycle: async (data: CreateCycleRequest) => {
    return apiClient.post<SalaryRaiseCycle>('/salary-raise-cycles', data);
  },

  updateCycle: async (id: string, data: UpdateCycleRequest) => {
    return apiClient.patch<SalaryRaiseCycle>(`/salary-raise-cycles/${id}`, data);
  },

  deleteCycle: async (id: string) => {
    return apiClient.delete(`/salary-raise-cycles/${id}`);
  },

  getCycleItems: async (id: string, params?: { search?: string; departmentId?: string }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.departmentId) query.append('departmentId', params.departmentId);

    return apiClient.get<CycleItemListResponse>(`/salary-raise-cycles/${id}/items?${query.toString()}`);
  },

  updateCycleItem: async (itemId: string, data: UpdateCycleItemRequest) => {
    return apiClient.patch<SalaryRaiseItem>(`/salary-raise-items/${itemId}`, data);
  },
};
