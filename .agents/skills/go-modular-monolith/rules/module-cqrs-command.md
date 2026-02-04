# module-cqrs-command

Command handlers for write operations with transaction support.

## Why Command Pattern

- Encapsulates write operations
- Explicit transaction boundaries
- Post-commit event publishing
- Clear error handling

## File: internal/feature/{action}/command.go

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

// Command represents the intent to create something
type Command struct {
    Payload RequestBody
}

// Response contains the result of the command
type Response struct {
    dto.Detail
}

// Handler processes the command
type Handler struct {
    repo repository.Repository
    tx   transactor.Transactor
    eb   eventbus.EventBus
}

// Compile-time interface check
var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

// NewHandler creates a new command handler
func NewHandler(repo repository.Repository, tx transactor.Transactor, eb eventbus.EventBus) *Handler {
    return &Handler{repo: repo, tx: tx, eb: eb}
}

// Handle executes the command
func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
    // 1. Extract tenant context
    tenant, ok := contextx.TenantFromContext(ctx)
    if !ok {
        return nil, errs.Unauthorized("missing tenant context")
    }
    
    // 2. Extract user context
    user, ok := contextx.UserFromContext(ctx)
    if !ok {
        return nil, errs.Unauthorized("missing user context")
    }
    
    // 3. Validate payload
    if err := validatePayload(cmd.Payload); err != nil {
        return nil, err
    }
    
    // 4. Convert to repository record
    recPayload := cmd.Payload.ToRecord()
    
    // 5. Execute within transaction
    var created *repository.Record
    err := h.tx.WithinTransaction(ctx, func(ctxWithTx context.Context, hook func(transactor.PostCommitHook)) error {
        var err error
        created, err = h.repo.Create(ctxWithTx, recPayload, tenant.CompanyID, tenant.BranchID, user.ID)
        if err != nil {
            return err
        }
        
        // 6. Register post-commit hook for events
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
    
    // 7. Return response
    return &Response{Detail: dto.FromRecord(*created)}, nil
}

func validatePayload(p RequestBody) error {
    if p.Name == "" {
        return errs.BadRequest("name is required")
    }
    return nil
}
```

## Command Handler Pattern

1. **Extract context** - Tenant and user from context
2. **Validate input** - Business rule validation
3. **Start transaction** - All writes in transaction
4. **Execute operation** - Call repository
5. **Register hooks** - Post-commit events
6. **Return result** - Convert to DTO

## Common Pitfalls

**Incorrect: No transaction wrapper**
```go
// ❌ Direct repository call without transaction
created, err := h.repo.Create(ctx, payload, companyID, branchID, userID)
```

**Correct: Always use transaction**
```go
// ✅ Transaction ensures consistency
err := h.tx.WithinTransaction(ctx, func(ctxWithTx context.Context, hook func(transactor.PostCommitHook)) error {
    created, err = h.repo.Create(ctxWithTx, payload, companyID, branchID, userID)
    // ...
})
```

**Incorrect: Publishing events before commit**
```go
// ❌ Event published even if transaction fails
h.eb.Publish(event)  // Don't do this inside transaction
```

**Correct: Use post-commit hook**
```go
// ✅ Event only published after successful commit
hook(func(ctx context.Context) error {
    h.eb.Publish(event)
    return nil
})
```

## Multiple Cross-Module Calls in Transaction

เมื่อต้องการสร้างข้อมูลหลาย modules ภายใน transaction เดียว:

```go
package createcompany

import (
    "{project}/api/shared/contracts/orgprofile"
    "{project}/api/shared/contracts/payroll"
    "{project}/api/shared/mediator"
)

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
    var result *Response
    
    err := h.tx.WithinTransaction(ctx, func(ctxTx context.Context, hook func(transactor.PostCommitHook)) error {
        // 1. Create company in this module
        company, txErr := h.repo.Create(ctxTx, cmd.Code, cmd.Name, cmd.ActorID)
        if txErr != nil {
            return txErr
        }
        
        // 2. Call OrgProfile module (cross-module via mediator)
        orgProfileCmd := &orgprofile.CreateOrgProfileDirectCommand{
            CompanyID: company.ID,
            Address:   cmd.Address,
            Phone:     cmd.Phone,
            Email:     cmd.Email,
        }
        _, txErr = mediator.Send[*orgprofile.CreateOrgProfileDirectCommand, 
            *orgprofile.CreateOrgProfileDirectResponse](ctxTx, orgProfileCmd)
        if txErr != nil {
            return txErr
        }
        
        // 3. Call Payroll module (cross-module via mediator)
        payrollCmd := &payroll.CreatePayrollConfigDirectCommand{
            CompanyID: company.ID,
            Currency:  cmd.Currency,
            Cycle:     cmd.PayrollCycle,
        }
        _, txErr = mediator.Send[*payroll.CreatePayrollConfigDirectCommand,
            *payroll.CreatePayrollConfigDirectResponse](ctxTx, payrollCmd)
        if txErr != nil {
            return txErr
        }
        
        // 4. Build result
        result = &Response{
            ID:        company.ID,
            Code:      company.Code,
            Name:      company.Name,
            CreatedAt: company.CreatedAt,
        }
        
        // 5. Register post-commit event
        hook(func(ctx context.Context) error {
            h.eb.Publish(CompanyCreatedEvent{
                CompanyID: company.ID,
                ActorID:   cmd.ActorID,
            })
            return nil
        })
        
        return nil
    })
    
    if err != nil {
        return nil, errs.Internal("failed to create company: %v", err)
    }
    
    return result, nil
}
```

### Transaction Guarantees

```go
// All operations succeed or all fail together:
// ✅ Company created + OrgProfile created + Payroll created
// ❌ Company created + OrgProfile failed (rolled back)
// ❌ Company created + OrgProfile created + Payroll failed (rolled back)
```

### Error Handling

```go
// Handle unique constraint errors
import "github.com/lib/pq"

if pqErr, ok := txErr.(*pq.Error); ok {
    if pqErr.Code == "23505" {  // unique_violation
        return errs.Conflict("company with this code already exists")
    }
}
```

### Mediator Handler Registration

แต่ละ target module ต้อง register handler สำหรับ command:

```go
// api/modules/orgprofile/init.go
package orgprofile

import (
    "{project}/api/shared/contracts/orgprofile"
    "{project}/api/shared/mediator"
)

func init() {
    mediator.Register(
        func(cmd *orgprofile.CreateOrgProfileDirectCommand, ctx context.Context) 
            (*orgprofile.CreateOrgProfileDirectResponse, error) {
            
            // Get dependencies from DI
            repo := di.GetOrgProfileRepo()
            
            // Execute
            profile, err := repo.Create(ctx, cmd.CompanyID, cmd.Address, cmd.Phone)
            if err != nil {
                return nil, err
            }
            
            return &orgprofile.CreateOrgProfileDirectResponse{
                OrgProfileID: profile.ID,
                CreatedAt:    profile.CreatedAt,
            }, nil
        },
    )
}
```

## Related

- **Contracts**: See `shared-contracts.md` for DTO definitions
- **Mediator**: See `module-cross-module-sync.md` for sync communication
- **Events**: See `module-events.md` for async communication
