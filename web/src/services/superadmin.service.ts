import axiosInstance from '@/lib/axios';

const api = axiosInstance;

// Company model
export interface Company {
  id: string;
  code: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// Branch model for create response
export interface Branch {
  id: string;
  companyId: string;
  code: string;
  name: string;
  status: string;
  isDefault: boolean;
}

// Create company request
export interface CreateCompanyRequest {
  companyCode: string;
  companyName: string;
  adminUsername: string;
  adminPassword: string;
}

// Create company response
export interface CreateCompanyResponse {
  company: Company;
  branch: Branch;
  adminUserId: string;
}

// List all companies (super admin only)
export async function listCompanies(): Promise<Company[]> {
  const response = await api.get<Company[]>('/super-admin/companies');
  return response.data;
}

// Get company by ID
export async function getCompany(id: string): Promise<Company> {
  const response = await api.get<Company>(`/super-admin/companies/${id}`);
  return response.data;
}

// Create new company with admin user
export async function createCompany(data: CreateCompanyRequest): Promise<CreateCompanyResponse> {
  const response = await api.post<CreateCompanyResponse>('/super-admin/companies', data);
  return response.data;
}

// Update company
export async function updateCompany(id: string, data: { code: string; name: string; status: string }): Promise<Company> {
  const response = await api.patch<Company>(`/super-admin/companies/${id}`, data);
  return response.data;
}

// ===== System Document Types =====

// System document type model
export interface SystemDocumentType {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
  isSystem: boolean;
  companyId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SystemDocumentTypeListResponse {
  items: SystemDocumentType[];
}

export interface CreateSystemDocumentTypeRequest {
  code: string;
  nameTh: string;
  nameEn: string;
}

// List system document types
export async function listSystemDocumentTypes(): Promise<SystemDocumentType[]> {
  const response = await api.get<SystemDocumentTypeListResponse>('/super-admin/employee-document-types');
  return response.data?.items || [];
}

// Create system document type
export async function createSystemDocumentType(data: CreateSystemDocumentTypeRequest): Promise<SystemDocumentType> {
  const response = await api.post<SystemDocumentType>('/super-admin/employee-document-types', data);
  return response.data;
}

// Update system document type
export async function updateSystemDocumentType(id: string, data: CreateSystemDocumentTypeRequest): Promise<SystemDocumentType> {
  const response = await api.put<SystemDocumentType>(`/super-admin/employee-document-types/${id}`, data);
  return response.data;
}

// Delete system document type
export async function deleteSystemDocumentType(id: string): Promise<void> {
  await api.delete(`/super-admin/employee-document-types/${id}`);
}

