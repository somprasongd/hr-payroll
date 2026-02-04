# db-transactor

Transaction management with post-commit hooks.

## Why Transactor Pattern

- Explicit transaction boundaries
- Post-commit event publishing
- Automatic rollback on error
- RLS session variable injection

## Usage in Command Handler

```go
func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
    var result *repository.Record
    
    err := h.tx.WithinTransaction(ctx, func(
        ctxWithTx context.Context,
        hook func(transactor.PostCommitHook),
    ) error {
        // Database operations use ctxWithTx
        result, err = h.repo.Create(ctxWithTx, payload)
        if err != nil {
            return err  // Auto-rollback
        }
        
        // Register post-commit hook
        hook(func(ctx context.Context) error {
            h.eb.Publish(events.CreatedEvent{...})
            return nil
        })
        
        return nil  // Auto-commit
    })
    
    if err != nil {
        return nil, err
    }
    
    return &Response{...}, nil
}
```

## Key Points

1. **ctxWithTx** - Use this for all DB operations inside transaction
2. **hook()** - Events fire only after successful commit
3. **Return error** - Causes rollback
4. **Return nil** - Causes commit

## Without Events

```go
err := h.tx.WithinTransaction(ctx, func(
    ctxWithTx context.Context,
    hook func(transactor.PostCommitHook),
) error {
    // No hooks needed? Just ignore the parameter
    _, err := h.repo.Create(ctxWithTx, payload)
    return err
})
```

## Multiple Operations

```go
err := h.tx.WithinTransaction(ctx, func(ctxWithTx context.Context, hook func(transactor.PostCommitHook)) error {
    // Create order
    order, err := h.orderRepo.Create(ctxWithTx, orderPayload)
    if err != nil {
        return err
    }
    
    // Create order items
    for _, item := range items {
        _, err := h.itemRepo.Create(ctxWithTx, item)
        if err != nil {
            return err  // All rolled back
        }
    }
    
    hook(func(ctx context.Context) error {
        h.eb.Publish(events.OrderCreated{...})
        return nil
    })
    
    return nil
})
```

## Common Pitfalls

**Incorrect: Using wrong context**
```go
// ❌ Uses outer context, not in transaction
err := h.tx.WithinTransaction(ctx, func(ctxWithTx context.Context, ...) {
    result, err = h.repo.Create(ctx, payload)  // Wrong ctx!
})
```

**Correct: Use ctxWithTx**
```go
// ✅ Uses transaction context
err := h.tx.WithinTransaction(ctx, func(ctxWithTx context.Context, ...) {
    result, err = h.repo.Create(ctxWithTx, payload)  // Correct!
})
```

**Incorrect: Event before commit**
```go
// ❌ Event sent even if transaction fails
h.eb.Publish(event)
return h.repo.Create(ctx, payload)
```

**Correct: Use post-commit hook**
```go
// ✅ Only after successful commit
hook(func(ctx context.Context) error {
    h.eb.Publish(event)
    return nil
})
```
