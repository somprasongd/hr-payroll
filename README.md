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

1. **Run the application**

```bash
# Run both API and Web concurrently
make run

# Or run separately
make run-api  # API at http://localhost:3001
make run-web  # Web at http://localhost:3000
```

## 📦 Make Commands

| Command                 | Description                    |
| ----------------------- | ------------------------------ |
| `make run`              | Run API and Web concurrently   |
| `make run-api`          | Run API server only            |
| `make run-web`          | Run Web dev server only        |
| `make build`            | Build API binary               |
| `make devup`            | Start dev Docker services      |
| `make devdown`          | Stop dev Docker services       |
| `make produp-build`     | Build and run production       |
| `make mgu`              | Run database migrations (up)   |
| `make mgd`              | Rollback database migration    |
| `make mgc filename=xxx` | Create new migration file      |
| `make doc`              | Generate Swagger documentation |

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

## 🛠️ Tech Stack

### Backend (API)

- Go 1.25
- Fiber v3
- PostgreSQL
- sqlx

### Frontend (Web)

- Next.js 16
- React 19
- TailwindCSS 4
- TanStack Query
- Zustand
- Zod

## 📁 Related Documentation

- [API README](./api/README.md)
- [Web README](./web/README.md)
