import { apiClient } from "@/lib/api-client";

export interface User {
  id: string;
  username: string;
  role: "admin" | "hr" | "timekeeper";
  createdAt: string;
  lastLoginAt?: string;
}

export interface CreateUserRequest {
  username: string;
  password?: string; // Optional because we might auto-generate or set default
  role: "admin" | "hr" | "timekeeper";
}

export interface UpdateUserRoleRequest {
  role: "admin" | "hr" | "timekeeper";
}

export interface ResetPasswordRequest {
  newPassword: string;
}

export interface UserListResponse {
  data: User[];
  meta: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
  };
}

export interface GetUsersParams {
  page?: number;
  limit?: number;
  role?: string;
}

export const userService = {
  getUsers: async (params?: GetUsersParams): Promise<UserListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.role) queryParams.append("role", params.role);

    return apiClient.get<UserListResponse>(
      `/admin/users?${queryParams.toString()}`,
    );
  },

  getUser: async (id: string): Promise<User> => {
    return apiClient.get<User>(`/admin/users/${id}`);
  },

  createUser: async (data: CreateUserRequest): Promise<User> => {
    return apiClient.post<User>("/admin/users", data);
  },

  updateUserRole: async (
    id: string,
    role: "admin" | "hr" | "timekeeper",
  ): Promise<User> => {
    return apiClient.patch<User>(`/admin/users/${id}`, { role });
  },

  resetUserPassword: async (
    id: string,
    data: ResetPasswordRequest,
  ): Promise<{ message: string }> => {
    return apiClient.post<{ message: string }>(
      `/admin/users/${id}/password-reset`,
      data,
    );
  },

  deleteUser: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/admin/users/${id}`);
  },
};
