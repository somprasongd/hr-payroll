/**
 * Org Profile Service
 * 
 * Handles payroll org profile (slip header) API calls
 */

import { apiClient } from '@/lib/api-client';
import { axiosInstance } from '@/lib/axios';
import { API_CONFIG } from '@/config/api';

// ============================================================================
// Types
// ============================================================================

export interface OrgProfile {
  id: string;
  versionNo: number;
  startDate: string;
  endDate: string | null;
  status: 'active' | 'retired';
  companyName: string;
  addressLine1?: string;
  addressLine2?: string;
  subdistrict?: string;
  district?: string;
  province?: string;
  postalCode?: string;
  phoneMain?: string;
  phoneAlt?: string;
  email?: string;
  taxId?: string;
  slipFooterNote?: string;
  logoId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface CreateOrgProfileRequest {
  startDate: string;
  companyName: string;
  addressLine1?: string;
  addressLine2?: string;
  subdistrict?: string;
  district?: string;
  province?: string;
  postalCode?: string;
  phoneMain?: string;
  phoneAlt?: string;
  email?: string;
  taxId?: string;
  slipFooterNote?: string;
  logoId?: string;
}

export interface UploadLogoResponse {
  id: string;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  checksumMd5: string;
}

export interface LogoMetadata {
  id: string;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  checksumMd5: string;
  createdAt: string;
  createdBy: string;
}

export interface OrgProfileListResponse {
  data: OrgProfile[];
  meta: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
  };
}

// ============================================================================
// Logo Cache (ETag-based)
// ============================================================================

interface LogoCacheEntry {
  etag: string;
  dataUrl: string;
}

const LOGO_CACHE_PREFIX = 'org_logo_';

function getLogoCacheKey(logoId: string): string {
  return `${LOGO_CACHE_PREFIX}${logoId}`;
}

function getCachedLogo(logoId: string): LogoCacheEntry | null {
  try {
    const cached = localStorage.getItem(getLogoCacheKey(logoId));
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

function setCachedLogo(logoId: string, etag: string, dataUrl: string): void {
  try {
    localStorage.setItem(
      getLogoCacheKey(logoId),
      JSON.stringify({ etag, dataUrl })
    );
  } catch {
    // localStorage quota exceeded, ignore
  }
}

function removeCachedLogo(logoId: string): void {
  try {
    localStorage.removeItem(getLogoCacheKey(logoId));
  } catch {
    // ignore
  }
}

// ============================================================================
// Service
// ============================================================================

export const orgProfileService = {
  /**
   * Get the currently effective org profile
   */
  async getEffective(date?: string): Promise<OrgProfile> {
    const query = date ? `?date=${date}` : '';
    return apiClient.get<OrgProfile>(`/admin/payroll-org-profiles/effective${query}`);
  },

  /**
   * Get all org profiles (history)
   */
  async getAll(params?: { page?: number; limit?: number }): Promise<OrgProfileListResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    
    return apiClient.get<OrgProfileListResponse>(
      `/admin/payroll-org-profiles?${query.toString()}`
    );
  },

  /**
   * Get org profile by ID
   */
  async getById(id: string): Promise<OrgProfile> {
    return apiClient.get<OrgProfile>(`/admin/payroll-org-profiles/${id}`);
  },

  /**
   * Create a new org profile (new version)
   */
  async create(data: CreateOrgProfileRequest): Promise<OrgProfile> {
    return apiClient.post<OrgProfile>('/admin/payroll-org-profiles', data);
  },

  /**
   * Upload logo file
   */
  async uploadLogo(file: File): Promise<UploadLogoResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await axiosInstance.post<UploadLogoResponse>(
      '/admin/payroll-org-logos',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return response.data;
  },

  /**
   * Get logo URL for display
   */
  getLogoUrl(logoId: string): string {
    return `${API_CONFIG.baseURL}/admin/payroll-org-logos/${logoId}`;
  },

  /**
   * Get logo metadata
   */
  async getLogoMeta(logoId: string): Promise<LogoMetadata> {
    return apiClient.get<LogoMetadata>(`/admin/payroll-org-logos/${logoId}/meta`);
  },

  /**
   * Fetch logo with ETag caching
   * Returns data URL of the image, using cache when possible
   */
  async fetchLogoWithCache(logoId: string): Promise<string | null> {
    if (!logoId) return null;

    const cached = getCachedLogo(logoId);
    const headers: Record<string, string> = {};

    // If we have a cached version, send If-None-Match header
    if (cached?.etag) {
      headers['If-None-Match'] = cached.etag;
    }

    try {
      const response = await axiosInstance.get(`/admin/payroll-org-logos/${logoId}`, {
        responseType: 'blob',
        headers,
        validateStatus: (status) => status === 200 || status === 304,
      });

      // 304 Not Modified - use cached version
      if (response.status === 304 && cached?.dataUrl) {
        return cached.dataUrl;
      }

      // Get new logo and cache it
      const blob = response.data;
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      const etag = response.headers['etag'] || '';
      if (etag) {
        setCachedLogo(logoId, etag, dataUrl);
      }

      return dataUrl;
    } catch {
      // Network error, try to use cached version
      return cached?.dataUrl || null;
    }
  },

  /**
   * Clear logo cache for a specific logo
   */
  clearLogoCache(logoId: string): void {
    removeCachedLogo(logoId);
  },
};
