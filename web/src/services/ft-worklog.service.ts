import { apiClient } from '@/lib/api-client';

export interface FTWorklog {
  id: string;
  employeeId: string;
  employeeName: string;
  workDate: string; // YYYY-MM-DD
  entryType: 'late' | 'leave_day' | 'leave_hours' | 'ot' | 'leave_double';
  quantity: number;
  status: 'pending' | 'approved';
  createdAt: string;
  updatedAt: string;
}

export interface CreateFTWorklogRequest {
  employeeId: string;
  workDate: string; // YYYY-MM-DD
  entryType: 'late' | 'leave_day' | 'leave_hours' | 'ot' | 'leave_double';
  quantity: number;
}

export interface UpdateFTWorklogRequest {
  quantity?: number;
}

export interface FTWorklogListResponse {
  data: FTWorklog[];
  meta: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
  };
}

export const ftWorklogService = {
  getWorklogs: async (params?: {
    employeeId?: string;
    entryType?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.employeeId) query.append('employeeId', params.employeeId);
    if (params?.entryType) query.append('entryType', params.entryType);
    if (params?.status) query.append('status', params.status);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());

    return apiClient.get<FTWorklogListResponse>(`/worklogs/ft?${query.toString()}`);
  },

  getWorklog: async (id: string) => {
    return apiClient.get<FTWorklog>(`/worklogs/ft/${id}`);
  },

  createWorklog: async (data: CreateFTWorklogRequest) => {
    return apiClient.post<FTWorklog>('/worklogs/ft', data);
  },

  updateWorklog: async (id: string, data: UpdateFTWorklogRequest) => {
    return apiClient.patch<FTWorklog>(`/worklogs/ft/${id}`, data);
  },

  deleteWorklog: async (id: string) => {
    return apiClient.delete(`/worklogs/ft/${id}`);
  },
};
