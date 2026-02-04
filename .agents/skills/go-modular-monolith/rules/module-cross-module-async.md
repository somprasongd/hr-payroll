# module-cross-module-async

Asynchronous cross-module communication via event bus.

## Why Async Communication

- Loose coupling between modules
- No blocking on non-critical operations
- Better fault tolerance (retry capability)
- Side effects and notifications

## Pattern: Event Bus

```
Module A (Command Handler)
    ↓
Publish Event → Event Bus
    ↓
Module B (Subscriber) receives event
    ↓
Process asynchronously
```

## Step 1: Define Event

**File: `api/shared/events/order_events.go`**

```go
package events

import (
    "time"
    "github.com/google/uuid"
)

// OrderCreatedEvent published when order is created
type OrderCreatedEvent struct {
    OrderID   uuid.UUID
    UserID    uuid.UUID
    CompanyID uuid.UUID
    Total     float64
    Items     []OrderItem
    Timestamp time.Time
}

func (e OrderCreatedEvent) EventName() string {
    return "order.created"
}

type OrderItem struct {
    ProductID uuid.UUID
    Quantity  int
    Price     float64
}
```

## Step 2: Publish Event

**File: `api/modules/order/internal/feature/create/command.go`**

```go
package create

import (
    "context"
    "{project}/api/modules/order/internal/repository"
    "{project}/api/shared/common/contextx"
    "{project}/api/shared/common/eventbus"
    "{project}/api/shared/common/storage/sqldb/transactor"
    "{project}/api/shared/events"
)

type Command struct {
    Items []OrderItem
}

type Handler struct {
    repo repository.Repository
    tx   transactor.Transactor
    eb   eventbus.EventBus
}

func NewHandler(repo repository.Repository, tx transactor.Transactor, eb eventbus.EventBus) *Handler {
    return &Handler{repo: repo, tx: tx, eb: eb}
}

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
    tenant, _ := contextx.TenantFromContext(ctx)
    user, _ := contextx.UserFromContext(ctx)
    
    var order *repository.Order
    err := h.tx.WithinTransaction(ctx, func(ctxWithTx context.Context, hook func(transactor.PostCommitHook)) error {
        var err error
        order, err = h.repo.Create(ctxWithTx, cmd.ToRecord())
        if err != nil {
            return err
        }
        
        // Publish event AFTER transaction commits
        hook(func(ctx context.Context) error {
            h.eb.Publish(events.OrderCreatedEvent{
                OrderID:   order.ID,
                UserID:    user.ID,
                CompanyID: tenant.CompanyID,
                Total:     order.Total,
                Items:     cmd.toEventItems(),
                Timestamp: order.CreatedAt,
            })
            return nil
        })
        
        return nil
    })
    
    if err != nil {
        return nil, err
    }
    
    return &Response{Order: order}, nil
}
```

## Step 3: Subscribe to Event

**File: `api/modules/inventory/module.go`**

```go
package inventory

import (
    "{project}/api/modules/inventory/internal/repository"
    "{project}/api/shared/common/eventbus"
    "{project}/api/shared/events"
)

func (m *Module) Init(eventBus eventbus.EventBus) error {
    // Register other handlers...
    
    // Subscribe to order events
    eventBus.Subscribe("order.created", func(e eventbus.Event) {
        evt := e.(events.OrderCreatedEvent)
        
        // Deduct stock for each item
        for _, item := range evt.Items {
            err := m.repo.DeductStock(context.Background(), evt.CompanyID, item.ProductID, item.Quantity)
            if err != nil {
                // Log error, potentially retry or alert
                logger.Log().Error("failed to deduct stock", zap.Error(err))
            }
        }
    })
    
    return nil
}
```

## Alternative: Structured Subscriber

**File: `api/modules/inventory/internal/subscriber/order_subscriber.go`**

```go
package subscriber

import (
    "context"
    "{project}/api/modules/inventory/internal/repository"
    "{project}/api/shared/common/logger"
    "{project}/api/shared/events"
    "go.uber.org/zap"
)

type OrderSubscriber struct {
    repo repository.Repository
}

func NewOrderSubscriber(repo repository.Repository) *OrderSubscriber {
    return &OrderSubscriber{repo: repo}
}

func (s *OrderSubscriber) OnOrderCreated(ctx context.Context, evt events.OrderCreatedEvent) error {
    for _, item := range evt.Items {
        if err := s.repo.DeductStock(ctx, evt.CompanyID, item.ProductID, item.Quantity); err != nil {
            logger.FromContext(ctx).Error("failed to deduct stock",
                zap.String("order_id", evt.OrderID.String()),
                zap.String("product_id", item.ProductID.String()),
                zap.Error(err),
            )
            return err
        }
    }
    return nil
}
```

**Wire in module:**

```go
func (m *Module) Init(eventBus eventbus.EventBus) error {
    sub := subscriber.NewOrderSubscriber(m.repo)
    
    eventBus.Subscribe("order.created", func(e eventbus.Event) {
        sub.OnOrderCreated(context.Background(), e.(events.OrderCreatedEvent))
    })
    
    return nil
}
```

## Step 4: Complete Subscriber Pattern

### File Structure

