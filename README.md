# HR Payroll

[![E2E Tests](https://github.com/somprasongd/hr-payroll/actions/workflows/e2e-tests.yml/badge.svg)](https://github.com/somprasongd/hr-payroll/actions/workflows/e2e-tests.yml)

ระบบจัดการเงินเดือนและทรัพยากรบุคคล (HR Payroll Management System)

## 🏗️ Project Structure

```
├── api/                  # Backend API (Go/Fiber)
├── web/                  # Frontend Web (Next.js)
├── migrations/           # SQL Database Migrations
├── docs/                 # Documentation
├── nginx/                # Nginx Configuration
└── docker-compose*.yml   # Docker Configuration
```

## 🏗️ Architecture

ระบบพัฒนาด้วยแนวคิด **Modular Monolith** เพื่อความง่ายในการดูแลรักษาและความสามารถในการขยายตัวในอนาคต:

- **Modular Monolith**: แยกโดเมนธุรกิจออกเป็นโมดูลอิสระ (เช่น `auth`, `employee`, `payroll`)
- **Mediator Pattern**: ใช้เป็นตัวกลางในการสื่อสารระหว่างโมดูลและภายในโมดูลเอง
- **CQRS (Command Query Responsibility Segregation)**: แยกส่วนการเขียน (Command) และการอ่าน (Query) ข้อมูลออกจากกัน
- **Integration Events**: ใช้ Event Bus สำหรับการสื่อสารแบบ Asynchronous ระหว่างโมดูล
- **Multi-Tenancy**: รองรับการแยกข้อมูลรายบริษัท (Company) และรายสาขา (Branch) โดยใช้ PostgreSQL RLS

## 🚀 Quick Start

### Prerequisites

- **Go** 1.25+
- **Node.js** 18+
- **Docker** & Docker Compose
- **PostgreSQL** 18+

### Development Setup

1. **Clone the repository**

```bash
git clone <repository-url>
cd hr-payroll
```

1. **Setup environment variables**

```bash
cp .env.example .env
```

1. **Start the database**

```bash
make devup
```

1. **Run database migrations**

```bash
make mgu
```

1. **(Optional) Seed development data**

```bash
make seed
```

1. **Run the application**

```bash
# Run both API and Web concurrently
make run

# Or run separately
make run-api  # API at http://localhost:8080
make run-web  # Web at http://localhost:3000
```

## 📦 Make Commands

| Command                 | Description                                 |
| ----------------------- | ------------------------------------------- |
| `make run`              | Run API and Web concurrently                |
| `make run-api`          | Run API server only                         |
| `make run-web`          | Run Web dev server only                     |
| `make build`            | Build API binary                            |
| `make devup`            | Start dev Docker services (PostgreSQL)      |
| `make devdown`          | Stop dev Docker services                    |
| `make devdownv`         | Stop services and **remove volumes**        |
| `make image`            | Build both API and Web Docker images        |
| `make produp`           | Run production stack (from prebuilt images) |
| `make produp-build`     | Build locally and run production stack      |
| `make proddown`         | Stop production services                    |
| `make mgu`              | Run database migrations (up)                |
| `make mgd`              | Rollback database migration (1 step)        |
| `make mgc filename=xxx` | Create a new SQL migration file             |
| `make mgv`              | Check current database migration version    |
| `make mgf VERSION=xxx`  | Force database migration version            |
| `make seed`             | Import all dev seed data (clears old data)  |
| `make db-seed-clear`    | Clear all dev seed data                     |
| `make test-e2e`         | Run all E2E tests (Playwright)              |
| `make test-e2e-ui`      | Run E2E tests in UI mode                    |
| `make doc`              | Generate Swagger documentation              |
| `make dbml`             | Generate DBML schema from database          |
| `make changelog`        | Generate/Update full CHANGELOG.md           |

## 🐳 Docker

### Development

```bash
make devup       # Start PostgreSQL
make devdown     # Stop services
make devdownv    # Stop and remove volumes
```

### Production (Build Locally)

```bash
make produp-build  # Build images and start
make proddown      # Stop services
```

### Full Stack (Images)

Use `docker-compose.prod.yml` to run the full stack from prebuilt images (db, migrate, api, web, pgadmin, postgresus, proxy).

```bash
# Default: pull from GHCR (set IMAGE_PREFIX in .env or export it)
make produp

# Use locally built images
make produp-build
```

Environment variables:

- `BUILD_VERSION` sets the image tag (default: `latest`)
- `IMAGE_PREFIX` sets the image registry prefix (default: empty for local, set to `ghcr.io/somprasongd/` for registry)

Access:

- Web: http://localhost/
- API: http://localhost/api/ (proxy)
- pgAdmin: http://localhost/pgadmin/
- Postgresus: http://localhost:4005

## 🧾 Changelog

This project uses `git-cliff` with Conventional Commits.

```bash
# Generate full changelog
make changelog

# Update Unreleased section
make changelog-unreleased

# Prepare a release entry
make changelog-release CHANGELOG_TAG=v1.0.0
```

Recommended flow:

1. Commit code changes
2. Run `make changelog-unreleased` and commit `CHANGELOG.md`
3. For releases, run `make changelog-release CHANGELOG_TAG=vX.Y.Z` and commit
4. Create git tag after the changelog commit

## 📚 Features

- **Employee Management** (Full-time & Part-time)
- **Worklog Tracking**
- **Salary Advance**
- **Debt & Loan Management**
- **Bonus Management**
- **Salary Raise**
- **Part-time Payout**
- **Payroll Run**
- **User Management**
- **Multi-Tenancy** (Company & Branch isolation)

## 🏢 Multi-Tenancy

The system supports multi-company and multi-branch isolation using PostgreSQL Row-Level Security (RLS).

### Key Features

- **Company & Branch Isolation**: All tenant-specific data is scoped by `company_id` and `branch_id`
- **User Company Roles**: Users can have different roles in different companies
- **User Branch Access**: Fine-grained branch-level access control
- **Automatic Tenant Assignment**: Triggers auto-populate tenant columns on INSERT
- **Superadmin Role**: Cross-tenant management capabilities
- **Branch Lifecycle Management**: Full status workflow with soft delete support

### Required Request Headers

For Platform APIs (non-superadmin routes), the following headers are **required**:

| Header         | Description                   | Required |
| -------------- | ----------------------------- | -------- |
| `X-Company-ID` | UUID of the company to access | Yes      |
| `X-Branch-ID`  | UUID of the selected branch   | **Yes**  |

> **Note:** If `X-Branch-ID` is missing, the API will return `400 Bad Request`.
> Superadmin routes (`/super-admin/*`) do not require these headers.

### Branch Status Workflow

Branches have a status-based lifecycle:

```
active → suspended → archived → deleted (soft delete)
         ↓
         archived → deleted (soft delete)
```

| Status      | Can Edit | Can Delete | Visible in UI |
| ----------- | -------- | ---------- | ------------- |
| `active`    | ✅       | ❌         | ✅            |
| `suspended` | ❌       | ❌         | ✅            |
| `archived`  | ❌       | ✅         | ✅            |
| `deleted`   | ❌       | ❌         | ❌            |

**Delete Rules:**

- Branch must be `archived` before deletion
- Default branch cannot be deleted

### Database Tables

| Table                | Tenant Columns            | Description                |
| -------------------- | ------------------------- | -------------------------- |
| `companies`          | -                         | Company master data        |
| `branches`           | `company_id`              | Branch within company      |
| `user_company_roles` | -                         | User-company role mapping  |
| `user_branch_access` | -                         | User-branch access mapping |
| `employees`          | `company_id`, `branch_id` | Employee data              |
| `department`         | `company_id`              | Departments                |
| `employee_position`  | `company_id`              | Positions                  |
| `payroll_*`          | `company_id`, `branch_id` | Payroll data               |
| `bonus_*`            | `company_id`, `branch_id` | Bonus data                 |
| `salary_raise_*`     | `company_id`, `branch_id` | Salary Raise data          |
| `salary_advance`     | `company_id`              | Salary Advance             |
| `debt_txn`           | `company_id`              | Debt & Loan                |
| `worklog_*`          | `company_id`, `branch_id` | Worklog data               |
| `activity_logs`      | `company_id`, `branch_id` | Audit Logs                 |

## 🛠️ Tech Stack

### Backend (API)

- Go 1.25
- Fiber v3
- PostgreSQL
- sqlx

### Frontend (Web)

- Next.js 16 (App Router)
- React 19
- TypeScript
- TailwindCSS 4
- Shadcn/UI (Radix UI)
- next-intl (Localization)
- TanStack Query (v5) & TanStack Table (v8)
- Zustand (State Management)
- React Hook Form & Zod (Validation)
- Axios (HTTP Client)
- Recharts (Data Visualization)
- Playwright (E2E Testing)
- @ducanh2912/next-pwa (PWA support)

## 📁 Related Documentation

- [API README](./api/README.md)
- [Web README](./web/README.md)
- [API Specification](./docs/design/api_specification.md)
- [Database Schema (DBML)](./docs/design/schema.dbml)
