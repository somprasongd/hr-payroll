# shared-contracts

Cross-module contracts for inter-module communication.

## Purpose

Contracts คือ DTOs สำหรับ communication ระหว่าง modules ผ่าน Mediator pattern:
- **Commands** - Write operations (Create*, Update*, Delete*)
- **Responses** - Return values from commands/queries
- **Events** - Async notifications via EventBus

Contracts อยู่ใน `/api/shared/contracts/` ไม่ผูกกับ module ใด module หนึ่ง

## Directory Structure

```
api/shared/contracts/
├── company/              # Company module contracts
│   ├── command_create.go
│   └── event_created.go
├── orgprofile/           # OrgProfile module contracts
│   └── command_create.go
├── payroll/              # Payroll module contracts
│   └── command_create.go
└── employee/             # Employee module contracts
    └── event_created.go
```

## Naming Conventions

### Commands
```go
// Format: <Action><Entity>DirectCommand
// - "Direct" suffix = called by other modules (not via HTTP)
// - "Command" suffix = write operation

type CreateOrgProfileDirectCommand struct {
    CompanyID uuid.UUID
    Address   string
    Phone     string
}

type CreateOrgProfileDirectResponse struct {
    OrgProfileID uuid.UUID
    CreatedAt    time.Time
}
```

### Events (Async)
```go
// Format: <Entity><Action>ed
// - Past tense suffix
// - Used with EventBus

type EmployeeCreated struct {
    EmployeeID uuid.UUID
    CompanyID  uuid.UUID
    Email      string
    CreatedAt  time.Time
}

func (e EmployeeCreated) EventName() string {
    return "employee.created"
}
```

## File: api/shared/contracts/company/command_create.go

```go
package company

import (
    "time"
    "github.com/google/uuid"
)

// CreateCompanyDirectCommand is called by superadmin module to create company.
type CreateCompanyDirectCommand struct {
    Code   string
    Name   string
    TaxID  string
    ActorID uuid.UUID  // Who initiated
}

// CreateCompanyDirectResponse returns created company info.
type CreateCompanyDirectResponse struct {
    ID        uuid.UUID
    Code      string
    Name      string
    CreatedAt time.Time
}
```

## File: api/shared/contracts/orgprofile/command_create.go

```go
package orgprofile

import (
    "time"
    "github.com/google/uuid"
)

// CreateOrgProfileDirectCommand creates org profile for new company.
type CreateOrgProfileDirectCommand struct {
    CompanyID uuid.UUID
    Address   string
    Phone     string
    Email     string
}

type CreateOrgProfileDirectResponse struct {
    OrgProfileID uuid.UUID
    CreatedAt    time.Time
}
```

## Using Contracts with Mediator

### Module A: Sending Command
```go
package createcompany

import (
    "{project}/api/shared/contracts/orgprofile"
    "{project}/api/shared/contracts/payroll"
    "{project}/api/shared/mediator"
)

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
    err := h.tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func()) error {
        // 1. Create company
        company, err := h.repo.Create(ctxTx, cmd.Code, cmd.Name)
        if err != nil {
            return err
        }
        
        // 2. Call OrgProfile module (cross-module)
        orgProfileCmd := &orgprofile.CreateOrgProfileDirectCommand{
            CompanyID: company.ID,
            Address:   cmd.Address,
        }
        _, err = mediator.Send[*orgprofile.CreateOrgProfileDirectCommand, 
            *orgprofile.CreateOrgProfileDirectResponse](ctxTx, orgProfileCmd)
        if err != nil {
            return err
        }
        
        // 3. Call Payroll module (cross-module)
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

### Module B: Registering Handler
```go
package orgprofile

import (
    "{project}/api/shared/contracts/orgprofile"
    "{project}/api/shared/mediator"
)

func init() {
    // Register handler for cross-module command
    mediator.Register(
        func(cmd *orgprofile.CreateOrgProfileDirectCommand, ctx context.Context) 
            (*orgprofile.CreateOrgProfileDirectResponse, error) {
            
            handler := &CreateHandler{
                repo: di.GetOrgProfileRepo(),
            }
            return handler.Handle(ctx, cmd)
        },
    )
}
```

## Using Contracts with EventBus

### Publishing Event
```go
package create

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
    emp, err := h.repo.Create(ctx, cmd)
    if err != nil {
        return nil, err
    }
    
    // Publish event for other modules
    h.eventBus.Publish(employee.EmployeeCreated{
        EmployeeID: emp.ID,
        CompanyID:  cmd.CompanyID,
        Email:      cmd.Email,
        CreatedAt:  time.Now(),
    })
    
    return &Response{ID: emp.ID}, nil
}
```

### Subscribing to Event
```go
package notification

func (m *Module) Init(eventBus eventbus.EventBus) error {
    // Subscribe to employee events
    eventBus.Subscribe(func(evt employee.EmployeeCreated) {
        m.sendWelcomeEmail(evt.Email, evt.EmployeeID)
    })
    
    return nil
}
```

## Best Practices

### ✅ Do
- **Suffix with "Direct"** for inter-module commands (`CreateXxxDirectCommand`)
- **Keep contracts minimal** - ส่งเฉพาะ fields ที่จำเป็น
- **Use pointer receivers** - `*Command` สำหรับ mediator
- **Version events** - เพิ่ม `Version int` ถ้า event schema อาจเปลี่ยน
- **Document ownership** - Comment ว่า module ไหนเป็นเจ้าของ contract

### ❌ Don't
- **Don't expose internal types** - ใช้ primitive types ใน contracts
- **Don't use `interface{}`** - Type-safe เสมอ
- **Don't mix HTTP DTOs** - Contracts แยกจาก request/response structs
- **Don't circular reference** - Module A → B → C ได้ แต่ A ↔ B ไม่ได้

## Common Pitfalls

**Incorrect: Same struct for HTTP and mediator**
```go
// ❌ HTTP concerns leak into cross-module communication
type CreateRequest struct {
    Name   string      `json:"name" validate:"required"`
    File   *multipart.FileHeader  // HTTP-specific!
}
```

**Correct: Separate concerns**
```go
// api/modules/company/dto.go - HTTP-specific
type CreateRequest struct {
    Name string `json:"name" validate:"required"`
}

// api/shared/contracts/company/command_create.go - Cross-module
type CreateCompanyDirectCommand struct {
    Name   string
    ActorID uuid.UUID  // Internal context, not from HTTP
}
```

## Related

- **Mediator pattern**: See `module-cqrs-command.md`
- **Event bus**: See `module-events.md`
- **Module registration**: See `module-registration.md`
