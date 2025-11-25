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

export interface AllMasterData {
  personTitles: MasterData[];
  employeeTypes: MasterData[];
  idDocumentTypes: MasterData[];
}

export const masterDataService = {
  getAll: async () => {
    const response = await apiClient.get<any>('/master/all');
    return response.data || response;
  },
};