```
api/modules/inventory/
├── module.go
├── internal/
│   ├── subscriber/
│   │   └── order_subscriber.go  # Event handlers
│   └── repository/
│       └── repository.go
```

### Checklist: Create Event Subscriber

- [ ] Create `internal/subscriber/` directory
- [ ] Create subscriber struct with dependencies
- [ ] Implement handler methods for each event
- [ ] Subscribe in `module.Init()`
- [ ] Handle errors appropriately (log, retry, alert)

### Example: Inventory Stock Deduction

**Scenario:** When order created, deduct stock from inventory

```go
// internal/subscriber/order_subscriber.go
package subscriber

type OrderSubscriber struct {
    repo repository.Repository
}

func NewOrderSubscriber(repo repository.Repository) *OrderSubscriber {
    return &OrderSubscriber{repo: repo}
}

// OnOrderCreated handles order.created event
func (s *OrderSubscriber) OnOrderCreated(ctx context.Context, evt events.OrderCreatedEvent) {
    for _, item := range evt.Items {
        if err := s.repo.DeductStock(ctx, evt.CompanyID, item.ProductID, item.Quantity); err != nil {
            logger.Error("failed to deduct stock", 
                zap.Error(err),
                zap.String("order_id", evt.OrderID.String()),
            )
            // Consider: retry queue, alert, dead letter
        }
    }
}
```

**Subscribe in module:**

```go
func (m *Module) Init(eventBus eventbus.EventBus) error {
    // Create subscriber
    orderSub := subscriber.NewOrderSubscriber(m.repo)
    
    // Subscribe to events
    eventBus.Subscribe("order.created", func(e eventbus.Event) {
        evt := e.(events.OrderCreatedEvent)
        orderSub.OnOrderCreated(context.Background(), evt)
    })
    
    return nil
}
```

## Event Bus Implementation

**File: `api/shared/common/eventbus/eventbus.go`**

```go
package eventbus

import (
    "sync"
)

// Event interface for typed events
type Event interface {
    EventName() string
}

// EventHandler function type
type EventHandler func(event Event)

// EventBus interface
type EventBus interface {
    Publish(event Event)
    Subscribe(eventName string, handler EventHandler)
}

// InMemory implementation
type InMemoryEventBus struct {
    mu       sync.RWMutex
    handlers map[string][]EventHandler
}

func NewInMemory() EventBus {
    return &InMemoryEventBus{
        handlers: make(map[string][]EventHandler),
    }
}

func (b *InMemoryEventBus) Publish(event Event) {
    b.mu.RLock()
    handlers := b.handlers[event.EventName()]
    b.mu.RUnlock()
    
    for _, handler := range handlers {
        go handler(event) // Async execution
    }
}

func (b *InMemoryEventBus) Subscribe(eventName string, handler EventHandler) {
    b.mu.Lock()
    defer b.mu.Unlock()
    b.handlers[eventName] = append(b.handlers[eventName], handler)
}
```

## Use Cases

### Good for Async:
- Sending emails/notifications
- Updating search indexes
- Generating reports
- Logging/audit trails
- Cache invalidation
- External API calls

### Bad for Async:
- Validation requiring immediate response
- Transaction rollback needs
- User waiting for result

## Comparison: Sync vs Async

| Aspect | Sync (Mediator) | Async (Event Bus) |
|--------|----------------|-------------------|
| Response | Immediate | None (fire-and-forget) |
| Coupling | Tight (direct call) | Loose (pub/sub) |
| Transaction | Part of caller's tx | Separate, after commit |
| Failure | Immediate error | Retry/DLQ needed |
| Ordering | Guaranteed | May be out of order |
| Use case | Validation, required data | Side effects, notifications |

## Common Pitfalls

**Incorrect: Publishing before commit**
```go
// ❌ Event published even if transaction rolls back
h.eb.Publish(events.OrderCreatedEvent{...})  // Inside transaction
order, err := h.repo.Create(ctx, record)     // May fail after publish
```

**Correct: Use post-commit hook**
```go
// ✅ Event only after successful commit
hook(func(ctx context.Context) error {
    h.eb.Publish(events.OrderCreatedEvent{...})
    return nil
})
```

**Incorrect: Blocking in event handler**
```go
// ❌ Blocks event bus
eventBus.Subscribe("order.created", func(e eventbus.Event) {
    http.Post("slow-api.com", ...) // Synchronous, blocks
})
```

**Correct: Async handling or goroutine**
```go
// ✅ Non-blocking
eventBus.Subscribe("order.created", func(e eventbus.Event) {
    go func() { // Launch goroutine
        http.Post("slow-api.com", ...)
    }()
})
```

**Incorrect: No error handling**
```go
// ❌ Silent failures
eventBus.Subscribe("order.created", func(e eventbus.Event) {
    repo.Update(...) // Error ignored!
})
```

**Correct: Log and potentially retry**
```go
// ✅ Handle errors appropriately
eventBus.Subscribe("order.created", func(e eventbus.Event) {
    if err := repo.Update(...); err != nil {
        logger.Error("failed to update", zap.Error(err))
        // Potentially: retry queue, dead letter, alert
    }
})
```
