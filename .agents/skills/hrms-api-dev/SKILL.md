---
name: hrms-api-dev
description: HR Payroll API development skill for creating backend modules in the modular monolith architecture. Use when creating new API modules, features, commands, queries, endpoints, or repositories. Covers CQRS patterns with mediator, Go module structure, Fiber v3 routing, PostgreSQL with sqlx, multi-tenancy, and event-driven patterns.
---

# HRMS API Development Skill

This skill provides patterns for developing backend API modules in the HR Payroll modular monolith system.

## Architecture Overview

- **Modular Monolith** with clear domain boundaries
- **CQRS Pattern**: Commands (write) and Queries (read) separated
- **Mediator Pattern**: Central dispatcher for commands/queries
- **Multi-Tenancy**: PostgreSQL RLS with X-Company-ID and X-Branch-ID headers
- **Event-Driven**: Event bus for async cross-module communication

## Module Structure

```
api/modules/{module}/
├── module.go                    # Module definition, route registration
├── go.mod                       # Separate Go module
├── internal/
│   ├── dto/                    # Data transfer objects
│   ├── entity/                 # Domain entities (if needed)
│   ├── feature/                # Use cases
│   │   ├── create/             # Command example
│   │   │   ├── command.go
│   │   │   └── endpoint.go
│   │   ├── list/               # Query example
│   │   │   ├── query.go
│   │   │   └── endpoint.go
│   │   └── ...
│   ├── repository/             # Data access layer
│   │   └── repository.go
│   └── subscriber/             # Event handlers (if needed)
└── doc.go                      # Public types (if needed)
```

## Module Definition (module.go)

```go
package example

import (
    "hrms/modules/example/internal/feature/create"
    "hrms/modules/example/internal/feature/list"
    "hrms/modules/example/internal/repository"
    "hrms/shared/common/eventbus"
    "hrms/shared/common/jwt"
    "hrms/shared/common/mediator"
    "hrms/shared/common/middleware"
    "hrms/shared/common/module"

    "github.com/gofiber/fiber/v3"
)

type Module struct {
    ctx      *module.ModuleContext
    repo     repository.Repository
    tokenSvc *jwt.TokenService
}

func NewModule(ctx *module.ModuleContext, tokenSvc *jwt.TokenService) *Module {
    repo := repository.NewRepository(ctx.DBCtx)
    return &Module{
        ctx:      ctx,
        repo:     repo,
        tokenSvc: tokenSvc,
    }
}

func (m *Module) APIVersion() string { return "v1" }

func (m *Module) Init(eventBus eventbus.EventBus) error {
    // Register handlers with mediator
    mediator.Register[*list.Query, *list.Response](list.NewHandler(m.repo))
    mediator.Register[*create.Command, *create.Response](create.NewHandler(m.repo, m.ctx.Transactor, eventBus))
    return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
    group := r.Group("/examples", middleware.Auth(m.tokenSvc), middleware.TenantMiddleware())
    list.NewEndpoint(group)
    create.NewEndpoint(group.Group("", middleware.RequireRoles("admin", "hr")))
}
```

## Command Pattern (Write Operations)

### command.go

