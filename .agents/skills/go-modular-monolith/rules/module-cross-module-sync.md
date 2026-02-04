# module-cross-module-sync

Synchronous cross-module communication via mediator and contracts.

## Why Sync Communication

- Immediate response needed
- Validation requires data from another module
- Transaction must span multiple modules
- No eventual consistency acceptable

## Pattern: Mediator + Contracts

```
Module A (Command Handler)
    ↓
Call via Mediator → OtherModuleQuery
    ↓
Module B (Query Handler)
    ↓
Return Result
```

## Step 1: Define Contract

**File: `api/shared/contracts/inventory.go`**

```go
package contracts

import (
    "context"
    "github.com/google/uuid"
)

// CheckStockRequest query for stock checking
type CheckStockRequest struct {
    ProductID uuid.UUID
    Quantity  int
}

// CheckStockResponse result of stock check
type CheckStockResponse struct {
    Available bool
    InStock   int
}

// InventoryQuerier interface for synchronous calls
type InventoryQuerier interface {
    CheckStock(ctx context.Context, req CheckStockRequest) (*CheckStockResponse, error)
}
```

## Step 2: Implement in Target Module

**File: `api/modules/inventory/internal/feature/checkstock/query.go`**

```go
package checkstock

import (
    "context"
    "{project}/api/modules/inventory/internal/repository"
    "{project}/api/shared/common/contextx"
    "{project}/api/shared/common/errs"
    "{project}/api/shared/common/mediator"
    "{project}/api/shared/contracts"
)

// Query checks stock availability
type Query struct {
    ProductID uuid.UUID
    Quantity  int
}

// Response stock check result
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

**Register adapter in module:**

```go
// api/modules/inventory/module.go
func (m *Module) InventoryQuerier() contracts.InventoryQuerier {
    return &checkstock.Adapter{}
}
```

## Step 3: Use in Source Module

**File: `api/modules/order/internal/feature/create/command.go`**

```go
package create

import (
    "context"
    "{project}/api/modules/order/internal/repository"
    "{project}/api/shared/common/contextx"
    "{project}/api/shared/common/errs"
    "{project}/api/shared/common/mediator"
    "{project}/api/shared/common/storage/sqldb/transactor"
    "{project}/api/shared/contracts"
)

type Command struct {
    Items []OrderItem
}

type Handler struct {
    repo           repository.Repository
    tx             transactor.Transactor
    inventoryQuery contracts.InventoryQuerier  // Injected dependency
}

func NewHandler(
    repo repository.Repository, 
    tx transactor.Transactor,
    inventoryQuery contracts.InventoryQuerier,  // Injected
) *Handler {
    return &Handler{
        repo:           repo,
        tx:             tx,
        inventoryQuery: inventoryQuery,
    }
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
            return nil, errs.BadRequest("insufficient stock for product: " + item.ProductID.String())
        }
    }
    
    // Create order within transaction
    var order *repository.Order
    err := h.tx.WithinTransaction(ctx, func(ctxWithTx context.Context, hook func(transactor.PostCommitHook)) error {
        var err error
        order, err = h.repo.Create(ctxWithTx, cmd.ToRecord())
        if err != nil {
            return err
        }
        
        // Deduct stock via another cross-module call
        // ...
        
        return nil
    })
    
    if err != nil {
        return nil, err
    }
    
    return &Response{Order: order}, nil
}
```

## Step 4: Wire Dependencies

**File: `api/app/cmd/api/main.go`**

```go
import (
    inventoryModule "{project}/api/modules/inventory"
    orderModule "{project}/api/modules/order"
)

func main() {
    // ... setup
    
    invModule := inventoryModule.NewModule(mCtx, tokenSvc)
    
    // Inject inventory querier into order module
    ordModule := orderModule.NewModule(mCtx, tokenSvc, invModule.InventoryQuerier())
    
    app.RegisterModules(
        invModule,
        ordModule,
    )
    
    // ...
}
```

## Alternative: Direct Mediator Call

Without interface abstraction:

```go
// In order module command handler
resp, err := mediator.Send[*checkstock.Query, *checkstock.Response](
    ctx,
    &checkstock.Query{
        ProductID: item.ProductID,
        Quantity:  item.Quantity,
    },
)
```

**Pros:** No interface needed, direct
**Cons:** Tight coupling, harder to test, imports from other module

## Comparison: Sync vs Async

| Aspect | Sync (Mediator) | Async (Event Bus) |
|--------|----------------|-------------------|
| Response | Immediate | Eventually |
| Coupling | Tight | Loose |
| Transaction | Can span modules | Per module only |
| Failure handling | Immediate error | Retry/DLQ |
| Use case | Validation, required data | Side effects, notifications |

## Common Pitfalls

**Incorrect: Circular dependency**
```go
// ❌ Module A calls Module B, Module B calls Module A
```

**Correct: One-way dependency**
```go
// ✅ Order depends on Inventory, not vice versa
```

**Incorrect: Calling handler directly**
```go
// ❌ Skip mediator, call handler directly
handler := checkstock.NewHandler(repo)
resp, _ := handler.Handle(ctx, query)
```

**Correct: Always use mediator**
```go
// ✅ Route through mediator
resp, err := mediator.Send[*Query, *Response](ctx, query)
```

**Incorrect: Async in transaction**
```go
// ❌ Event published even if transaction rolls back
hook(func(ctx context.Context) error {
    eventBus.Publish(event)  // Wrong for sync needs
})
```

**Correct: Sync call within transaction**
```go
// ✅ Get immediate result before commit
result, err := inventoryQuery.CheckStock(ctx, req)
```
