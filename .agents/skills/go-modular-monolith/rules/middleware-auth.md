# middleware-auth

JWT authentication middleware.

## Why JWT Middleware

- Stateless authentication
- Token-based access control
- Works with HttpOnly cookies or Authorization header

## File: api/shared/common/middleware/auth.go

```go
package middleware

import (
    "strings"
    "github.com/gofiber/fiber/v3"
    "github.com/google/uuid"
    "{project}/api/shared/common/contextx"
    "{project}/api/shared/common/errs"
    "{project}/api/shared/common/jwt"
)

func Auth(tokenSvc *jwt.TokenService) fiber.Handler {
    return func(c fiber.Ctx) error {
        // 1. Extract token from header
        authHeader := c.Get("Authorization")
        if authHeader == "" {
            return errs.Unauthorized("missing authorization header")
        }
        
        // 2. Parse Bearer token
        parts := strings.SplitN(authHeader, " ", 2)
        if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
            return errs.Unauthorized("invalid authorization header format")
        }
        
        // 3. Validate token
        claims, err := tokenSvc.ValidateAccessToken(parts[1])
        if err != nil {
            return errs.Unauthorized("invalid token")
        }
        
        // 4. Add user to context
        c.SetUserContext(contextx.UserToContext(c.Context(), contextx.UserInfo{
            ID:   claims.UserID,
            Role: claims.Role,
        }))
        
        return c.Next()
    }
}

func RequireRoles(roles ...string) fiber.Handler {
    return func(c fiber.Ctx) error {
        user, ok := contextx.UserFromContext(c.Context())
        if !ok {
            return errs.Unauthorized("missing user context")
        }
        
        for _, role := range roles {
            if user.Role == role {
                return c.Next()
            }
        }
        
        return errs.Forbidden("insufficient permissions")
    }
}
```

## Registration

### App Level (not recommended for auth)
Usually registered at module level for flexibility.

### Module Level
```go
func (m *Module) RegisterRoutes(r fiber.Router) {
    // Auth required for all routes
    group := r.Group("/products", middleware.Auth(m.tokenSvc))
    
    // Role-based access
    adminOnly := group.Group("", middleware.RequireRoles("admin"))
    create.NewEndpoint(adminOnly)
}
```

## Common Pitfalls

**Incorrect: Not checking context existence**
```go
// ❌ May panic if middleware not applied
user := contextx.UserFromContext(ctx)  // No check!
```

**Correct: Always check context**
```go
// ✅ Safe context extraction
user, ok := contextx.UserFromContext(ctx)
if !ok {
    return errs.Unauthorized("missing user context")
}
```
