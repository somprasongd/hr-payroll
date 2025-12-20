import { apiClient } from '@/lib/api-client';
import { axiosInstance } from '@/lib/axios';

export interface Employee {
  id: string;
  employeeNumber: string;
  titleId: string;
  titleName?: string;
  firstName: string;
  lastName: string;
  idDocumentTypeId: string;
  idDocumentNumber: string;
  phone?: string;
  email?: string;
  photoId?: string;
  employeeTypeId: string;
  departmentId?: string;
  positionId?: string;
  basePayAmount: number;
  employmentStartDate: string;
  employmentEndDate?: string;
  bankName?: string;
  bankAccountNo?: string;
  ssoContribute: boolean;
  ssoDeclaredWage?: number;
  providentFundContribute: boolean;
  providentFundRateEmployee?: number;
  providentFundRateEmployer?: number;
  withholdTax: boolean;
  allowHousing: boolean;
  allowWater: boolean;
  allowElectric: boolean;
  allowInternet: boolean;
  allowDoctorFee: boolean;
  allowAttendanceBonusNoLate: boolean;
  allowAttendanceBonusNoLeave: boolean;
  createdAt: string;
  updatedAt: string;
  
  // Display fields (joined)
  employeeTypeName?: string;
  fullNameTh?: string;
  status?: 'active' | 'terminated';

  // Compatibility for PascalCase API responses
  ID?: string;
  EmployeeNumber?: string;
  FirstName?: string;
  LastName?: string;
}

export interface CreateEmployeeRequest {
  employeeNumber: string;
  titleId: string;
  firstName: string;
  lastName: string;
  idDocumentTypeId: string;
  idDocumentNumber: string;
  phone?: string;
  email?: string;
  photoId?: string;
  employeeTypeId: string;
  departmentId?: string;
  positionId?: string;
  basePayAmount: number;
  employmentStartDate: string;
  bankName?: string;
  bankAccountNo?: string;
  ssoContribute: boolean;
  ssoDeclaredWage?: number;
  providentFundContribute: boolean;
  providentFundRateEmployee?: number;
  providentFundRateEmployer?: number;
  withholdTax?: boolean;
  allowHousing?: boolean;
  allowWater?: boolean;
  allowElectric?: boolean;
  allowInternet?: boolean;
  allowDoctorFee: boolean;
  allowAttendanceBonusNoLate?: boolean;
  allowAttendanceBonusNoLeave?: boolean;
}

export interface UpdateEmployeeRequest {
  basePayAmount?: number;
  allowDoctorFee?: boolean;
  providentFundContribute?: boolean;
  providentFundRateEmployee?: number;
  providentFundRateEmployer?: number;
  titleId?: string;
  firstName?: string;
  lastName?: string;
  idDocumentTypeId?: string;
  idDocumentNumber?: string;
  phone?: string;
  email?: string;
  photoId?: string;
  employeeTypeId?: string;
  departmentId?: string;
  positionId?: string;
  employmentStartDate?: string;
  employmentEndDate?: string;
  bankName?: string;
  bankAccountNo?: string;
  ssoContribute?: boolean;
  ssoDeclaredWage?: number;
  withholdTax?: boolean;
  allowHousing?: boolean;
  allowWater?: boolean;
  allowElectric?: boolean;
  allowInternet?: boolean;
  allowAttendanceBonusNoLate?: boolean;
  allowAttendanceBonusNoLeave?: boolean;
}

export interface PhotoUploadResponse {
  id: string;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  checksumMd5: string;
}

// Cache for photo ETag and data URLs
const photoCache = new Map<string, { etag: string; dataUrl: string }>();

export interface EmployeeListResponse {
  data: Employee[];
  meta: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
  };
}

export interface EmployeeType {
  id: string;
  code: string;
  name: string;
}

export const employeeService = {
  getEmployees: async (params?: { page?: number; limit?: number; search?: string; status?: string; employeeTypeId?: string; employeeTypeCode?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.search) query.append('search', params.search);
    if (params?.status) query.append('status', params.status);
    if (params?.employeeTypeId && params.employeeTypeId !== 'all') query.append('employeeTypeId', params.employeeTypeId);
    if (params?.employeeTypeCode) query.append('employeeTypeCode', params.employeeTypeCode);
    
    return apiClient.get<EmployeeListResponse>(`/employees?${query.toString()}`);
  },

  getEmployeeTypes: async () => {
    return apiClient.get<EmployeeType[]>('/master/employee-types');
  },

  getEmployee: async (id: string) => {
    return apiClient.get<Employee>(`/employees/${id}`);
  },

  createEmployee: async (data: CreateEmployeeRequest) => {
    return apiClient.post<Employee>('/employees', data);
  },

  updateEmployee: async (id: string, data: UpdateEmployeeRequest) => {
    return apiClient.put<Employee>(`/employees/${id}`, data);
  },

  deleteEmployee: async (id: string) => {
    return apiClient.delete(`/employees/${id}`);
  },

  // Photo upload/download
  uploadPhoto: async (file: File): Promise<PhotoUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axiosInstance.post<PhotoUploadResponse>('/employees/photos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  fetchPhotoWithCache: async (photoId: string): Promise<string | null> => {
    if (!photoId) return null;

    const cached = photoCache.get(photoId);
    const headers: Record<string, string> = {};
    if (cached?.etag) {
      headers['If-None-Match'] = cached.etag;
    }

    try {
      const response = await axiosInstance.get(`/employees/photos/${photoId}`, {
        responseType: 'blob',
        headers,
        validateStatus: (status) => status === 200 || status === 304,
      });

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
        photoCache.set(photoId, { etag, dataUrl });
      }

      return dataUrl;
    } catch (error) {
      console.error('Failed to fetch photo:', error);
      return null;
    }
  },

  deletePhoto: async (employeeId: string): Promise<void> => {
    await axiosInstance.delete(`/employees/${employeeId}/photo`);
    // Clear cache for this employee's photo if any
    photoCache.forEach((_, key) => {
      photoCache.delete(key);
    });
  },
};