```go
package create

import (
    "context"
    
    "hrms/modules/example/internal/dto"
    "hrms/modules/example/internal/repository"
    "hrms/shared/common/contextx"
    "hrms/shared/common/errs"
    "hrms/shared/common/eventbus"
    "hrms/shared/common/mediator"
    "hrms/shared/common/storage/sqldb/transactor"
    "hrms/shared/events"
)

type Command struct {
    Payload RequestBody
}

type Response struct {
    dto.Detail
}

type Handler struct {
    repo repository.Repository
    tx   transactor.Transactor
    eb   eventbus.EventBus
}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository, tx transactor.Transactor, eb eventbus.EventBus) *Handler {
    return &Handler{repo: repo, tx: tx, eb: eb}
}

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
    tenant, ok := contextx.TenantFromContext(ctx)
    if !ok {
        return nil, errs.Unauthorized("missing tenant context")
    }
    
    user, ok := contextx.UserFromContext(ctx)
    if !ok {
        return nil, errs.Unauthorized("missing user context")
    }
    
    // Validation
    if err := validatePayload(cmd.Payload); err != nil {
        return nil, err
    }
    
    // Business logic
    recPayload := cmd.Payload.ToRecord()
    
    var created *repository.Record
    err := h.tx.WithinTransaction(ctx, func(ctxWithTx context.Context, hook func(transactor.PostCommitHook)) error {
        var err error
        created, err = h.repo.Create(ctxWithTx, recPayload, tenant.CompanyID, tenant.BranchID, user.ID)
        if err != nil {
            return err
        }
        
        // Post-commit event
        hook(func(ctx context.Context) error {
            h.eb.Publish(events.LogEvent{
                ActorID:    user.ID,
                CompanyID:  &tenant.CompanyID,
                BranchID:   tenant.BranchIDPtr(),
                Action:     "CREATE",
                EntityName: "EXAMPLE",
                EntityID:   created.ID.String(),
                Details:    map[string]interface{}{},
                Timestamp:  created.CreatedAt,
            })
            return nil
        })
        
        return nil
    })
    if err != nil {
        return nil, errs.Internal("failed to create")
    }
    
    return &Response{Detail: dto.FromRecord(*created)}, nil
}

func validatePayload(p RequestBody) error {
    if p.Name == "" {
        return errs.BadRequest("name is required")
    }
    return nil
}
```

## Query Pattern (Read Operations)

### query.go

```go
package list

import (
    "context"
    "math"
    "strings"
    
    "hrms/modules/example/internal/dto"
    "hrms/modules/example/internal/repository"
    "hrms/shared/common/contextx"
    "hrms/shared/common/errs"
    "hrms/shared/common/logger"
    "hrms/shared/common/mediator"
    
    "go.uber.org/zap"
)

type Query struct {
    Page     int
    Limit    int
    Search   string
    Status   string
}

type Response struct {
    Data []dto.ListItem `json:"data"`
    Meta dto.Meta       `json:"meta"`
}

type Handler struct {
    repo repository.Repository
}

var _ mediator.RequestHandler[*Query, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository) *Handler {
    return &Handler{repo: repo}
}

func (h *Handler) Handle(ctx context.Context, q *Query) (*Response, error) {
    // Default pagination
    if q.Page < 1 {
        q.Page = 1
    }
    if q.Limit <= 0 || q.Limit > 1000 {
        q.Limit = 1000
    }
    q.Status = strings.TrimSpace(q.Status)
    if q.Status == "" {
        q.Status = "all"
    }
    
    tenant, ok := contextx.TenantFromContext(ctx)
    if !ok {
        return nil, errs.Unauthorized("missing tenant context")
    }
    
    res, err := h.repo.List(ctx, tenant, q.Page, q.Limit, q.Search, q.Status)
    if err != nil {
        logger.FromContext(ctx).Error("failed to list", zap.Error(err))
        return nil, errs.Internal("failed to list")
    }
    
    var data []dto.ListItem
    for _, r := range res.Rows {
        data = append(data, dto.FromListRecord(r))
    }
    if data == nil {
        data = make([]dto.ListItem, 0)
    }
    
    totalPages := int(math.Ceil(float64(res.Total) / float64(q.Limit)))
    if totalPages == 0 {
        totalPages = 1
    }
    
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

## Endpoint Pattern

### endpoint.go (Command)

```go
package create

import (
    "github.com/gofiber/fiber/v3"
    
    "hrms/shared/common/errs"
    "hrms/shared/common/mediator"
    "hrms/shared/common/response"
)

type RequestBody struct {
    Name string `json:"name" validate:"required"`
    // Add fields with validate tags
}

func (p RequestBody) ToRecord() repository.Record {
    return repository.Record{
        Name: p.Name,
    }
}

