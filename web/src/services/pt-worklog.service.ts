import { apiClient } from '@/lib/api-client';

export interface PTWorklog {
  id: string;
  employeeId: string;
  employeeName: string;
  workDate: string; // YYYY-MM-DD
  morningIn: string | null; // HH:mm:ss
  morningOut: string | null; // HH:mm:ss
  morningMinutes: number;
  eveningIn: string | null; // HH:mm:ss
  eveningOut: string | null; // HH:mm:ss
  eveningMinutes: number;
  totalMinutes: number;
  totalHours: number;
  status: 'pending' | 'approved' | 'to_pay' | 'paid';
  createdAt: string;
  updatedAt: string;
}

export interface CreatePTWorklogRequest {
  employeeId: string;
  workDate: string; // YYYY-MM-DD
  morningIn?: string; // HH:mm
  morningOut?: string; // HH:mm
  eveningIn?: string; // HH:mm
  eveningOut?: string; // HH:mm
}

export interface UpdatePTWorklogRequest {
  morningIn?: string; // HH:mm
  morningOut?: string; // HH:mm
  eveningIn?: string; // HH:mm
  eveningOut?: string; // HH:mm
}

export interface PTWorklogListResponse {
  data: PTWorklog[];
  meta: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
  };
}

export const ptWorklogService = {
  getWorklogs: async (params?: {
    employeeId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.employeeId) query.append('employeeId', params.employeeId);
    if (params?.status) query.append('status', params.status);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());

    return apiClient.get<PTWorklogListResponse>(`/worklogs/pt?${query.toString()}`);
  },

  getWorklog: async (id: string) => {
    return apiClient.get<PTWorklog>(`/worklogs/pt/${id}`);
  },

  createWorklog: async (data: CreatePTWorklogRequest) => {
    return apiClient.post<PTWorklog>('/worklogs/pt', data);
  },

  updateWorklog: async (id: string, data: UpdatePTWorklogRequest) => {
    return apiClient.patch<PTWorklog>(`/worklogs/pt/${id}`, data);
  },

  deleteWorklog: async (id: string) => {
    return apiClient.delete(`/worklogs/pt/${id}`);
  },
};
