import { apiClient } from '@/lib/api-client';

export interface MasterData {
  id: string;
  code: string;
  name: string;
  // Fallback for backend returning PascalCase
  ID?: string;
  Code?: string;
  Name?: string;
}

export interface Bank {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
  nameMy: string;
  isSystem: boolean;
  isEnabled: boolean;
}

export interface AllMasterData {
  personTitles: MasterData[];
  employeeTypes: MasterData[];
  idDocumentTypes: MasterData[];
  departments: MasterData[];
  employeePositions: MasterData[];
  banks?: Bank[];
}

export interface CreateMasterDataRequest {
  code: string;
  name: string;
}

export interface UpdateMasterDataRequest {
  code?: string;
  name?: string;
}

export const masterDataService = {
  getAll: async (): Promise<AllMasterData> => {
    return apiClient.get<AllMasterData>('/master/all');
  },
  
  getAllWithBanks: async (): Promise<AllMasterData> => {
    // Get base master data
    const baseData = await apiClient.get<AllMasterData>('/master/all');
    // Get banks - endpoint returns Bank[] directly
    const banks = await apiClient.get<Bank[]>('/master/banks');
    return { ...baseData, banks: banks || [] };
  },

  getBanks: async (): Promise<Bank[]> => {
    // Endpoint returns Bank[] directly
    return apiClient.get<Bank[]>('/master/banks');
  },

  // Departments CRUD
  getDepartments: async (): Promise<MasterData[]> => {
    return apiClient.get<MasterData[]>('/master/departments');
  },

  createDepartment: async (data: CreateMasterDataRequest): Promise<MasterData> => {
    return apiClient.post<MasterData>('/master/departments', data);
  },

  updateDepartment: async (id: string, data: UpdateMasterDataRequest): Promise<MasterData> => {
    return apiClient.patch<MasterData>(`/master/departments/${id}`, data);
  },

  deleteDepartment: async (id: string): Promise<void> => {
    await apiClient.delete(`/master/departments/${id}`);
  },

  // Employee Positions CRUD
  getPositions: async (): Promise<MasterData[]> => {
    return apiClient.get<MasterData[]>('/master/employee-positions');
  },

  createPosition: async (data: CreateMasterDataRequest): Promise<MasterData> => {
    return apiClient.post<MasterData>('/master/employee-positions', data);
  },

  updatePosition: async (id: string, data: UpdateMasterDataRequest): Promise<MasterData> => {
    return apiClient.patch<MasterData>(`/master/employee-positions/${id}`, data);
  },

  deletePosition: async (id: string): Promise<void> => {
    await apiClient.delete(`/master/employee-positions/${id}`);
  },
};

