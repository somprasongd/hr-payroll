# module-registration

Wire module in main.go.

## Why Explicit Registration

- Clear dependency graph
- Control initialization order
- Easy to add/remove modules
- Explicit dependency injection

## Step 1: Import Module

**File: api/app/cmd/api/main.go**

```go
import (
    // ... other imports
    "{project}/api/modules/users"
    "{project}/api/modules/products"
    "{project}/api/modules/orders"
)
```

## Step 2: Initialize and Register

```go
func main() {
    // ... setup code
    
    // Create module instances
    userModule := users.NewModule(mCtx, tokenSvc)
    productModule := products.NewModule(mCtx, tokenSvc)
    
    // Modules with dependencies on other modules
    orderModule := orders.NewModule(mCtx, tokenSvc, productModule.ProductQuerier())
    
    // Register all modules
    app.RegisterModules(
        userModule,
        productModule,
        orderModule,
    )
    
    // ... run
}
```

## Step 3: Module Constructor

**File: api/modules/{module}/module.go**

```go
func NewModule(ctx *module.ModuleContext, tokenSvc *jwt.TokenService) *Module {
    repo := repository.NewRepository(ctx.DBCtx)
    return &Module{
        ctx:      ctx,
        repo:     repo,
        tokenSvc: tokenSvc,
    }
}
```

## Step 4: Export Query Interface (Optional)

For cross-module sync calls:

```go
// In products module
func (m *Module) ProductQuerier() contracts.ProductQuerier {
    return &get.Adapter{repo: m.repo}
}
```

## Registration Order

```go
// ✅ Tenant module first (registers context middleware)
app.RegisterModules(
    tenant.NewModule(mCtx),
    auth.NewModule(mCtx, tokenSvc),
    users.NewModule(mCtx, tokenSvc),
    products.NewModule(mCtx, tokenSvc),
)
```

## Common Pitfalls

**Incorrect: Circular dependency**
```go
// ❌ Order depends on Product, Product depends on Order
orderModule := orders.NewModule(mCtx, productModule)
productModule := products.NewModule(mCtx, orderModule)  // Error!
```

**Correct: One-way dependency**
```go
// ✅ Only Order depends on Product
productModule := products.NewModule(mCtx, tokenSvc)
orderModule := orders.NewModule(mCtx, tokenSvc, productModule)
```

**Incorrect: Missing dependency injection**
```go
// ❌ Global variables
var db *sqlx.DB

func main() {
    db = connectDB()  // Global!
}
```

**Correct: Explicit injection**
```go
// ✅ Passed through constructor
dbCtx, _, _ := sqldb.NewDBContext(cfg.DSN)
mCtx := module.NewModuleContext(trans, dbCtx)
```

## Super Admin Routes (Optional)

สำหรับ routes ที่ไม่ผ่าน tenant middleware (เช่น system banks, global settings):

### Step 1: Implement Interface

**File: api/modules/{module}/module.go**

```go
// Module implements module.Module and module.SuperAdminRouteRegistrar
type Module struct {
    ctx  *module.ModuleContext
    repo repository.Repository
}

// RegisterRoutes registers normal tenant-scoped routes
func (m *Module) RegisterRoutes(r fiber.Router) {
    g := r.Group("/employees")
    g.Get("/", m.getHandler.GetAll)
    g.Post("/", m.createHandler.Create)
}

// RegisterSuperAdminRoutes registers system-level routes (no tenant middleware)
func (m *Module) RegisterSuperAdminRoutes(r fiber.Router) {
    g := r.Group("/banks")  // /super-admin/banks
    g.Get("/", m.bankHandler.GetAll)
    g.Post("/", m.bankHandler.Create)
}
```

### Step 2: Check Interface in Main

**File: api/app/cmd/api/main.go**

```go
func registerSuperAdminRoutes(app *fiber.App, modules []module.Module) {
    // Group under /super-admin prefix (bypasses tenant middleware)
    superAdmin := app.Group("/super-admin")
    
    for _, m := range modules {
        // Check if module has super admin routes
        if registrar, ok := m.(module.SuperAdminRouteRegistrar); ok {
            registrar.RegisterSuperAdminRoutes(superAdmin)
        }
    }
}
```

### Module Interface Definition

**File: api/shared/common/module/module.go**

```go
// Module is the base interface for all modules.
type Module interface {
    APIVersion() string
    Init(eventBus eventbus.EventBus) error
    RegisterRoutes(r fiber.Router)
}

// SuperAdminRouteRegistrar for system-level routes without tenant context.
type SuperAdminRouteRegistrar interface {
    RegisterSuperAdminRoutes(r fiber.Router)
}

// ModuleContext provides shared resources to modules.
type ModuleContext struct {
    Transactor transactor.Transactor
    DBCtx      transactor.DBTXContext
}
```

### Use Cases

- **Master data management** - System banks, provinces, districts
- **Global settings** - System configuration
- **Super admin tools** - Tenant management, user impersonation

### Common Pitfalls

**Incorrect: Mixing routes in same handler**
```go
// ❌ Same handler for tenant and super-admin routes
func (h *Handler) GetBanks(c fiber.Ctx) error {
    // Tries to get tenant, but super-admin route has none!
    tenant := c.Locals("tenant").(Tenant)
    // ...
}
```

**Correct: Separate handlers**
```go
// ✅ Dedicated super-admin handler
func (h *SuperAdminBankHandler) GetAll(c fiber.Ctx) error {
    // No tenant context - lists all system banks
    banks, err := h.repo.GetAllSystemBanks(ctx)
    // ...
}

// ✅ Tenant-scoped handler
func (h *BankHandler) GetAll(c fiber.Ctx) error {
    tenant := c.Locals("tenant").(Tenant)
    banks, err := h.repo.GetByCompany(ctx, tenant.CompanyID)
    // ...
}
```
