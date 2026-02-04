# middleware-module

Route-level middleware chains.

## Why Module-Level Middleware

- Different auth requirements per module
- Role-based access control
- API key for webhooks
- Rate limiting per endpoint

## Registration in Module

```go
// api/modules/{module}/module.go
func (m *Module) RegisterRoutes(r fiber.Router) {
    // All routes require auth + tenant
    group := r.Group("/products", 
        middleware.Auth(m.tokenSvc),
        middleware.TenantMiddleware(),
    )
    
    // Public read (any authenticated user)
    list.NewEndpoint(group)
    get.NewEndpoint(group)
    
    // Admin only (additional role check)
    admin := group.Group("", middleware.RequireRoles("admin"))
    create.NewEndpoint(admin)
    update.NewEndpoint(admin)
    delete.NewEndpoint(admin)
}
```

## Middleware Chain Pattern

```go
// Compose multiple middleware
group := r.Group("/api/v1/products",
    middleware.Auth(tokenSvc),           // Validate JWT
    middleware.TenantMiddleware(),        // Extract company/branch
    middleware.RequireRoles("admin", "hr"), // Role check
)
```

## Conditional Middleware

```go
// API key only for webhooks
webhook := r.Group("/webhooks",
    middleware.APIKeyMiddleware([]string{"secret1", "secret2"}),
)
webhook.Post("/stripe", stripeHandler)

// Rate limited public endpoint
public := r.Group("/public",
    rateLimiter.Middleware(),
)
list.NewEndpoint(public)
```

## Superadmin Routes

```go
// Separate group for superadmin (no tenant headers)
superadmin := r.Group("/super-admin", 
    middleware.Auth(tokenSvc),
    middleware.RequireRoles("superadmin"),
)
superadmin.Get("/companies", listCompaniesHandler)
```

## Middleware Composition

```go
// Reusable middleware chains
var (
    Protected = []fiber.Handler{
        middleware.Auth(tokenSvc),
        middleware.TenantMiddleware(),
    }
    
    AdminOnly = []fiber.Handler{
        middleware.Auth(tokenSvc),
        middleware.TenantMiddleware(),
        middleware.RequireRoles("admin"),
    }
)

// Usage
products := r.Group("/products", Protected...)
adminProducts := r.Group("/admin/products", AdminOnly...)
```

## Common Pitfalls

**Incorrect: Auth in every endpoint**
```go
// ❌ Repetitive
func NewEndpoint(router fiber.Router) {
    router.Get("/", middleware.Auth(tokenSvc), handler)  // Repeated
}
```

**Correct: Group-level auth**
```go
// ✅ Applied to all routes in group
group := r.Group("/products", middleware.Auth(tokenSvc))
list.NewEndpoint(group)
get.NewEndpoint(group)
```

**Incorrect: Wrong order**
```go
// ❌ Tenant before auth (no user context)
group := r.Group("/products",
    middleware.TenantMiddleware(),
    middleware.Auth(tokenSvc),
)
```

**Correct: Auth before tenant**
```go
// ✅ Auth sets user, tenant uses it
group := r.Group("/products",
    middleware.Auth(tokenSvc),
    middleware.TenantMiddleware(),
)
```
