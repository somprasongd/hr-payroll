# API Configuration Guide

## Overview

This document explains how to configure the API base URL for different environments in the HR Payroll web application.

## Configuration Files

### Environment Variables

The application uses environment variables to configure the API base URL. Create a `.env.local` file in the `web` directory:

```bash
# Copy the example file
cp .env.local.example .env.local
```

### Available Variables

- **NEXT_PUBLIC_API_BASE_URL**: The base URL for all API requests

## Environment Setup

### Development Environment

For local development with API running on `localhost:8080`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
```

### Production Environment (Behind Proxy)

For production deployment where both web and API are behind the same proxy:

```env
NEXT_PUBLIC_API_BASE_URL=/api/v1
```

### Production Environment (Different Domain)

If the API is hosted on a different domain:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api/v1
```

## Default Behavior

If `NEXT_PUBLIC_API_BASE_URL` is not set, the application will use:

- **Development** (`NODE_ENV=development`): `http://localhost:8080/api/v1`
- **Production** (`NODE_ENV=production`): `/api/v1`

This default behavior is defined in `src/config/api.ts`:

```typescript
export const API_CONFIG = {
  baseURL:
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    (process.env.NODE_ENV === "production"
      ? "/api/v1"
      : "http://localhost:8080/api/v1"),
  timeout: 30000, // 30 seconds
} as const;
```

## API Client

The application uses a centralized API client (`src/lib/api-client.ts`) that:

- Automatically includes the configured base URL
- Adds authentication token to requests
- Handles request/response formatting
- Provides error handling
- Implements request timeout

### Example Usage

```typescript
import { apiClient } from "@/lib/api-client";

// GET request
const data = await apiClient.get("/endpoint");

// POST request
const response = await apiClient.post("/endpoint", { key: "value" });

// PUT request
const updated = await apiClient.put("/endpoint/123", { key: "newValue" });

// DELETE request
await apiClient.delete("/endpoint/123");
```

## Authentication Service

The `src/services/auth.service.ts` provides authentication-related API calls:

```typescript
import { authService } from "@/services/auth.service";

// Login
const loginResponse = await authService.login({
  username: "user",
  password: "pass123",
});

// Get current user
const user = await authService.me();

// Logout
await authService.logout();
```

## Error Handling

The API client automatically handles errors and returns structured error objects:

```typescript
interface ApiError {
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
}
```

Example error handling:

```typescript
try {
  const response = await authService.login(credentials);
  // Handle success
} catch (err) {
  const apiError = err as ApiError;
  console.error(`Error ${apiError.statusCode}: ${apiError.message}`);
  // Handle error
}
```

## Proxy Configuration (Production)

When deploying behind a proxy (e.g., Nginx), configure the proxy to forward API requests:

### Nginx Example

```nginx
server {
    listen 80;
    server_name example.com;

    # Serve Next.js web application
    location / {
        proxy_pass http://web:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Proxy API requests
    location /api/v1 {
        proxy_pass http://api:8080/api/v1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## Troubleshooting

### CORS Issues

If you encounter CORS errors in development:

1. Ensure the API server has CORS configured to allow requests from `http://localhost:3000`
2. Check that the API base URL is correctly set in `.env.local`

### Connection Refused

If you get "connection refused" errors:

1. Verify the API server is running
2. Check the API base URL matches the server's address
3. Ensure there are no firewall rules blocking the connection

### 404 Not Found

If API requests return 404:

1. Verify the API endpoint paths are correct
2. Check that the base URL doesn't have duplicate `/api/v1` in the path
3. Review proxy configuration if in production

## Testing

To test the API configuration:

1. Start the development server:

   ```bash
   npm run dev
   ```

2. Open the browser console and check for API requests in the Network tab

3. Try logging in to verify the authentication flow works

## Security Notes

- Never commit `.env.local` to version control
- Use HTTPS in production
- Store sensitive API keys in environment variables
- Implement proper CORS policies on the API server
- Use secure token storage (the app uses localStorage with appropriate security measures)

## Related Files

- `web/src/config/api.ts` - API configuration
- `web/src/lib/api-client.ts` - HTTP client implementation
- `web/src/services/auth.service.ts` - Authentication service
- `web/src/store/auth-store.ts` - Authentication state management
- `web/.env.local.example` - Example environment configuration