// Create example
// @Summary Create example
// @Description Create a new example
// @Tags Examples
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body RequestBody true "example payload"
// @Success 201 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Router /examples [post]
func NewEndpoint(router fiber.Router) {
    router.Post("/", func(c fiber.Ctx) error {
        var req RequestBody
        if err := c.Bind().Body(&req); err != nil {
            return errs.BadRequest("invalid request body")
        }
        
        resp, err := mediator.Send[*Command, *Response](c.Context(), &Command{
            Payload: req,
        })
        if err != nil {
            return err
        }
        
        return response.JSON(c, fiber.StatusCreated, resp.Detail)
    })
}
```

### endpoint.go (Query)

```go
package list

import (
    "strconv"
    
    "github.com/gofiber/fiber/v3"
    
    "hrms/shared/common/mediator"
    "hrms/shared/common/response"
)

// List examples
// @Summary List examples
// @Description List all examples with pagination
// @Tags Examples
// @Produce json
// @Param page query int false "page"
// @Param limit query int false "limit"
// @Param search query string false "search term"
// @Param status query string false "status filter"
// @Security BearerAuth
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Success 200 {object} Response
// @Failure 401
// @Failure 403
// @Router /examples [get]
func NewEndpoint(router fiber.Router) {
    router.Get("/", func(c fiber.Ctx) error {
        page, _ := strconv.Atoi(c.Query("page", "1"))
        limit, _ := strconv.Atoi(c.Query("limit", "20"))
        search := c.Query("search")
        status := c.Query("status", "all")
        
        resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{
            Page:   page,
            Limit:  limit,
            Search: search,
            Status: status,
        })
        if err != nil {
            return err
        }
        
        return response.JSON(c, fiber.StatusOK, resp)
    })
}
```

## Repository Pattern

### repository.go

```go
package repository

import (
    "context"
    "database/sql"
    "errors"
    "fmt"
    "strings"
    "time"
    
    "github.com/google/uuid"
    "github.com/lib/pq"
    
    "hrms/shared/common/contextx"
    "hrms/shared/common/storage/sqldb/transactor"
)

type Repository struct {
    dbCtx transactor.DBTXContext
}

func NewRepository(dbCtx transactor.DBTXContext) Repository {
    return Repository{dbCtx: dbCtx}
}

// Record structures
type ListRecord struct {
    ID        uuid.UUID `db:"id"`
    Name      string    `db:"name"`
    CreatedAt time.Time `db:"created_at"`
}

type Record struct {
    ID          uuid.UUID  `db:"id"`
    Name        string     `db:"name"`
    CompanyID   uuid.UUID  `db:"company_id"`
    BranchID    uuid.UUID  `db:"branch_id"`
    CreatedAt   time.Time  `db:"created_at"`
    UpdatedAt   time.Time  `db:"updated_at"`
    CreatedBy   uuid.UUID  `db:"created_by"`
    UpdatedBy   uuid.UUID  `db:"updated_by"`
    DeletedAt   *time.Time `db:"deleted_at"`
    DeletedBy   *uuid.UUID `db:"deleted_by"`
}

type ListResult struct {
    Rows  []ListRecord
    Total int
}

// List with pagination and filtering
func (r Repository) List(ctx context.Context, tenant contextx.TenantInfo, page, limit int, search, status string) (ListResult, error) {
    db := r.dbCtx(ctx)
    offset := (page - 1) * limit
    
    var where []string
    var args []interface{}
    
    where = append(where, "deleted_at IS NULL")
    args = append(args, tenant.CompanyID)
    where = append(where, fmt.Sprintf("company_id = $%d", len(args)))
    
    if tenant.HasBranchID() {
        args = append(args, tenant.BranchID)
        where = append(where, fmt.Sprintf("branch_id = $%d", len(args)))
    }
    
    if s := strings.TrimSpace(search); s != "" {
        val := "%" + strings.ToLower(s) + "%"
        args = append(args, val)
        where = append(where, fmt.Sprintf("LOWER(name) LIKE $%d", len(args)))
    }
    
    whereClause := strings.Join(where, " AND ")
    args = append(args, limit, offset)
    
    query := fmt.Sprintf(`
        SELECT id, name, created_at
        FROM examples
        WHERE %s
        ORDER BY created_at DESC
        LIMIT $%d OFFSET $%d
    `, whereClause, len(args)-1, len(args))
    
    rows, err := db.QueryxContext(ctx, query, args...)
    if err != nil {
        return ListResult{}, err
    }
    defer rows.Close()
    
    var list []ListRecord
    for rows.Next() {
        var rec ListRecord
        if err := rows.StructScan(&rec); err != nil {
            return ListResult{}, err
        }
        list = append(list, rec)
    }
    
    countArgs := args[:len(args)-2]
    countQuery := fmt.Sprintf("SELECT COUNT(1) FROM examples WHERE %s", whereClause)
    var total int
    if err := db.GetContext(ctx, &total, countQuery, countArgs...); err != nil {
        return ListResult{}, err
    }
    
    if list == nil {
        list = make([]ListRecord, 0)
    }
    
    return ListResult{Rows: list, Total: total}, nil
}

