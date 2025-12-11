# HR Payroll API

Backend API สำหรับระบบ HR Payroll พัฒนาด้วย Go และ Fiber framework

## 🏗️ Project Structure

```
api/
├── app/
│   ├── cmd/api/         # Entry point
│   ├── application/     # Application layer
│   ├── config/          # Configuration
│   ├── docs/            # Swagger docs (auto-generated)
│   └── build/           # Build info
├── modules/             # Domain modules
│   ├── auth/            # Authentication
│   ├── user/            # User management
│   ├── employee/        # Employee management
│   ├── worklog/         # Worklog tracking
│   ├── salaryadvance/   # Salary advance
│   ├── salaryraise/     # Salary raise
│   ├── bonus/           # Bonus management
│   ├── debt/            # Debt & Loan
│   ├── payrollconfig/   # Payroll configuration
│   ├── payrollrun/      # Payroll runs
│   ├── payoutpt/        # Part-time payout
│   └── masterdata/      # Master data
└── shared/              # Shared utilities
    └── common/          # Common helpers
```

## 🚀 Quick Start

### Prerequisites

- Go 1.25+
- PostgreSQL 18+

### Run Development

```bash
# From project root
make run-api

# Or from api/app directory
cd api/app
go run ./cmd/api
```

### Build

```bash
# From project root
make build
# Output: bin/hr-payroll-api
```

### Docker

```bash
make image-api
# Creates: hr-payroll-api:<version>
```

## ⚙️ Configuration

Environment variables (via `.env` in project root):

| Variable             | Description                  | Default |
| -------------------- | ---------------------------- | ------- |
| `DB_DSN`             | PostgreSQL connection string | -       |
| `JWT_ACCESS_SECRET`  | JWT access token secret      | -       |
| `JWT_REFRESH_SECRET` | JWT refresh token secret     | -       |

## 📖 API Documentation

Generate Swagger documentation:

```bash
make doc
```

Access Swagger UI at: `http://localhost:3001/swagger/`

## 🧪 Tech Stack

- **Framework**: [Fiber v3](https://gofiber.io/)
- **Database**: PostgreSQL with [sqlx](https://github.com/jmoiron/sqlx)
- **Auth**: JWT (golang-jwt/jwt/v5)
- **Logging**: [Zap](https://github.com/uber-go/zap)
- **Config**: [env](https://github.com/caarlos0/env)

## 📦 Modules

| Module          | Description                   |
| --------------- | ----------------------------- |
| `auth`          | Authentication & JWT handling |
| `user`          | User CRUD operations          |
| `employee`      | Employee management (FT/PT)   |
| `worklog`       | Worklog tracking              |
| `salaryadvance` | Salary advance requests       |
| `salaryraise`   | Salary adjustments            |
| `bonus`         | Bonus cycles & payments       |
| `debt`          | Debt & Loan management        |
| `payrollconfig` | Payroll configuration         |
| `payrollrun`    | Payroll run processing        |
| `payoutpt`      | Part-time payouts             |
| `masterdata`    | Master data (banks, etc.)     |
