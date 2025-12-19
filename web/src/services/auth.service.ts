/**
 * Authentication Service
 * 
 * Handles authentication-related API calls
 */

import { apiClient } from '@/lib/api-client';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface CompanyInfo {
  id: string;
  code: string;
  name: string;
  status: string;
  role: string;
}

export interface BranchInfo {
  id: string;
  companyId: string;
  code: string;
  name: string;
  status: string;
  isDefault: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: {
    id: string;
    username: string;
    role: string;
  };
  // Optional: returned when user has company access
  companies?: CompanyInfo[];
  branches?: BranchInfo[];
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export const authService = {
  /**
   * Login with username and password
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>('/auth/login', credentials);
  },

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    return apiClient.post<RefreshTokenResponse>('/auth/refresh', { refreshToken });
  },

  /**
   * Logout (if API requires logout call)
   */
  async logout(): Promise<void> {
    return apiClient.post<void>('/auth/logout');
  },

  /**
   * Change own password
   */
  async changePassword(data: ChangePasswordRequest): Promise<void> {
    return apiClient.put<void>('/me/password', data);
  },

  /**
   * Verify token and get current user info
   */
  async me(): Promise<LoginResponse['user']> {
    return apiClient.get<LoginResponse['user']>('/me');
  },

  /**
   * Get user's companies and branches (for tenant selection)
   */
  async getUserCompanies(): Promise<{ companies: CompanyInfo[]; branches: BranchInfo[] }> {
    const response = await apiClient.get<{ data: { companies: CompanyInfo[]; branches: BranchInfo[] } }>('/me/companies');
    return response.data;
  },
};
