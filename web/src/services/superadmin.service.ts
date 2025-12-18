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