// Get single record
func (r Repository) Get(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID) (*Record, error) {
    db := r.dbCtx(ctx)
    q := `
        SELECT *
        FROM examples
        WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
        LIMIT 1`
    args := []interface{}{id, tenant.CompanyID}
    
    if tenant.HasBranchID() {
        q = strings.Replace(q, "company_id = $2", "company_id = $2 AND branch_id = $3", 1)
        args = append(args, tenant.BranchID)
    }
    
    var rec Record
    if err := db.GetContext(ctx, &rec, q, args...); err != nil {
        return nil, err
    }
    return &rec, nil
}

// Create with named parameters
func (r Repository) Create(ctx context.Context, payload Record, companyID, branchID, actor uuid.UUID) (*Record, error) {
    db := r.dbCtx(ctx)
    const q = `
        INSERT INTO examples (name, company_id, branch_id, created_by, updated_by)
        VALUES (:name, :company_id, :branch_id, :created_by, :updated_by)
        RETURNING *`
    
    payload.CreatedAt = time.Now()
    payload.UpdatedAt = payload.CreatedAt
    
    params := map[string]interface{}{
        "name":       payload.Name,
        "company_id": companyID,
        "branch_id":  branchID,
        "created_by": actor,
        "updated_by": actor,
    }
    
    stmt, err := db.PrepareNamedContext(ctx, q)
    if err != nil {
        return nil, err
    }
    defer stmt.Close()
    
    var rec Record
    if err := stmt.GetContext(ctx, &rec, params); err != nil {
        return nil, err
    }
    return &rec, nil
}

// Soft delete
func (r Repository) SoftDelete(ctx context.Context, tenant contextx.TenantInfo, id, actor uuid.UUID) error {
    db := r.dbCtx(ctx)
    q := `UPDATE examples SET deleted_at = now(), deleted_by = $1 WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL`
    args := []interface{}{actor, id, tenant.CompanyID}
    
    if tenant.HasBranchID() {
        q += " AND branch_id = $4"
        args = append(args, tenant.BranchID)
    }
    
    res, err := db.ExecContext(ctx, q, args...)
    if err != nil {
        return err
    }
    if rows, _ := res.RowsAffected(); rows == 0 {
        return sql.ErrNoRows
    }
    return nil
}

// Helper for unique constraint violations
func IsUniqueViolation(err error) bool {
    var pqErr *pq.Error
    if errors.As(err, &pqErr) {
        return pqErr.Code == "23505"
    }
    return false
}
```

## DTO Pattern

### dto/dto.go

```go
package dto

type ListItem struct {
    ID        string `json:"id"`
    Name      string `json:"name"`
    CreatedAt string `json:"createdAt"`
}

type Detail struct {
    ID        string `json:"id"`
    Name      string `json:"name"`
    CreatedAt string `json:"createdAt"`
    UpdatedAt string `json:"updatedAt"`
}

type Meta struct {
    CurrentPage int `json:"currentPage"`
    TotalPages  int `json:"totalPages"`
    TotalItems  int `json:"totalItems"`
}

