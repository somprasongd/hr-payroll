# shared-contextx

Tenant and user context extraction.

## Purpose

- Type-safe context values
- Avoid key collisions
- Helper methods for common checks

## File: api/shared/common/contextx/tenant.go

```go
package contextx

import (
    "context"
    "github.com/google/uuid"
)

// TenantInfo holds tenant context
type TenantInfo struct {
    CompanyID uuid.UUID
    BranchID  uuid.UUID
    IsAdmin   bool
}

type tenantKey struct{}

// TenantToContext adds tenant to context
func TenantToContext(ctx context.Context, tenant TenantInfo) context.Context {
    return context.WithValue(ctx, tenantKey{}, tenant)
}

// TenantFromContext retrieves tenant from context
func TenantFromContext(ctx context.Context) (TenantInfo, bool) {
    if ctx == nil {
        return TenantInfo{}, false
    }
    if v, ok := ctx.Value(tenantKey{}).(TenantInfo); ok {
        return v, true
    }
    return TenantInfo{}, false
}

// Helper methods

func (t TenantInfo) HasBranchID() bool {
    return t.BranchID != uuid.Nil
}

func (t TenantInfo) BranchIDPtr() *uuid.UUID {
    if t.BranchID == uuid.Nil {
        return nil
    }
    return &t.BranchID
}
```

## File: api/shared/common/contextx/user.go

```go
package contextx

import (
    "context"
    "github.com/google/uuid"
)

// UserInfo holds authenticated user
type UserInfo struct {
    ID   uuid.UUID
    Role string
}

type userKey struct{}

// UserToContext adds user to context
func UserToContext(ctx context.Context, user UserInfo) context.Context {
    return context.WithValue(ctx, userKey{}, user)
}

// UserFromContext retrieves user from context
func UserFromContext(ctx context.Context) (UserInfo, bool) {
    if ctx == nil {
        return UserInfo{}, false
    }
    if v, ok := ctx.Value(userKey{}).(UserInfo); ok {
        return v, true
    }
    return UserInfo{}, false
}
```

## Usage

```go
// In middleware (set)
c.SetUserContext(contextx.UserToContext(c.Context(), contextx.UserInfo{
    ID:   claims.UserID,
    Role: claims.Role,
}))

// In handler (get)
user, ok := contextx.UserFromContext(ctx)
if !ok {
    return errs.Unauthorized("missing user context")
}

tenant, ok := contextx.TenantFromContext(ctx)
if !ok {
    return errs.Unauthorized("missing tenant context")
}
```

## Common Pitfalls

**Incorrect: Using plain strings as keys**
```go
// ❌ Risk of collision
type key string
ctx.WithValue(ctx, key("user"), user)
```

**Correct: Use empty struct types**
```go
// ✅ Type-safe, no collision
type userKey struct{}
ctx.WithValue(ctx, userKey{}, user)
```

**Incorrect: Not checking nil context**
```go
// ❌ May panic
user := ctx.Value(userKey{}).(UserInfo)
```

**Correct: Safe extraction**
```go
// ✅ Checks both nil and type
if v, ok := ctx.Value(userKey{}).(UserInfo); ok {
    return v, true
}
```
