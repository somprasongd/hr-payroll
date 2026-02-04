# Go Modular Monolith - Complete Guide

Comprehensive guide for building Go modular monolith APIs with CQRS, multi-tenancy, and clean architecture.

---

## Table of Contents

1. [Project Bootstrap](#1-project-bootstrap)
   - 1.1 Standard Folder Structure
   - 1.2 Go Workspace Configuration
   - 1.3 Application Entry Point
   - 1.4 Swagger Documentation
2. [Module Development](#2-module-development)
3. [Cross-Module Communication](#3-cross-module-communication-sync)
4. [Database & Migrations](#4-database--migrations)
5. [Middleware & Auth](#5-middleware--auth)
6. [Shared Libraries](#6-shared-libraries)
   - 6.1 Domain Errors
   - 6.2 Mediator Pattern
   - 6.3 Context Extensions
   - 6.4 Optional UUID Type
   - 6.5 Password Hashing (Argon2id)
   - 6.6 Cross-Module Contracts
7. [DevOps & Deployment](#7-devops--deployment)

---

## 1. Project Bootstrap

### 1.1 Standard Folder Structure

```
{project}/
├── api/
│   ├── app/
│   │   ├── cmd/api/main.go
│   │   ├── application/application.go
│   │   ├── application/http.go
│   │   ├── config/config.go
│   │   └── build/build.go
│   ├── modules/
│   │   └── {module}/
│   │       ├── module.go
│   │       ├── go.mod
│   │       └── internal/
│   │           ├── dto/
│   │           ├── feature/
│   │           └── repository/
│   └── shared/
│       ├── common/
│       ├── contracts/
│       └── events/
├── migrations/
├── docker-compose.yml
├── Dockerfile
├── Makefile
└── go.work
```

### 1.2 Go Workspace Configuration

**go.work:**
```go
go 1.25

use (
    ./api
    ./api/shared/common
    ./api/shared/events
    ./api/shared/contracts
)
```

**api/go.mod:**
```go
module {project}/api

go 1.25

require (
    github.com/gofiber/fiber/v3 v3.0.0-rc.3
    github.com/google/uuid v1.6.0
    github.com/jmoiron/sqlx v1.4.0
    github.com/lib/pq v1.10.9
    github.com/caarlos0/env/v11 v11.0.0
    github.com/golang-jwt/jwt/v5 v5.2.0
    github.com/go-playground/validator/v10 v10.22.0
    go.uber.org/zap v1.27.0
)

require (
    {project}/api/shared/common v0.0.0
    {project}/api/shared/events v0.0.0
    {project}/api/shared/contracts v0.0.0
)

replace (
    {project}/api/shared/common v0.0.0 => ./shared/common
    {project}/api/shared/events v0.0.0 => ./shared/events
    {project}/api/shared/contracts v0.0.0 => ./shared/contracts
)
```

### 1.4 Swagger Documentation

**Prerequisites (v2 - OpenAPI 3.0):**
```bash
go install github.com/swaggo/swag/v2/cmd/swag@latest
go get github.com/swaggo/fiber-swagger/v2
```

**Main Annotations:**
```go
// Package main API Server.
//
// @title           API
// @version         1.0.0
// @description     API Server
// @termsOfService  http://example.com/terms
//
// @contact.name   API Support
// @contact.email  support@example.com
//
// @license.name  Apache 2.0
// @license.url   http://www.apache.org/licenses/LICENSE-2.0.html
//
// @host      localhost:8080
// @BasePath  /api/v1
// @schemes   http https
//
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and JWT token.
```

**Handler Annotations:**
```go
// GetEmployee godoc
//
// @Summary     Get employee by ID
// @Description Get employee details with related data
// @Tags        Employee
// @Accept      json
// @Produce     json
// @Param       id   path      string true "Employee ID"
// @Success     200  {object}  ResponseBody
// @Failure     400  {object}  ErrorResponse
// @Failure     404  {object}  ErrorResponse
// @Security    BearerAuth
// @Router      /employees/{id} [get]
func (h *GetHandler) GetByID(c fiber.Ctx) error {
    // ...
}
```

**Generate and Register:**
```bash
# Generate docs
cd api && swag init -g app/main.go -o app/docs
```

```go
// middleware/swagger.go
func APIDoc(cfg config.Config) fiber.Handler {
    host := removeProtocol(cfg.GatewayHost)
    if host == "" {
        host = fmt.Sprintf("localhost:%d", cfg.HTTPPort)
    }
    
    docs.SwaggerInfo.Title = cfg.APITitle
    docs.SwaggerInfo.Version = build.Version
    docs.SwaggerInfo.Host = host
    docs.SwaggerInfo.BasePath = "/api/v1"
    docs.SwaggerInfo.Schemes = []string{"http", "https"}
    
    return fiberSwagger.WrapHandler
}

// main.go
app.Get("/docs/*", middleware.APIDoc(cfg))
```

---

### 1.3 Application Entry Point

**api/app/cmd/api/main.go:**
```go
package main

import (
    "context"
    "fmt"
    "os"
    "os/signal"
    "syscall"
    "time"

    "{project}/api/app/application"
    "{project}/api/app/config"
    "{project}/api/shared/common/jwt"
    "{project}/api/shared/common/logger"
    "{project}/api/shared/common/module"
    "{project}/api/shared/common/storage/sqldb"
    "{project}/api/shared/common/storage/sqldb/transactor"
)

func main() {
    cfg, err := config.Load()
    if err != nil {
        panic(err)
    }

    closeLog, err := logger.Init(cfg.AppName)
    if err != nil {
        panic(err)
    }
    defer closeLog()

    dbCtx, closeDB, err := sqldb.NewDBContext(cfg.DSN)
    if err != nil {
        panic(err)
    }
    defer func() {
        if err := closeDB(); err != nil {
            logger.Log().Error(fmt.Sprintf("error closing db: %v", err))
        }
    }()

    healthCheck := func(ctx context.Context) error {
        ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
        defer cancel()
        return dbCtx.DB().PingContext(ctx)
    }

    app := application.New(*cfg, healthCheck)

    trans, dbtxCtx := transactor.New(dbCtx.DB(),
        transactor.WithNestedTransactionStrategy(transactor.NestedTransactionsSavepoints))
    mCtx := module.NewModuleContext(trans, dbtxCtx)

    tokenSvc := jwt.NewTokenService(cfg.JWTAccessSecret, cfg.JWTRefreshSecret, cfg.AccessTokenTTL, cfg.RefreshTokenTTL)

    // Register modules here
    // app.RegisterModules(
    //     example.NewModule(mCtx, tokenSvc),
    // )

    app.Run()

    stop := make(chan os.Signal, 1)
    signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
    <-stop

    _ = app.Shutdown()
}
```

---

## 2. Module Development

### 2.1 Module Structure

```
api/modules/{module}/
├── module.go
├── go.mod
└── internal/
    ├── dto/dto.go
    ├── feature/
    │   ├── create/command.go
    │   ├── create/endpoint.go
    │   ├── list/query.go
    │   ├── list/endpoint.go
    │   ├── get/query.go
    │   ├── update/command.go
    │   └── delete/command.go
    └── repository/repository.go
```

### 2.2 Module Definition

**api/modules/{module}/module.go:**
```go
package {module}

import (
    "{project}/api/modules/{module}/internal/feature/create"
    "{project}/api/modules/{module}/internal/feature/list"
    "{project}/api/modules/{module}/internal/repository"
    "{project}/api/shared/common/eventbus"
    "{project}/api/shared/common/jwt"
    "{project}/api/shared/common/mediator"
    "{project}/api/shared/common/middleware"
    "{project}/api/shared/common/module"
    "github.com/gofiber/fiber/v3"
)

type Module struct {
    ctx      *module.ModuleContext
    repo     repository.Repository
    tokenSvc *jwt.TokenService
}

func NewModule(ctx *module.ModuleContext, tokenSvc *jwt.TokenService) *Module {
    repo := repository.NewRepository(ctx.DBCtx)
    return &Module{ctx: ctx, repo: repo, tokenSvc: tokenSvc}
}

func (m *Module) APIVersion() string { return "v1" }

func (m *Module) Init(eventBus eventbus.EventBus) error {
    mediator.Register[*list.Query, *list.Response](list.NewHandler(m.repo))
    mediator.Register[*create.Command, *create.Response](create.NewHandler(m.repo, m.ctx.Transactor, eventBus))
    return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
    group := r.Group("/{resources}", middleware.Auth(m.tokenSvc), middleware.TenantMiddleware())
    list.NewEndpoint(group)
    create.NewEndpoint(group)
}
```

### 2.3 Command Handler Pattern

**internal/feature/create/command.go:**
```go
package create

import (
    "context"
    "{project}/api/modules/{module}/internal/dto"
    "{project}/api/modules/{module}/internal/repository"
    "{project}/api/shared/common/contextx"
    "{project}/api/shared/common/errs"
    "{project}/api/shared/common/eventbus"
    "{project}/api/shared/common/mediator"
    "{project}/api/shared/common/storage/sqldb/transactor"
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
    
    if cmd.Payload.Name == "" {
        return nil, errs.BadRequest("name is required")
    }
    
    recPayload := cmd.Payload.ToRecord()
    
    var created *repository.Record
    err := h.tx.WithinTransaction(ctx, func(ctxWithTx context.Context, hook func(transactor.PostCommitHook)) error {
        var err error
        created, err = h.repo.Create(ctxWithTx, recPayload, tenant.CompanyID, tenant.BranchID, user.ID)
        if err != nil {
            return err
        }
        
        hook(func(ctx context.Context) error {
            h.eb.Publish(events.SomeEvent{
                EntityID:  created.ID,
                ActorID:   user.ID,
                Timestamp: created.CreatedAt,
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
```

### 2.4 Query Handler Pattern

**internal/feature/list/query.go:**
```go
package list

import (
    "context"
    "math"
    "{project}/api/modules/{module}/internal/dto"
    "{project}/api/modules/{module}/internal/repository"
    "{project}/api/shared/common/contextx"
    "{project}/api/shared/common/errs"
    "{project}/api/shared/common/logger"
    "{project}/api/shared/common/mediator"
    "go.uber.org/zap"
)

type Query struct {
    Page   int
    Limit  int
    Search string
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
    if q.Page < 1 { q.Page = 1 }
    if q.Limit <= 0 || q.Limit > 1000 { q.Limit = 1000 }
    
    tenant, ok := contextx.TenantFromContext(ctx)
    if !ok {
        return nil, errs.Unauthorized("missing tenant context")
    }
    
    res, err := h.repo.List(ctx, tenant, q.Page, q.Limit, q.Search)
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
    if totalPages == 0 { totalPages = 1 }
    
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

### 2.5 Repository Pattern

**internal/repository/repository.go:**
```go
package repository

import (
    "context"
    "database/sql"
    "fmt"
    "strings"
    "time"
    "github.com/google/uuid"
    "{project}/api/shared/common/contextx"
    "{project}/api/shared/common/storage/sqldb/transactor"
)

type Repository struct {
    dbCtx transactor.DBTXContext
}

func NewRepository(dbCtx transactor.DBTXContext) Repository {
    return Repository{dbCtx: dbCtx}
}

type ListRecord struct {
    ID        uuid.UUID `db:"id"`
    Name      string    `db:"name"`
    CreatedAt time.Time `db:"created_at"`
}

type Record struct {
    ID        uuid.UUID  `db:"id"`
    Name      string     `db:"name"`
    CompanyID uuid.UUID  `db:"company_id"`
    BranchID  uuid.UUID  `db:"branch_id"`
    CreatedAt time.Time  `db:"created_at"`
    UpdatedAt time.Time  `db:"updated_at"`
    CreatedBy uuid.UUID  `db:"created_by"`
    UpdatedBy uuid.UUID  `db:"updated_by"`
    DeletedAt *time.Time `db:"deleted_at"`
    DeletedBy *uuid.UUID `db:"deleted_by"`
}

type ListResult struct {
    Rows  []ListRecord
    Total int
}

func (r Repository) List(ctx context.Context, tenant contextx.TenantInfo, page, limit int, search string) (ListResult, error) {
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
        FROM {resources}
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
    countQuery := fmt.Sprintf("SELECT COUNT(1) FROM {resources} WHERE %s", whereClause)
    var total int
    if err := db.GetContext(ctx, &total, countQuery, countArgs...); err != nil {
        return ListResult{}, err
    }
    
    if list == nil {
        list = make([]ListRecord, 0)
    }
    
    return ListResult{Rows: list, Total: total}, nil
}

func (r Repository) Get(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID) (*Record, error) {
    db := r.dbCtx(ctx)
    q := `
        SELECT *
        FROM {resources}
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

func (r Repository) Create(ctx context.Context, payload Record, companyID, branchID, actor uuid.UUID) (*Record, error) {
    db := r.dbCtx(ctx)
    const q = `
        INSERT INTO {resources} (name, company_id, branch_id, created_by, updated_by)
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

func (r Repository) SoftDelete(ctx context.Context, tenant contextx.TenantInfo, id, actor uuid.UUID) error {
    db := r.dbCtx(ctx)
    q := `UPDATE {resources} SET deleted_at = now(), deleted_by = $1 WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL`
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
```

---

## 3. Cross-Module Communication (Sync)

### 3.1 Pattern Overview

Synchronous cross-module calls via mediator for immediate response:

```
Module A (Command Handler)
    ↓
Call via Mediator → OtherModuleQuery
    ↓
Module B (Query Handler)
    ↓
Return Result
```

### 3.2 Define Contract Interface

```go
// api/shared/contracts/inventory.go
package contracts

import (
    "context"
    "github.com/google/uuid"
)

type CheckStockRequest struct {
    ProductID uuid.UUID
    Quantity  int
}

type CheckStockResponse struct {
    Available bool
    InStock   int
}

type InventoryQuerier interface {
    CheckStock(ctx context.Context, req CheckStockRequest) (*CheckStockResponse, error)
}
```

### 3.3 Implement in Target Module

```go
// api/modules/inventory/internal/feature/checkstock/query.go
package checkstock

import (
    "context"
    "{project}/api/modules/inventory/internal/repository"
    "{project}/api/shared/common/contextx"
    "{project}/api/shared/common/errs"
    "{project}/api/shared/common/mediator"
    "{project}/api/shared/contracts"
    "github.com/google/uuid"
)

type Query struct {
    ProductID uuid.UUID
    Quantity  int
}

type Response struct {
    Available bool
    InStock   int
}

type Handler struct {
    repo repository.Repository
}

var _ mediator.RequestHandler[*Query, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository) *Handler {
    return &Handler{repo: repo}
}

func (h *Handler) Handle(ctx context.Context, q *Query) (*Response, error) {
    tenant, ok := contextx.TenantFromContext(ctx)
    if !ok {
        return nil, errs.Unauthorized("missing tenant context")
    }
    
    inStock, err := h.repo.GetStock(ctx, tenant, q.ProductID)
    if err != nil {
        return nil, err
    }
    
    return &Response{
        Available: inStock >= q.Quantity,
        InStock:   inStock,
    }, nil
}

// Adapter implements contracts.InventoryQuerier
type Adapter struct{}

func (a *Adapter) CheckStock(ctx context.Context, req contracts.CheckStockRequest) (*contracts.CheckStockResponse, error) {
    resp, err := mediator.Send[*Query, *Response](ctx, &Query{
        ProductID: req.ProductID,
        Quantity:  req.Quantity,
    })
    if err != nil {
        return nil, err
    }
    
    return &contracts.CheckStockResponse{
        Available: resp.Available,
        InStock:   resp.InStock,
    }, nil
}
```

### 3.4 Wire Dependencies

```go
// api/app/cmd/api/main.go
func main() {
    // ... setup
    
    invModule := inventoryModule.NewModule(mCtx, tokenSvc)
    
    // Inject into dependent module
    ordModule := orderModule.NewModule(mCtx, tokenSvc, invModule.InventoryQuerier())
    
    app.RegisterModules(
        invModule,
        ordModule,
    )
}
```

### 3.5 Use in Source Module

```go
// In order module command handler
type Handler struct {
    repo           repository.Repository
    tx             transactor.Transactor
    inventoryQuery contracts.InventoryQuerier
}

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
    // Validate stock before creating order
    for _, item := range cmd.Items {
        stockResp, err := h.inventoryQuery.CheckStock(ctx, contracts.CheckStockRequest{
            ProductID: item.ProductID,
            Quantity:  item.Quantity,
        })
        if err != nil {
            return nil, err
        }
        if !stockResp.Available {
            return nil, errs.BadRequest("insufficient stock")
        }
    }
    
    // Create order...
}
```

### 3.6 Asynchronous Communication (Event Bus)

For side effects and notifications that don't need immediate response.

#### Define Event

```go
// api/shared/events/order_events.go
package events

import (
    "time"
    "github.com/google/uuid"
)

type OrderCreatedEvent struct {
    OrderID   uuid.UUID
    UserID    uuid.UUID
    Total     float64
    Timestamp time.Time
}

func (e OrderCreatedEvent) EventName() string {
    return "order.created"
}
```

#### Publish Event

```go
// In command handler
err := h.tx.WithinTransaction(ctx, func(ctxWithTx context.Context, hook func(transactor.PostCommitHook)) error {
    order, err := h.repo.Create(ctxWithTx, record)
    if err != nil {
        return err
    }
    
    // Publish AFTER transaction commits
    hook(func(ctx context.Context) error {
        h.eb.Publish(events.OrderCreatedEvent{
            OrderID:   order.ID,
            Total:     order.Total,
            Timestamp: order.CreatedAt,
        })
        return nil
    })
    
    return nil
})
```

#### Subscribe to Event

```go
// In target module
func (m *Module) Init(eventBus eventbus.EventBus) error {
    eventBus.Subscribe("order.created", func(e eventbus.Event) {
        evt := e.(events.OrderCreatedEvent)
        // Process side effect (e.g., send email, update analytics)
        _ = evt
    })
    return nil
}
```

### 3.7 Sync vs Async Comparison

| Aspect | Sync (Mediator) | Async (Event Bus) |
|--------|----------------|-------------------|
| Response | Immediate | None (fire-and-forget) |
| Coupling | Tight | Loose |
| Transaction | Part of caller's tx | After commit |
| Failure | Immediate error | Retry/DLQ |
| Use case | Validation, required data | Side effects, notifications |

---

## 4. Database & Migrations

### 4.1 Migration Naming Convention

```
migrations/
├── 001_create_users_table.up.sql
├── 001_create_users_table.down.sql
├── 002_create_products_table.up.sql
└── 002_create_products_table.down.sql
```

### 4.2 Table Structure with RLS

```sql
-- migrations/001_create_products_table.up.sql

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    price DECIMAL(15, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    
    -- Multi-tenancy
    company_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    
    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    deleted_at TIMESTAMP,
    deleted_by UUID,
    
    UNIQUE(company_id, sku)
);

CREATE INDEX idx_products_company_id ON products(company_id);
CREATE INDEX idx_products_branch_id ON products(branch_id);
CREATE INDEX idx_products_deleted_at ON products(deleted_at) WHERE deleted_at IS NULL;

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY products_tenant_isolation ON products
    USING (
        company_id = current_setting('app.current_company_id')::UUID
        AND branch_id = ANY(string_to_array(current_setting('app.allowed_branches'), ',')::UUID[])
    );
```

---

## 5. Middleware & Auth

### 5.1 JWT Auth Middleware

```go
package middleware

import (
    "strings"
    "github.com/gofiber/fiber/v3"
    "{project}/api/shared/common/contextx"
    "{project}/api/shared/common/errs"
    "{project}/api/shared/common/jwt"
)

func Auth(tokenSvc *jwt.TokenService) fiber.Handler {
    return func(c fiber.Ctx) error {
        authHeader := c.Get("Authorization")
        if authHeader == "" {
            return errs.Unauthorized("missing authorization header")
        }
        
        parts := strings.SplitN(authHeader, " ", 2)
        if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
            return errs.Unauthorized("invalid authorization header format")
        }
        
        claims, err := tokenSvc.ValidateAccessToken(parts[1])
        if err != nil {
            return errs.Unauthorized("invalid token")
        }
        
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

### 5.2 Tenant Middleware

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
        companyIDStr := c.Get("X-Company-ID")
        branchIDStr := c.Get("X-Branch-ID")
        
        if companyIDStr == "" {
            return errs.BadRequest("missing X-Company-ID header")
        }
        
        companyID, err := uuid.Parse(companyIDStr)
        if err != nil {
            return errs.BadRequest("invalid X-Company-ID format")
        }
        
        tenant := contextx.TenantInfo{
            CompanyID: companyID,
        }
        
        if branchIDStr != "" {
            branchID, err := uuid.Parse(branchIDStr)
            if err != nil {
                return errs.BadRequest("invalid X-Branch-ID format")
            }
            tenant.BranchID = branchID
        }
        
        if user, ok := contextx.UserFromContext(c.Context()); ok {
            tenant.IsAdmin = user.Role == "admin" || user.Role == "superadmin"
        }
        
        c.SetUserContext(contextx.TenantToContext(c.Context(), tenant))
        return c.Next()
    }
}
```

---

## 6. Shared Libraries

### 6.1 Domain Errors

```go
package errs

import (
    "errors"
    "net/http"
)

type ErrorCode string

const (
    CodeBadRequest    ErrorCode = "bad_request"
    CodeUnauthorized  ErrorCode = "unauthorized"
    CodeForbidden     ErrorCode = "forbidden"
    CodeNotFound      ErrorCode = "not_found"
    CodeConflict      ErrorCode = "conflict"
    CodeInternal      ErrorCode = "internal_error"
)

type AppError struct {
    Code    ErrorCode
    Message string
    Detail  interface{}
}

func (e *AppError) Error() string { return e.Message }

func (e *AppError) Status() int {
    switch e.Code {
    case CodeBadRequest: return http.StatusBadRequest
    case CodeUnauthorized: return http.StatusUnauthorized
    case CodeForbidden: return http.StatusForbidden
    case CodeNotFound: return http.StatusNotFound
    case CodeConflict: return http.StatusConflict
    default: return http.StatusInternalServerError
    }
}

func BadRequest(msg string, detail ...interface{}) *AppError {
    return &AppError{Code: CodeBadRequest, Message: msg, Detail: pickDetail(detail)}
}

func Unauthorized(msg string) *AppError {
    return &AppError{Code: CodeUnauthorized, Message: msg}
}

func Forbidden(msg string) *AppError {
    return &AppError{Code: CodeForbidden, Message: msg}
}

func NotFound(msg string) *AppError {
    return &AppError{Code: CodeNotFound, Message: msg}
}

func Internal(msg string, detail ...interface{}) *AppError {
    return &AppError{Code: CodeInternal, Message: msg, Detail: pickDetail(detail)}
}
```

### 6.2 Mediator Pattern

```go
package mediator

import (
    "context"
    "errors"
    "fmt"
    "reflect"
)

type NoResponse struct{}

type RequestHandler[TRequest any, TResponse any] interface {
    Handle(ctx context.Context, request TRequest) (TResponse, error)
}

var handlers = map[reflect.Type]func(ctx context.Context, req interface{}) (interface{}, error){}

func Register[TRequest any, TResponse any](handler RequestHandler[TRequest, TResponse]) {
    var req TRequest
    reqType := reflect.TypeOf(req)
    handlers[reqType] = func(ctx context.Context, request interface{}) (interface{}, error) {
        typedReq, ok := request.(TRequest)
        if !ok {
            return nil, errors.New("invalid request type")
        }
        return handler.Handle(ctx, typedReq)
    }
}

func Send[TRequest any, TResponse any](ctx context.Context, req TRequest) (TResponse, error) {
    reqType := reflect.TypeOf(req)
    handler, ok := handlers[reqType]
    if !ok {
        var empty TResponse
        return empty, fmt.Errorf("no handler for request %T", req)
    }
    result, err := handler(ctx, req)
    if err != nil {
        var empty TResponse
        return empty, err
    }
    typedRes, ok := result.(TResponse)
    if !ok {
        var empty TResponse
        return empty, errors.New("invalid response type")
    }
    return typedRes, nil
}
```

### 6.3 Context Extensions

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

func TenantToContext(ctx context.Context, tenant TenantInfo) context.Context {
    return context.WithValue(ctx, tenantKey{}, tenant)
}

func TenantFromContext(ctx context.Context) (TenantInfo, bool) {
    if ctx == nil {
        return TenantInfo{}, false
    }
    if v, ok := ctx.Value(tenantKey{}).(TenantInfo); ok {
        return v, true
    }
    return TenantInfo{}, false
}

func (t TenantInfo) HasBranchID() bool {
    return t.BranchID != uuid.Nil
}

// UserInfo holds user context
type UserInfo struct {
    ID   uuid.UUID
    Role string
}

type userKey struct{}

func UserToContext(ctx context.Context, user UserInfo) context.Context {
    return context.WithValue(ctx, userKey{}, user)
}

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

### 6.4 Optional UUID Type

For optional foreign key fields that can receive empty strings from JSON:

```go
package types

import (
    "encoding/json"
    "strings"
    "github.com/google/uuid"
)

// OptionalUUID allows binding empty strings to nil while still accepting valid UUIDs.
type OptionalUUID struct {
    value *uuid.UUID
}

func (o *OptionalUUID) UnmarshalJSON(data []byte) error {
    if string(data) == "null" {
        o.value = nil
        return nil
    }

    var raw string
    if err := json.Unmarshal(data, &raw); err != nil {
        return err
    }

    raw = strings.TrimSpace(raw)
    if raw == "" {
        o.value = nil
        return nil
    }

    id, err := uuid.Parse(raw)
    if err != nil {
        return err
    }
    o.value = &id
    return nil
}

func (o OptionalUUID) MarshalJSON() ([]byte, error) {
    if o.value == nil {
        return []byte("null"), nil
    }
    return json.Marshal(o.value.String())
}

func (o OptionalUUID) Ptr() *uuid.UUID {
    return o.value
}
```

**Usage:**
```go
type RequestBody struct {
    Name         string       `json:"name" validate:"required"`
    DepartmentID OptionalUUID `json:"departmentId"`
    PositionID   OptionalUUID `json:"positionId"`
}

// JSON: {"name": "John", "departmentId": ""} → DepartmentID.Ptr() == nil
// JSON: {"name": "John", "departmentId": null} → DepartmentID.Ptr() == nil
// JSON: {"name": "John", "departmentId": "550e8400-..."} → DepartmentID.Ptr() != nil
```

### 6.5 Password Hashing (Argon2id)

```go
package password

import (
    "crypto/rand"
    "crypto/subtle"
    "encoding/base64"
    "errors"
    "fmt"
    "strings"

    "golang.org/x/crypto/argon2"
)

var (
    defaultMemory      uint32 = 64 * 1024
    defaultIterations  uint32 = 3
    defaultParallelism uint8  = 4
    defaultSaltLength  uint32 = 16
    defaultKeyLength   uint32 = 32
)

// Hash hashes plaintext password using Argon2id.
func Hash(password string) (string, error) {
    salt := make([]byte, defaultSaltLength)
    if _, err := rand.Read(salt); err != nil {
        return "", err
    }

    hash := argon2.IDKey(
        []byte(password),
        salt,
        defaultIterations,
        defaultMemory,
        defaultParallelism,
        defaultKeyLength,
    )

    encodedSalt := base64.RawStdEncoding.EncodeToString(salt)
    encodedHash := base64.RawStdEncoding.EncodeToString(hash)
    
    return fmt.Sprintf(
        "$argon2id$v=19$m=%d,t=%d,p=%d$%s$%s",
        defaultMemory, defaultIterations, defaultParallelism,
        encodedSalt, encodedHash,
    ), nil
}

// Verify compares password against encoded hash.
func Verify(password, encoded string) (bool, error) {
    parts := strings.Split(encoded, "$")
    if len(parts) != 6 {
        return false, errors.New("invalid hash format")
    }

    var memory uint32
    var iterations uint32
    var parallelism uint8
    _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &iterations, &parallelism)
    if err != nil {
        return false, err
    }

    salt, _ := base64.RawStdEncoding.DecodeString(parts[4])
    hash, _ := base64.RawStdEncoding.DecodeString(parts[5])

    computed := argon2.IDKey(
        []byte(password),
        salt,
        iterations,
        memory,
        parallelism,
        uint32(len(hash)),
    )

    return subtle.ConstantTimeCompare(hash, computed) == 1, nil
}
```

**Usage:**
```go
// Registration
hashedPassword, err := password.Hash(cmd.Password)
// Store hashedPassword in DB

// Login
valid, err := password.Verify(inputPassword, storedHash)
```

### 6.6 Cross-Module Contracts

Contracts for inter-module communication via Mediator pattern:

```go
// api/shared/contracts/company/command_create.go
package company

import (
    "time"
    "github.com/google/uuid"
)

// CreateCompanyDirectCommand is called by superadmin module.
type CreateCompanyDirectCommand struct {
    Code    string
    Name    string
    TaxID   string
    ActorID uuid.UUID
}

type CreateCompanyDirectResponse struct {
    ID        uuid.UUID
    Code      string
    Name      string
    CreatedAt time.Time
}
```

**Cross-Module Transaction:**
```go
func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
    err := h.tx.WithinTransaction(ctx, func(ctxTx context.Context, hook func()) error {
        // 1. Create company
        company, err := h.repo.Create(ctxTx, cmd.Code, cmd.Name)
        if err != nil {
            return err
        }
        
        // 2. Call OrgProfile module
        orgCmd := &orgprofile.CreateOrgProfileDirectCommand{
            CompanyID: company.ID,
            Address:   cmd.Address,
        }
        _, err = mediator.Send[*orgprofile.CreateOrgProfileDirectCommand, 
            *orgprofile.CreateOrgProfileDirectResponse](ctxTx, orgCmd)
        if err != nil {
            return err
        }
        
        // 3. Call Payroll module
        payrollCmd := &payroll.CreatePayrollConfigDirectCommand{
            CompanyID: company.ID,
            Currency:  "THB",
        }
        _, err = mediator.Send[*payroll.CreatePayrollConfigDirectCommand,
            *payroll.CreatePayrollConfigDirectResponse](ctxTx, payrollCmd)
        if err != nil {
            return err
        }
        
        return nil
    })
    // ...
}
```

---

## 7. DevOps & Deployment

### 7.1 Dockerfile

```dockerfile
FROM golang:1.25-alpine AS builder

WORKDIR /app
RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main ./app/cmd/api/main.go

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/main .
EXPOSE 8080
CMD ["./main"]
```

### 7.2 Docker Compose

```yaml
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${DB_USER:-user}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-password}
      POSTGRES_DB: ${DB_NAME:-appdb}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  migrate:
    image: migrate/migrate:v4.17.0
    volumes:
      - ./migrations:/migrations
    environment:
      DB_DSN: postgres://${DB_USER:-user}:${DB_PASSWORD:-password}@db:5432/${DB_NAME:-appdb}?sslmode=disable
    command: ["-path", "/migrations", "-database", "$${DB_DSN}", "up"]
    depends_on:
      - db

  api:
    build: ./api
    ports:
      - "8080:8080"
    environment:
      DB_DSN: postgres://${DB_USER:-user}:${DB_PASSWORD:-password}@db:5432/${DB_NAME:-appdb}?sslmode=disable
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
    depends_on:
      - migrate

volumes:
  pgdata:
```

### 7.3 Makefile

```makefile
DB_DSN ?= postgres://user:password@localhost:5432/appdb?sslmode=disable
MIGRATE := migrate -path migrations -database "$(DB_DSN)"

.PHONY: dev build test mgu mgc docker-up

dev:
	docker-compose up -d db
	go run ./api/app/cmd/api/main.go

build:
	cd api && go build -o ../bin/api ./app/cmd/api/main.go

test:
	go test -v ./...

mgu:
	$(MIGRATE) up

mgc:
	migrate create -ext sql -dir migrations -seq $(name)

docker-up:
	docker-compose up --build
```

---

## Summary

This guide covers the essential patterns for building Go modular monolith APIs:

1. **Project Structure** - Clear separation of app, modules, and shared libraries
2. **CQRS Pattern** - Separate commands (write) and queries (read)
3. **Cross-Module Communication** - Sync via mediator, async via event bus
4. **Multi-Tenancy** - RLS policies for data isolation
5. **Middleware** - Auth, tenant context, error handling
6. **Database** - Migrations, soft delete, audit columns
7. **DevOps** - Docker, Compose, Makefile for common tasks

For detailed explanations of individual patterns, see the rule files in `rules/`.