// Helper functions to convert from records
func FromListRecord(r repository.ListRecord) ListItem {
    return ListItem{
        ID:        r.ID.String(),
        Name:      r.Name,
        CreatedAt: r.CreatedAt.Format(time.RFC3339),
    }
}

func FromRecord(r repository.Record) Detail {
    return Detail{
        ID:        r.ID.String(),
        Name:      r.Name,
        CreatedAt: r.CreatedAt.Format(time.RFC3339),
        UpdatedAt: r.UpdatedAt.Format(time.RFC3339),
    }
}
```

## Go Module (go.mod)

```go
module hrms/modules/example

go 1.25.0

replace hrms/shared/common v0.0.0 => ../../shared/common
replace hrms/shared/events v0.0.0 => ../../shared/events
replace hrms/shared/contracts v0.0.0 => ../../shared/contracts

require (
    github.com/gofiber/fiber/v3 v3.0.0-rc.3
    github.com/google/uuid v1.6.0
    github.com/lib/pq v1.10.9
    go.uber.org/zap v1.27.1
    hrms/shared/common v0.0.0
    hrms/shared/contracts v0.0.0
    hrms/shared/events v0.0.0
)
```

## Common Patterns

### Error Handling

Use the `errs` package for consistent error responses:

```go
errs.BadRequest("validation failed")      // 400
errs.Unauthorized("invalid token")        // 401
errs.Forbidden("insufficient permissions") // 403
errs.NotFound("record not found")         // 404
errs.Conflict("already exists")           // 409
errs.Internal("database error")           // 500
```

### Context Values

```go
// Extract tenant info
tenant, ok := contextx.TenantFromContext(ctx)
if !ok {
    return nil, errs.Unauthorized("missing tenant context")
}

// Extract user info
user, ok := contextx.UserFromContext(ctx)
if !ok {
    return nil, errs.Unauthorized("missing user context")
}
```

### Validation

```go
import "hrms/shared/common/validator"

func validatePayload(p RequestBody) error {
    if err := validator.Validate(&p); err != nil {
        return err
    }
    // Additional business rules
    return nil
}
```

### Transactions

```go
err := h.tx.WithinTransaction(ctx, func(ctxWithTx context.Context, hook func(transactor.PostCommitHook)) error {
    // Database operations here use ctxWithTx
    created, err := h.repo.Create(ctxWithTx, payload, companyID, branchID, userID)
    if err != nil {
        return err
    }
    
    // Post-commit hooks for async operations
    hook(func(ctx context.Context) error {
        h.eb.Publish(events.LogEvent{...})
        return nil
    })
    
    return nil
})
```

### Optional UUID Type

For handling optional UUID fields in request bodies:

```go
type OptionalUUID struct {
    uuid.UUID
    Valid bool
}

func (o *OptionalUUID) UnmarshalJSON(data []byte) error {
    if string(data) == "null" || string(data) == `""` {
        o.Valid = false
        return nil
    }
    if err := json.Unmarshal(data, &o.UUID); err != nil {
        return err
    }
    o.Valid = true
    return nil
}

func (o OptionalUUID) Ptr() *uuid.UUID {
    if o.Valid {
        return &o.UUID
    }
    return nil
}
```

## Routing & Middleware

```go
// Group with auth and tenant
group := r.Group("/examples", 
    middleware.Auth(m.tokenSvc), 
    middleware.TenantMiddleware(),
)

// Role-based access
adminOnly := group.Group("", middleware.RequireRoles("admin"))
hrAndAdmin := group.Group("", middleware.RequireRoles("admin", "hr"))

// Register endpoints
list.NewEndpoint(group)          // All authenticated users
create.NewEndpoint(adminOnly)    // Admin only
```

## Event Publishing

```go
import "hrms/shared/events"

h.eb.Publish(events.LogEvent{
    ActorID:    user.ID,
    CompanyID:  &tenant.CompanyID,
    BranchID:   tenant.BranchIDPtr(),
    Action:     "CREATE",
    EntityName: "EMPLOYEE",
    EntityID:   created.ID.String(),
    Details:    map[string]interface{}{},
    Timestamp:  time.Now(),
})
```
