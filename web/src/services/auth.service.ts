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
}

export interface RefreshTokenResponse {
  accessToken: string;
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
   * Verify token and get current user info
   */
  async me(): Promise<LoginResponse['user']> {
    return apiClient.get<LoginResponse['user']>('/auth/me');
  },
};
