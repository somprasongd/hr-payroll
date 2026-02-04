# middleware-tenant

Multi-tenant context extraction.

## Purpose

- Extract tenant from HTTP headers
- Validate company/branch IDs
- Add tenant context to request

## File: api/shared/common/middleware/tenant.go

```go
package middleware

import (
    "github.com/gofiber/fiber/v3"
    "github.com/google/uuid"
    "{project}/api/shared/common/contextx"
    "{project}/api/shared/common/errs"
)

func TenantMiddleware() fiber.Handler {
    return func(c fiber.Ctx) error {
        // Extract from headers
        companyIDStr := c.Get("X-Company-ID")
        branchIDStr := c.Get("X-Branch-ID")
        
        // Validate company ID
        if companyIDStr == "" {
            return errs.BadRequest("missing X-Company-ID header")
        }
        
        companyID, err := uuid.Parse(companyIDStr)
        if err != nil {
            return errs.BadRequest("invalid X-Company-ID format")
        }
        
        // Build tenant info
        tenant := contextx.TenantInfo{
            CompanyID: companyID,
        }
        
        // Optional branch ID
        if branchIDStr != "" {
            branchID, err := uuid.Parse(branchIDStr)
            if err != nil {
                return errs.BadRequest("invalid X-Branch-ID format")
            }
            tenant.BranchID = branchID
        }
        
        // Set admin flag from user role
        if user, ok := contextx.UserFromContext(c.Context()); ok {
            tenant.IsAdmin = user.Role == "admin" || user.Role == "superadmin"
        }
        
        // Add to context
        c.SetUserContext(contextx.TenantToContext(c.Context(), tenant))
        return c.Next()
    }
}
```

## Required Headers

| Header | Required | Format | Description |
|--------|----------|--------|-------------|
| X-Company-ID | Yes | UUID | Current company |
| X-Branch-ID | No | UUID | Selected branch |

## Usage in Module

```go
func (m *Module) RegisterRoutes(r fiber.Router) {
    // Tenant middleware after auth
    group := r.Group("/products",
        middleware.Auth(m.tokenSvc),
        middleware.TenantMiddleware(),
    )
}
```

## Using Tenant Context

```go
func (h *Handler) Handle(ctx context.Context, q *Query) (*Response, error) {
    tenant, ok := contextx.TenantFromContext(ctx)
    if !ok {
        return nil, errs.Unauthorized("missing tenant context")
    }
    
    // Filter by tenant
    result, err := h.repo.List(ctx, tenant, page, limit)
}
```

## Common Pitfalls

**Incorrect: Missing validation**
```go
// ❌ Invalid UUID causes panic
companyID := uuid.Parse(c.Get("X-Company-ID"))  // May panic
```

**Correct: Validate before parse**
```go
// ✅ Handle invalid input
companyID, err := uuid.Parse(companyIDStr)
if err != nil {
    return errs.BadRequest("invalid X-Company-ID format")
}
```

**Incorrect: Before auth middleware**
```go
// ❌ No user context yet
group := r.Group("/products",
    middleware.TenantMiddleware(),  // No user!
    middleware.Auth(tokenSvc),
)
```

**Correct: After auth**
```go
// ✅ User context available
group := r.Group("/products",
    middleware.Auth(tokenSvc),
    middleware.TenantMiddleware(),
)
```
