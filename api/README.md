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

## 🎯 Architecture: Modular Monolith

ระบบออกแบบโดยใช้แนวคิด **Modular Monolith** ซึ่งแบ่งธุรกิจออกเป็นโมดูลอิสระแต่รันอยู่ใน Process เดียวกัน มุ่งเน้นไปที่:

1.  **CQRS Pattern**: แยกความรับผิดชอบของการอ่าน (Query) และการเขียน (Command)
2.  **Mediator Pattern**: ลดการพึ่งพากันโดยตรงระหว่างโมดูล (Loose Coupling)
3.  **Integration Events**: ใช้สำหรับงานต่อเนื่อง (side effects) ที่ทำหลัง DB transaction สำเร็จแล้ว ผ่าน Internal Event Bus

หมายเหตุ: ถ้าเป็นงานที่ต้องการ atomic อยู่ใน transaction เดียวกัน ให้เรียกผ่าน mediator แบบ synchronous ได้ แต่ถ้าเป็นงานที่ไม่จำเป็นต้อง atomic ให้ publish เป็น integration events หลัง commit (post-commit) เพื่อแยกความรับผิดชอบและรองรับ eventual consistency โดยใช้ `transactor.WithinTransaction` แล้ว `registerPostCommitHook(...)` ใน handler เพื่อให้ event ถูกยิงหลัง commit จริง

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

ระบบรองรับ Multi-Company และ Multi-Branch โดยใช้ **Row-Level Security (RLS)** และ **Application-Level Filtering**

### Tenant Context

ทุก API request ต้องส่ง Headers:

- `X-Company-ID`: UUID ของบริษัท
- `X-Branch-ID`: UUID ของสาขา

```go
// TenantMiddleware ใน middleware/tenant.go
tenant := contextx.TenantInfo{
    CompanyID: companyID,
    BranchID:  branchID,
    IsAdmin:   isAdmin,
}
ctx := contextx.TenantToContext(c.Context(), tenant)
```

### Tables with company_id + branch_id (14 ตาราง)

| ตาราง                | Tenant Filter    | INSERT      | หมายเหตุ                          |
| -------------------- | ---------------- | ----------- | --------------------------------- |
| `employees`          | ✅ Direct        | ✅ Explicit | Primary tenant table              |
| `payroll_run`        | ✅ Direct        | ✅ Explicit | -                                 |
| `payroll_run_item`   | ✅ Via employees | ⚡ Trigger  | Auto-copy from payroll_run        |
| `worklog_ft`         | ✅ Via employees | ✅ Explicit | -                                 |
| `worklog_pt`         | ✅ Via employees | ✅ Explicit | -                                 |
| `payout_pt`          | ✅ Direct        | ✅ Explicit | -                                 |
| `payout_pt_item`     | ⚡ Via payout    | ⚡ Trigger  | Auto-copy from payout_pt          |
| `salary_advance`     | ✅ Via employees | ✅ Explicit | -                                 |
| `debt_txn`           | ✅ Direct        | ✅ Explicit | -                                 |
| `bonus_cycle`        | ✅ Direct        | ✅ Explicit | -                                 |
| `bonus_item`         | ✅ Via employees | ⚡ Trigger  | Auto-copy from bonus_cycle        |
| `salary_raise_cycle` | ✅ Direct        | ✅ Explicit | -                                 |
| `salary_raise_item`  | ✅ Via employees | ⚡ Trigger  | Auto-copy from salary_raise_cycle |
| `activity_logs`      | ✅ Direct        | ✅ Explicit | Optional (system logs)            |

### Tables with company_id only (8 ตาราง)

| ตาราง                  | Tenant Filter | INSERT      | หมายเหตุ                |
| ---------------------- | ------------- | ----------- | ----------------------- |
| `department`           | ✅ Direct     | ✅ Explicit | Master data             |
| `employee_position`    | ✅ Direct     | ✅ Explicit | Master data             |
| `payroll_config`       | ✅ Direct     | ✅ Explicit | Company-level config    |
| `payroll_accumulation` | ✅ Direct     | ⚡ Trigger  | Auto-copy from employee |
| `payroll_org_profile`  | ✅ Direct     | ✅ Explicit | Company profile         |
| `payroll_org_logo`     | ✅ Direct     | ✅ Explicit | Company logo            |
| `employee_document`    | ✅ Direct     | ✅ Explicit | -                       |
| `employee_photo`       | ✅ Direct     | ✅ Explicit | -                       |

### Legend

- ✅ **Direct**: Filter directly on table's company_id/branch_id
- ✅ **Via employees**: JOIN with employees table for tenant filtering
- ⚡ **Trigger**: Auto-populated by database BEFORE INSERT trigger

### Database Triggers

```sql
-- Auto-populate tenant columns from parent table
CREATE TRIGGER tg_bonus_item_set_tenant
BEFORE INSERT ON bonus_item FOR EACH ROW
EXECUTE FUNCTION bonus_item_set_tenant();

-- Auto-populate tenant columns from employees table
CREATE TRIGGER tg_worklog_ft_set_tenant
BEFORE INSERT ON worklog_ft FOR EACH ROW
EXECUTE FUNCTION set_tenant_from_employee();
```

### RLS Functions

```sql
tenant_company_matches(company_id UUID) → BOOLEAN
tenant_branch_allowed(branch_id UUID) → BOOLEAN
```

## 🧪 Tech Stack

- **Framework**: [Fiber v3](https://gofiber.io/)
- **Database**: PostgreSQL + [sqlx](https://github.com/jmoiron/sqlx)
- **Auth**: JWT (golang-jwt/jwt/v5)
- **Logging**: [Zap](https://github.com/uber-go/zap)
