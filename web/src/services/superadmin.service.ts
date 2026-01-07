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

// ===== Activity Logs =====

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId: string;
  details: any;
  createdAt: string;
}

export interface ActivityLogListResponse {
  data: ActivityLog[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface GetActivityLogsParams {
  page?: number;
  limit?: number;
  action?: string;
  entity?: string;
  fromDate?: string;
  toDate?: string;
  userName?: string;
}

export interface FilterOptions {
  actions: string[];
  entities: string[];
}

// List activity logs (super admin - system level only)
export async function getActivityLogs(params?: GetActivityLogsParams): Promise<ActivityLogListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.action) queryParams.append('action', params.action);
  if (params?.entity) queryParams.append('entity', params.entity);
  if (params?.fromDate) queryParams.append('fromDate', params.fromDate);
  if (params?.toDate) queryParams.append('toDate', params.toDate);
  if (params?.userName) queryParams.append('userName', params.userName);

  const response = await api.get<ActivityLogListResponse>(`/super-admin/activity-logs?${queryParams.toString()}`);
  return response.data;
}

// Get filter options (super admin - system level only)
export async function getActivityLogFilterOptions(): Promise<FilterOptions> {
  const response = await api.get<FilterOptions>('/super-admin/activity-logs/filter-options');
  return response.data;
}
