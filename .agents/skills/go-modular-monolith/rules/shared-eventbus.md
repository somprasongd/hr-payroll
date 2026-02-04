# shared-eventbus

In-memory event bus for cross-module communication.

## Purpose

- Loose coupling between modules
- Async event publishing
- Fire-and-forget notifications

## File: api/shared/common/eventbus/eventbus.go

```go
package eventbus

import "sync"

// Event interface
type Event interface {
    EventName() string
}

// EventHandler function
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
    
    // Execute handlers concurrently
    for _, handler := range handlers {
        go handler(event)
    }
}

func (b *InMemoryEventBus) Subscribe(eventName string, handler EventHandler) {
    b.mu.Lock()
    defer b.mu.Unlock()
    b.handlers[eventName] = append(b.handlers[eventName], handler)
}
```

## Define Event

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

## Publish Event

```go
// In command handler
hook(func(ctx context.Context) error {
    eb.Publish(events.OrderCreatedEvent{
        OrderID:   order.ID,
        UserID:    user.ID,
        Total:     order.Total,
        Timestamp: order.CreatedAt,
    })
    return nil
})
```

## Subscribe to Event

```go
// In module Init
func (m *Module) Init(eventBus eventbus.EventBus) error {
    eventBus.Subscribe("order.created", func(e eventbus.Event) {
        evt := e.(events.OrderCreatedEvent)
        
        // Process event
        logger.Log().Info("order created",
            zap.String("order_id", evt.OrderID.String()),
        )
    })
    
    return nil
}
```

## Common Pitfalls

**Incorrect: Synchronous event handling**
```go
// ❌ Blocks publisher
for _, handler := range handlers {
    handler(event)  // Synchronous
}
```

**Correct: Async handling**
```go
// ✅ Non-blocking
for _, handler := range handlers {
    go handler(event)  // Concurrent
}
```

**Incorrect: Publishing before commit**
```go
// ❌ Event sent even if transaction fails
eb.Publish(event)
return repo.Create(ctx, record)
```

**Correct: Use post-commit hook**
```go
// ✅ Only after successful commit
hook(func(ctx context.Context) error {
    eb.Publish(event)
    return nil
})
```
