# HR Payroll API

Backend API สำหรับระบบ HR Payroll พัฒนาด้วย Go และ Fiber framework

## 🏗️ Project Structure

```
api/
├── app/
│   ├── cmd/api/         # Entry point
│   ├── application/     # Application bootstrap & module registration
│   ├── config/          # Configuration
│   └── docs/            # Swagger docs (auto-generated)
├── modules/             # Domain modules
│   ├── auth/            # Authentication
│   ├── user/            # User management
│   ├── company/         # Company management
│   ├── branch/          # Branch management
│   ├── tenant/          # Multi-tenancy queries
│   ├── employee/        # Employee management
│   ├── worklog/         # Worklog tracking
│   ├── salaryadvance/   # Salary advance
│   ├── salaryraise/     # Salary raise
│   ├── bonus/           # Bonus management
│   ├── debt/            # Debt & Loan
│   ├── payrollconfig/   # Payroll configuration
│   ├── payrollrun/      # Payroll runs
│   ├── payoutpt/        # Part-time payout
│   ├── masterdata/      # Master data
│   ├── activitylog/     # Activity logging
│   ├── userbranch/      # User-branch assignment
│   ├── dashboard/       # Dashboard stats
│   └── superadmin/      # Super admin operations
└── shared/
    ├── common/          # Common utilities
    │   ├── mediator/    # CQRS Mediator
    │   ├── eventbus/    # Event bus
    │   ├── middleware/  # HTTP middleware
    │   ├── contextx/    # Context helpers
    │   ├── errs/        # Error handling
    │   └── module/      # Module interface
    ├── contracts/       # Cross-module contracts
    └── events/          # Event definitions
```

## 🎯 Architecture: CQRS + Mediator Pattern

### Module Structure

แต่ละ module มีโครงสร้าง:

```
modules/<module-name>/
├── module.go                    # Module registration & Init()
├── go.mod                       # Go module file
└── internal/
    ├── feature/                 # Feature handlers
    │   ├── <feature-name>/
    │   │   ├── endpoint.go      # HTTP endpoint
    │   │   ├── command.go       # Write operation (CQRS)
    │   │   └── query.go         # Read operation (CQRS)
    └── repository/              # Database access
```

### CQRS Pattern

**Command/Query Separation** - แยก Read (Query) และ Write (Command) operations:

```go
// endpoint.go - HTTP Layer
func NewEndpoint(router fiber.Router, repo repository.Repository) {
    router.Get("/items", func(c fiber.Ctx) error {
        resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{Repo: repo})
        if err != nil {
            return err
        }
        return c.JSON(resp)
    })
}

// query.go - Query Handler (Read)
type Query struct {
    Repo repository.Repository
}
type Response struct {
    Items []Item `json:"items"`
}
type queryHandler struct{}
func NewHandler() *queryHandler { return &queryHandler{} }
func (h *queryHandler) Handle(ctx context.Context, q *Query) (*Response, error) {
    items, err := q.Repo.List(ctx)
    return &Response{Items: items}, err
}

// command.go - Command Handler (Write)
type Command struct {
    Repo  repository.Repository
    Name  string
}
type Response struct {
    Item *Item `json:"item"`
}
type commandHandler struct{}
func NewHandler() *commandHandler { return &commandHandler{} }
func (h *commandHandler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
    item, err := cmd.Repo.Create(ctx, cmd.Name)
    return &Response{Item: item}, err
}
```

### Mediator Pattern

**Centralized Request Handling** - ทุก request ผ่าน mediator:

```go
// module.go - Register handlers
func (m *Module) Init(eb eventbus.EventBus) error {
    mediator.Register[*list.Query, *list.Response](list.NewHandler())
    mediator.Register[*create.Command, *create.Response](create.NewHandler())
    return nil
}

// endpoint.go - Send via mediator
resp, err := mediator.Send[*Query, *Response](ctx, &Query{...})
```

### Cross-Module Communication via Contracts

เมื่อ module A ต้องเรียก module B:

```go
// shared/contracts/company.go - Define contracts
type GetCompanyByIDQuery struct {
    ID uuid.UUID
}
type GetCompanyByIDResponse struct {
    Company *CompanyDTO `json:"company"`
}

// modules/company/module.go - Register contract handler
mediator.Register[*contracts.GetCompanyByIDQuery, *contracts.GetCompanyByIDResponse](
    getbyid.NewHandler(m.repo),
)

// modules/superadmin/.../endpoint.go - Use contract via mediator
resp, err := mediator.Send[*contracts.GetCompanyByIDQuery, *contracts.GetCompanyByIDResponse](
    ctx, &contracts.GetCompanyByIDQuery{ID: id},
)
```

## 🚀 Quick Start

### Prerequisites

- Go 1.25+
- PostgreSQL 18+

### Run Development

```bash
# From api/app directory
cd api/app
go run ./cmd/api
```

### Build

```bash
make build
# Output: bin/hr-payroll-api
```

### Docker

```bash
make image-api
```

## ⚙️ Configuration

| Variable             | Description                  |
| -------------------- | ---------------------------- |
| `DB_DSN`             | PostgreSQL connection string |
| `JWT_ACCESS_SECRET`  | JWT access token secret      |
| `JWT_REFRESH_SECRET` | JWT refresh token secret     |

## 📖 API Documentation

```bash
make doc
```

Access at: `http://localhost:8080/swagger/`

## 🏢 Multi-Tenancy

- **Row-Level Security (RLS)** on all tenant-specific tables
- **Automatic tenant assignment** via BEFORE INSERT triggers
- **Tenant middleware** sets context from JWT claims

```sql
tenant_company_matches(company_id UUID) → BOOLEAN
tenant_branch_allowed(branch_id UUID) → BOOLEAN
```

## 🧪 Tech Stack

- **Framework**: [Fiber v3](https://gofiber.io/)
- **Database**: PostgreSQL + [sqlx](https://github.com/jmoiron/sqlx)
- **Auth**: JWT (golang-jwt/jwt/v5)
- **Logging**: [Zap](https://github.com/uber-go/zap)
