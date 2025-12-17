import { apiClient } from '@/lib/api-client';

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

export const activityLogService = {
  getLogs: async (params?: GetActivityLogsParams): Promise<ActivityLogListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.action) queryParams.append('action', params.action);
    if (params?.entity) queryParams.append('entity', params.entity);
    if (params?.fromDate) queryParams.append('fromDate', params.fromDate);
    if (params?.toDate) queryParams.append('toDate', params.toDate);
    if (params?.userName) queryParams.append('userName', params.userName);

    return apiClient.get<ActivityLogListResponse>(`/admin/activity-logs?${queryParams.toString()}`);
  },

  getLatestLogs: async (limit: number = 5): Promise<ActivityLogListResponse> => {
    return apiClient.get<ActivityLogListResponse>(`/admin/activity-logs/latest?limit=${limit}`);
  },

  getFilterOptions: async (): Promise<FilterOptions> => {
    return apiClient.get<FilterOptions>('/admin/activity-logs/filter-options');
  },
};
