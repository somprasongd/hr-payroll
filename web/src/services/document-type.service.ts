import { apiClient } from '@/lib/api-client';

export interface DocumentType {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
  isSystem: boolean;
  companyId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentTypeListResponse {
  items: DocumentType[];
}

export interface CreateDocumentTypeRequest {
  code: string;
  nameTh: string;
  nameEn: string;
}

export interface UpdateDocumentTypeRequest {
  code: string;
  nameTh: string;
  nameEn: string;
}

export const documentTypeService = {
  list: async (): Promise<DocumentType[]> => {
    const response = await apiClient.get<DocumentTypeListResponse>('/employee-document-types');
    return response.items || [];
  },

  create: async (data: CreateDocumentTypeRequest): Promise<DocumentType> => {
    return apiClient.post<DocumentType>('/employee-document-types', data);
  },

  update: async (id: string, data: UpdateDocumentTypeRequest): Promise<DocumentType> => {
    return apiClient.put<DocumentType>(`/employee-document-types/${id}`, data);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete(`/employee-document-types/${id}`);
  },
};
