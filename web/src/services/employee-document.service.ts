import { apiClient } from '@/lib/api-client';
import { axiosInstance } from '@/lib/axios';

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  documentTypeId: string;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  checksumMd5: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;

  // Joined fields
  documentTypeCode?: string;
  documentTypeNameTh?: string;
  documentTypeNameEn?: string;
}

export interface EmployeeDocumentListResponse {
  items: EmployeeDocument[];
}

export interface UploadDocumentRequest {
  file: File;
  documentTypeId: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  notes?: string;
}

export interface UploadDocumentResponse {
  id: string;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  checksumMd5: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
}

export interface UpdateDocumentRequest {
  documentTypeId: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  notes?: string;
}

export interface ExpiringDocument {
  documentId: string;
  employeeId: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  documentTypeCode: string;
  documentTypeNameTh: string;
  documentTypeNameEn: string;
  fileName: string;
  expiryDate: string;
  daysUntilExpiry: number;
}

export interface ExpiringDocumentsResponse {
  items: ExpiringDocument[];
  total: number;
}

// Cache for document file downloads (ETag based)
const documentCache = new Map<string, { etag: string; dataUrl: string }>();

export const employeeDocumentService = {
  // List documents for an employee
  list: async (employeeId: string): Promise<EmployeeDocument[]> => {
    const response = await apiClient.get<EmployeeDocumentListResponse>(`/employees/${employeeId}/documents`);
    return response.items || [];
  },

  // Upload a new document
  upload: async (employeeId: string, request: UploadDocumentRequest): Promise<UploadDocumentResponse> => {
    const formData = new FormData();
    formData.append('file', request.file);
    formData.append('documentTypeId', request.documentTypeId);
    if (request.documentNumber) formData.append('documentNumber', request.documentNumber);
    if (request.issueDate) formData.append('issueDate', request.issueDate);
    if (request.expiryDate) formData.append('expiryDate', request.expiryDate);
    if (request.notes) formData.append('notes', request.notes);

    const response = await axiosInstance.post<UploadDocumentResponse>(
      `/employees/${employeeId}/documents`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  // Download document file
  download: async (employeeId: string, documentId: string): Promise<Blob> => {
    const response = await axiosInstance.get(`/employees/${employeeId}/documents/${documentId}/file`, {
      responseType: 'blob',
    });
    return response.data as Blob;
  },

  // Download document with caching for preview
  downloadWithCache: async (employeeId: string, documentId: string): Promise<string | null> => {
    const cacheKey = `${employeeId}-${documentId}`;
    const cached = documentCache.get(cacheKey);
    const headers: Record<string, string> = {};
    if (cached?.etag) {
      headers['If-None-Match'] = cached.etag;
    }

    try {
      const response = await axiosInstance.get(
        `/employees/${employeeId}/documents/${documentId}/file`,
        {
          responseType: 'blob',
          headers,
          validateStatus: (status) => status === 200 || status === 304,
        }
      );

      if (response.status === 304 && cached) {
        return cached.dataUrl;
      }

      const blob = response.data as Blob;
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      const etag = response.headers['etag'];
      if (etag) {
        documentCache.set(cacheKey, { etag, dataUrl });
      }

      return dataUrl;
    } catch (error) {
      console.error('Failed to download document:', error);
      return null;
    }
  },

  // Update document metadata
  update: async (employeeId: string, documentId: string, data: UpdateDocumentRequest): Promise<EmployeeDocument> => {
    return apiClient.put<EmployeeDocument>(`/employees/${employeeId}/documents/${documentId}`, data);
  },

  // Delete document
  delete: async (employeeId: string, documentId: string): Promise<void> => {
    return apiClient.delete(`/employees/${employeeId}/documents/${documentId}`);
  },

  // Get expiring documents
  getExpiring: async (daysAhead: number = 30): Promise<ExpiringDocumentsResponse> => {
    return apiClient.get<ExpiringDocumentsResponse>(`/documents/expiring?days=${daysAhead}`);
  },
};
