import axiosInstance from '@/lib/axios';
import { Company, Branch } from '@/store/tenant-store';

// Alias for convenience
const api = axiosInstance;

// Switch tenant API
export interface SwitchTenantRequest {
  companyId: string;
  branchIds: string[];
}

export interface SwitchTenantResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  company: Company;
  branches: Branch[];
}

export async function switchTenant(request: SwitchTenantRequest): Promise<SwitchTenantResponse> {
  const response = await api.post<SwitchTenantResponse>('/auth/switch', request);
  return response.data;
}

// Branch CRUD APIs (headers added automatically by axios interceptor)
export async function getBranches(): Promise<Branch[]> {
  const response = await api.get<Branch[]>('/admin/branches');
  return response.data;
}

export async function createBranch(data: { code: string; name: string }): Promise<Branch> {
  const response = await api.post<Branch>('/admin/branches', data);
  return response.data;
}

export async function updateBranch(id: string, data: { code: string; name: string; status: string }): Promise<Branch> {
  const response = await api.patch<Branch>(`/admin/branches/${id}`, data);
  return response.data;
}

export async function deleteBranch(id: string): Promise<void> {
  await api.delete(`/admin/branches/${id}`);
}

export async function setDefaultBranch(id: string): Promise<void> {
  await api.put(`/admin/branches/${id}/default`, {});
}

export interface StatusChangeResponse {
  branch: Branch;
  employeeCount: number;
}

export async function changeBranchStatus(id: string, status: 'active' | 'suspended' | 'archived'): Promise<StatusChangeResponse> {
  const response = await api.patch<StatusChangeResponse>(`/admin/branches/${id}/status`, { status });
  return response.data;
}

export async function getBranchEmployeeCount(id: string): Promise<number> {
  const response = await api.get<{ count: number }>(`/admin/branches/${id}/employee-count`);
  return response.data.count;
}

// Company APIs
export interface CompanyData {
  id: string;
  code: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export async function getCurrentCompany(): Promise<CompanyData> {
  const response = await api.get<CompanyData>('/admin/company/current');
  return response.data;
}

export async function updateCurrentCompany(data: { code: string; name: string }): Promise<CompanyData> {
  const response = await api.put<CompanyData>('/admin/company/current', data);
  return response.data;
}

// User Branch Access APIs
export interface CompanyUser {
  id: string;
  username: string;
  role: string;
  createdAt: string;
}

export interface BranchAccess {
  branchId: string;
  code: string;
  name: string;
  isDefault: boolean;
}

export async function getCompanyUsers(): Promise<CompanyUser[]> {
  const response = await api.get<CompanyUser[]>('/admin/users');
  return response.data;
}

export async function getUserBranches(userId: string): Promise<BranchAccess[]> {
  const response = await api.get<{ data: BranchAccess[] }>(`/admin/users/${userId}/branches`);
  return response.data.data;
}

export async function setUserBranches(userId: string, branchIds: string[]): Promise<BranchAccess[]> {
  const response = await api.put<BranchAccess[]>(`/admin/users/${userId}/branches`, { branchIds });
  return response.data;
}

