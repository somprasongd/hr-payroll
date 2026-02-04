# module-cqrs-query

Query handlers for read operations.

## Why Query Pattern

- Separates read from write logic
- Optimized for different read patterns
- No transaction overhead for reads
- Can use different data models

## File: internal/feature/{action}/query.go

```go
package list

import (
    "context"
    "math"
    "strings"
    "{project}/api/modules/{module}/internal/dto"
    "{project}/api/modules/{module}/internal/repository"
    "{project}/api/shared/common/contextx"
    "{project}/api/shared/common/errs"
    "{project}/api/shared/common/logger"
    "{project}/api/shared/common/mediator"
    "go.uber.org/zap"
)

// Query represents the read request
type Query struct {
    Page   int
    Limit  int
    Search string
    Status string
}

// Response contains query results
type Response struct {
    Data []dto.ListItem `json:"data"`
    Meta dto.Meta       `json:"meta"`
}

// Handler processes the query
type Handler struct {
    repo repository.Repository
}

var _ mediator.RequestHandler[*Query, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository) *Handler {
    return &Handler{repo: repo}
}

func (h *Handler) Handle(ctx context.Context, q *Query) (*Response, error) {
    // 1. Normalize pagination
    if q.Page < 1 {
        q.Page = 1
    }
    if q.Limit <= 0 || q.Limit > 1000 {
        q.Limit = 1000
    }
    
    // 2. Extract tenant
    tenant, ok := contextx.TenantFromContext(ctx)
    if !ok {
        return nil, errs.Unauthorized("missing tenant context")
    }
    
    // 3. Execute query (no transaction needed)
    res, err := h.repo.List(ctx, tenant, q.Page, q.Limit, q.Search, q.Status)
    if err != nil {
        logger.FromContext(ctx).Error("failed to list", zap.Error(err))
        return nil, errs.Internal("failed to list")
    }
    
    // 4. Convert to DTOs
    var data []dto.ListItem
    for _, r := range res.Rows {
        data = append(data, dto.FromListRecord(r))
    }
    if data == nil {
        data = make([]dto.ListItem, 0)
    }
    
    // 5. Calculate pagination
    totalPages := int(math.Ceil(float64(res.Total) / float64(q.Limit)))
    if totalPages == 0 {
        totalPages = 1
    }
    
    // 6. Return response
    return &Response{
        Data: data,
        Meta: dto.Meta{
            CurrentPage: q.Page,
            TotalPages:  totalPages,
            TotalItems:  res.Total,
        },
    }, nil
}
```

## Query Handler Pattern

1. **Normalize input** - Pagination, defaults
2. **Extract context** - Tenant for filtering
3. **Execute query** - Direct repository call
4. **Transform results** - Convert to DTOs
5. **Return response** - With pagination metadata

## Key Differences from Commands

| Aspect | Command | Query |
|--------|---------|-------|
| Transaction | Required | Not needed |
| Side effects | Yes (writes) | No (read-only) |
| Events | Publish after commit | No events |
| HTTP Method | POST, PUT, DELETE | GET |
| Response | Created/Updated entity | List or single item |

## Common Pitfalls

**Incorrect: Using transaction for reads**
```go
// ❌ Don't use transaction for pure reads
err := h.tx.WithinTransaction(ctx, func(...) {
    result, err = h.repo.List(ctx, ...)
})
```

**Correct: Direct repository call**
```go
// ✅ No transaction overhead for reads
result, err := h.repo.List(ctx, tenant, page, limit, search)
```

**Incorrect: Not initializing empty slices**
```go
// ❌ Returns null instead of []
return &Response{Data: data}  // data is nil when empty
```

**Correct: Always return empty slice**
```go
// ✅ Returns [] instead of null
if data == nil {
    data = make([]dto.ListItem, 0)
}
return &Response{Data: data}
```
