/**
 * API Client
 * 
 * A centralized HTTP client for making API requests.
 * Now uses axios instance with automatic token refresh support.
 */

import { axiosInstance } from './axios';
import { AxiosError, AxiosRequestConfig } from 'axios';

export interface ApiError {
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
  detail?: string;  // Error code from API for i18n
}

class ApiClient {
  async get<T>(endpoint: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await axiosInstance.get<T>(endpoint, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    try {
      const response = await axiosInstance.post<T>(endpoint, data);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    try {
      const response = await axiosInstance.put<T>(endpoint, data);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    try {
      const response = await axiosInstance.patch<T>(endpoint, data);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async delete<T>(endpoint: string): Promise<T> {
    try {
      const response = await axiosInstance.delete<T>(endpoint);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: unknown): ApiError {
    if (error instanceof AxiosError) {
      const data = error.response?.data;
      const detail = data?.detail || data?.details;
      
      return {
        message: detail || data?.message || error.message || 'An error occurred',
        statusCode: error.response?.status || 500,
        errors: data?.errors,
        detail: detail,
      };
    }

    return {
      message: 'An unexpected error occurred',
      statusCode: 500,
    };
  }
}

export const apiClient = new ApiClient();
export type { ApiError as ApiErrorType };

