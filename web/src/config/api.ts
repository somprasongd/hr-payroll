/**
 * API Configuration
 * 
 * This file contains the configuration for API base URL.
 * - In development: uses NEXT_PUBLIC_API_BASE_URL or defaults to http://localhost:8080/api/v1
 * - In production: uses NEXT_PUBLIC_API_BASE_URL or defaults to /api/v1 (for proxy setup)
 */

export const API_CONFIG = {
  rootURL: process.env.NEXT_PUBLIC_API_URL || 
           (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8080'),
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 
           (process.env.NODE_ENV === 'production' ? '/api/v1' : 'http://localhost:8080/api/v1'),
  timeout: 30000, // 30 seconds
} as const;
