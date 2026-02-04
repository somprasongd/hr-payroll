# module-dto

Data transfer objects with conversion helpers.

## Why DTOs

- Decouple internal models from API responses
- Different views for list vs detail
- Format dates and enums consistently
- Hide sensitive internal fields

## File: internal/dto/dto.go

```go
package dto

import (
    "time"
    "{project}/api/modules/{module}/internal/repository"
)

// ListItem for list responses (minimal fields)
type ListItem struct {
    ID        string `json:"id"`
    Name      string `json:"name"`
    Status    string `json:"status"`
    CreatedAt string `json:"createdAt"`
}

// Detail for single item responses (all fields)
type Detail struct {
    ID          string   `json:"id"`
    Name        string   `json:"name"`
    Description *string  `json:"description,omitempty"`
    Status      string   `json:"status"`
    Metadata    Metadata `json:"metadata"`
    CreatedAt   string   `json:"createdAt"`
    UpdatedAt   string   `json:"updatedAt"`
}

// Metadata nested object
type Metadata struct {
    CreatedBy string `json:"createdBy"`
    UpdatedBy string `json:"updatedBy"`
}

// Pagination metadata
type Meta struct {
    CurrentPage int `json:"currentPage"`
    TotalPages  int `json:"totalPages"`
    TotalItems  int `json:"totalItems"`
}

// Response wrappers
type ListResponse struct {
    Data []ListItem `json:"data"`
    Meta Meta       `json:"meta"`
}

type DetailResponse struct {
    Data Detail `json:"data"`
}

// Conversion functions from repository records

func FromListRecord(r repository.ListRecord) ListItem {
    return ListItem{
        ID:        r.ID.String(),
        Name:      r.Name,
        Status:    r.Status,
        CreatedAt: r.CreatedAt.Format(time.RFC3339),
    }
}

func FromRecord(r repository.Record) Detail {
    return Detail{
        ID:          r.ID.String(),
        Name:        r.Name,
        Description: r.Description,
        Status:      r.Status,
        Metadata: Metadata{
            CreatedBy: r.CreatedBy.String(),
            UpdatedBy: r.UpdatedBy.String(),
        },
        CreatedAt: r.CreatedAt.Format(time.RFC3339),
        UpdatedAt: r.UpdatedAt.Format(time.RFC3339),
    }
}

// Batch conversion helpers

func FromListRecords(records []repository.ListRecord) []ListItem {
    result := make([]ListItem, len(records))
    for i, r := range records {
        result[i] = FromListRecord(r)
    }
    return result
}
```

## DTO Patterns

1. **ListItem** - Minimal fields for list views
2. **Detail** - All fields for single item view
3. **Conversion functions** - Transform repository records to DTOs
4. **Consistent formatting** - RFC3339 dates, string IDs

## Common Pitfalls

**Incorrect: Returning internal models**
```go
// ❌ Exposes internal structure
return c.JSON(record)  // Raw repository record
```

**Correct: Use DTOs**
```go
// ✅ Controlled response shape
return c.JSON(dto.FromRecord(record))
```

**Incorrect: Inconsistent date formats**
```go
// ❌ Different formats across endpoints
CreatedAt: record.CreatedAt.String()  // 2009-11-10 23:00:00 +0000 UTC m=+0.000000001
```

**Correct: Standardized format**
```go
// ✅ Consistent RFC3339
CreatedAt: record.CreatedAt.Format(time.RFC3339)  // 2009-11-10T23:00:00Z
```
