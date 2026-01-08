import { apiClient } from "@/lib/api-client";

export interface SalaryAdvance {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode?: string;
  amount: number;
  advanceDate: string;
  payrollMonthDate: string;
  status: 'pending' | 'processed';
  createdAt: string;
  updatedAt: string;
}

export interface CreateSalaryAdvanceRequest {
  employeeId: string;
  amount: number;
  advanceDate: string;
  payrollMonthDate: string;
}

export interface UpdateSalaryAdvanceRequest {
  amount: number;
  advanceDate: string;
  payrollMonthDate: string;
}

export const salaryAdvanceService = {
  getAll: async (params?: { page?: number; limit?: number; status?: string; employeeId?: string; payrollMonth?: string }) => {
    const response = await apiClient.get<{ data: SalaryAdvance[]; meta: any }>("/salary-advances", { params });
    return response;
  },

  getById: async (id: string) => {
    const response = await apiClient.get<SalaryAdvance>(`/salary-advances/${id}`);
    return response;
  },

  create: async (data: CreateSalaryAdvanceRequest) => {
    const response = await apiClient.post<SalaryAdvance>("/salary-advances", data);
    return response;
  },

  update: async (id: string, data: UpdateSalaryAdvanceRequest) => {
    const response = await apiClient.patch<SalaryAdvance>(`/salary-advances/${id}`, data);
    return response;
  },

  delete: async (id: string) => {
    await apiClient.delete(`/salary-advances/${id}`);
  },
};
