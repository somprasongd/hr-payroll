# Services

This directory contains all API service modules for the HR Payroll application.

## Structure

Each service file contains functions for interacting with specific API endpoints. Services use the centralized `apiClient` from `@/lib/api-client`.

## Available Services

### Authentication Service (`auth.service.ts`)

Handles user authentication operations:

- `login(credentials)` - Authenticate user and receive token
- `logout()` - Logout user
- `me()` - Get current authenticated user info

**Example:**

```typescript
import { authService } from "@/services/auth.service";

const response = await authService.login({
  username: "admin",
  password: "password123",
});

console.log(response.token, response.user);
```

### Payroll Configuration Service (`payroll-config.service.ts`)

Manages payroll configuration settings:

- `getEffective()` - Get currently effective payroll config
- `getAll()` - Get all payroll configurations (history)
- `getById(id)` - Get specific configuration by ID
- `create(data)` - Create new payroll configuration

**Example:**

```typescript
import { payrollConfigService } from "@/services/payroll-config.service";

// Get current effective config
const currentConfig = await payrollConfigService.getEffective();

// Create new config
const newConfig = await payrollConfigService.create({
  hourlyRate: 50,
  otHourlyRate: 75,
  bonusNoLate: 500,
  bonusNoLeave: 500,
  housingAllowance: 3000,
  waterRate: 18,
  electricityRate: 4.5,
  internetFee: 600,
  employeeSocialSecurityRate: 5,
  employerSocialSecurityRate: 5,
  notes: "Updated rates for 2024",
  effectiveDate: "2024-01-01",
});
```

## Creating New Services

When creating a new service:

1. Create a new file following the naming pattern: `[entity].service.ts`
2. Import the `apiClient` from `@/lib/api-client`
3. Define TypeScript interfaces for request/response types
4. Export service functions as a named object

**Template:**

```typescript
/**
 * [Entity] Service
 *
 * Handles [entity]-related API calls
 */

import { apiClient } from "@/lib/api-client";

export interface EntityType {
  id: string;
  name: string;
  // ... other fields
}

export interface CreateEntityRequest {
  name: string;
  // ... other fields
}

export const entityService = {
  async getAll(): Promise<EntityType[]> {
    return apiClient.get<EntityType[]>("/entities");
  },

  async getById(id: string): Promise<EntityType> {
    return apiClient.get<EntityType>(`/entities/${id}`);
  },

  async create(data: CreateEntityRequest): Promise<EntityType> {
    return apiClient.post<EntityType>("/entities", data);
  },

  async update(
    id: string,
    data: Partial<CreateEntityRequest>
  ): Promise<EntityType> {
    return apiClient.put<EntityType>(`/entities/${id}`, data);
  },

  async delete(id: string): Promise<void> {
    return apiClient.delete<void>(`/entities/${id}`);
  },
};
```

## Error Handling

All services automatically handle errors through the `apiClient`. Errors are thrown as `ApiError` objects:

```typescript
import { ApiError } from "@/lib/api-client";

try {
  const data = await entityService.getAll();
} catch (err) {
  const error = err as ApiError;
  console.error(`API Error ${error.statusCode}: ${error.message}`);

  // Handle validation errors if present
  if (error.errors) {
    Object.entries(error.errors).forEach(([field, messages]) => {
      console.error(`${field}: ${messages.join(", ")}`);
    });
  }
}
```

## Best Practices

1. **Type Safety**: Always define request and response types
2. **JSDoc Comments**: Document each service function
3. **Consistent Naming**: Use clear, descriptive function names
4. **Error Handling**: Let errors bubble up to components
5. **Reusability**: Keep services focused on API calls only, business logic stays in components/hooks
6. **Authentication**: No need to manually add tokens, the `apiClient` handles it

## Related Files

- `../lib/api-client.ts` - Centralized HTTP client
- `../config/api.ts` - API configuration
- `../store/auth-store.ts` - Authentication state management
