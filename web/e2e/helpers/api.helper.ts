import { apiBaseUrl } from '../fixtures/auth.fixture';

interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  status: number;
}

/**
 * Make authenticated API calls for test setup/teardown
 */
export class ApiHelper {
  private accessToken: string | null = null;

  /**
   * Login to get access token
   */
  async login(username: string, password: string): Promise<void> {
    const response = await fetch(`${apiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status}`);
    }

    const data = await response.json();
    this.accessToken = data.accessToken;
  }

  /**
   * Make authenticated GET request
   */
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${apiBaseUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    return {
      data: response.ok ? await response.json() : undefined,
      status: response.status,
    };
  }

  /**
   * Make authenticated POST request
   */
  async post<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    const response = await fetch(`${apiBaseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(body),
    });

    return {
      data: response.ok ? await response.json() : undefined,
      status: response.status,
    };
  }

  /**
   * Make authenticated DELETE request
   */
  async delete(endpoint: string): Promise<ApiResponse> {
    const response = await fetch(`${apiBaseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    return {
      status: response.status,
    };
  }
}

// Singleton instance
export const apiHelper = new ApiHelper();
