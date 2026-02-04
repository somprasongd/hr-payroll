# Go Modular Monolith Skill

A comprehensive skill for building Go APIs using modular monolith architecture with CQRS patterns, multi-tenancy, and clean architecture.

## Overview

This skill provides patterns and best practices for building scalable Go backend APIs with:

- **Modular Monolith Architecture** - Clear domain boundaries with separate modules
- **CQRS Pattern** - Separate commands (write) and queries (read)
- **Multi-Tenancy** - PostgreSQL RLS for data isolation
- **Event-Driven** - Cross-module communication via event bus
- **Clean Architecture** - Clear separation of concerns

## When to Use

Use this skill when:

- Bootstrapping new Go API projects
- Creating domain modules with CRUD operations
- Adding authentication and authorization middleware
- Setting up database migrations with RLS

## Skill Structure

```
go-modular-monolith/
├── SKILL.md              # Quick reference index
├── AGENTS.md             # Complete guide (all rules expanded)
├── README.md             # This file
├── rules/                # Individual rule files
│   ├── bootstrap-*.md    # Project setup
│   ├── module-*.md       # Module development
│   ├── middleware-*.md   # HTTP middleware
│   ├── db-*.md           # Database & migrations
│   └── shared-*.md       # Shared libraries
└── assets/
    └── templates/        # Project templates
        ├── Makefile
        ├── Dockerfile
        ├── docker-compose.yml
        ├── docker-compose.dev.yml
        ├── nginx.conf
        └── .env.example
```

## Rule Categories

| Priority | Category | Impact | Rules |
|----------|----------|--------|-------|
| 1 | `bootstrap-*` | CRITICAL | Project structure, Go workspace, DevOps templates |
| 2 | `module-*` | CRITICAL | Module structure, CQRS handlers, Repository, Cross-module sync |
| 3 | `db-*` | HIGH | Migrations, RLS policies, Transactions |
| 4 | `middleware-*` | HIGH | Auth, tenant context, error handling |
| 5 | `shared-*` | MEDIUM | Mediator, errors, context, event bus |

## Quick Start

### 1. Bootstrap New Project

Read these rules in order:

1. `rules/bootstrap-structure.md` - Creates project with:
   - Complete folder structure
   - `Makefile` (run, build, migrate, deploy)
   - `Dockerfile` (multi-stage build)
   - `docker-compose.yml` (production: postgres, nginx, api, migrate)
   - `docker-compose.dev.yml` (development database)
   - `nginx.conf` (reverse proxy)
   - `.env.example` (environment template)
   - `go.work` (Go workspace)

2. `rules/bootstrap-go-work.md` - Configure Go workspace

### 2. Create First Module

Read these rules:

1. `rules/module-structure.md` - Module layout
2. `rules/module-go-mod.md` - Create go.mod (includes Dockerfile update)
3. `rules/module-repository.md` - Database access
4. `rules/module-cqrs-query.md` - List/get operations
5. `rules/module-cqrs-command.md` - Create/update/delete

### 3. Add Authentication

Read:

- `rules/middleware-auth.md` - JWT authentication

### 4. Setup Database

Read:

- `rules/db-migration-tenant.md` - Migrations with RLS

### 5. Deploy

DevOps files are created during bootstrap:

```bash
# Build and deploy
make docker-deploy

# Or manually
docker-compose -f docker-compose.yml up -d
```

## Architecture Overview

```
┌─────────────────────────────────────────┐
│              Nginx (80/443)             │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│           API (Fiber v3)                │
│  ┌───────────────────────────────────┐  │
│  │  Middleware Stack                 │  │
│  │  - RequestLogger                  │  │
│  │  - CORS                           │  │
│  │  - Recovery                       │  │
│  │  - ErrorHandler                   │  │
│  └───────────────────────────────────┘  │
│                  │                      │
│  ┌───────────────▼──────────────┐      │
│  │      Module Router           │      │
│  │  /api/v1/users               │      │
│  │  /api/v1/products            │      │
│  └───────────────┬──────────────┘      │
│                  │                      │
│  ┌───────────────▼──────────────┐      │
│  │    Feature (CQRS)            │      │
│  │  ┌────────┐  ┌────────┐     │      │
│  │  │Command │  │ Query  │     │      │
│  │  │Handler │  │Handler │     │      │
│  │  └───┬────┘  └───┬────┘     │      │
│  │      │           │          │      │
│  │      ▼           ▼          │      │
│  │  ┌──────────────────────┐  │      │
│  │  │      Repository      │  │      │
│  │  │  (sqlx + RLS)        │  │      │
│  │  └──────────────────────┘  │      │
│  └─────────────────────────────┘      │
└───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│        PostgreSQL (RLS enabled)         │
└─────────────────────────────────────────┘
```

## Key Patterns

### CQRS Pattern

- **Commands** - Write operations with transactions
- **Queries** - Read operations without transactions
- **Mediator** - Central dispatcher for routing

### Cross-Module Communication

- **Sync** - Immediate calls via mediator + contracts
- **Async** - Event-driven via event bus
- **Contracts** - Interface definitions in /shared/contracts

### Multi-Tenancy

- **RLS Policies** - Database-level isolation
- **Tenant Context** - Company/branch headers
- **Session Variables** - Set per transaction

### Module Structure

```
modules/{domain}/
├── module.go                    # Module definition
├── go.mod                       # Separate module
└── internal/                    # Not importable externally
    ├── dto/                     # Data transfer objects
    ├── feature/                 # Use cases
    │   ├── create/
    │   │   ├── command.go       # Handler
    │   │   └── endpoint.go      # HTTP + Swagger
    │   └── list/
    │       ├── query.go
    │       └── endpoint.go
    └── repository/
        └── repository.go        # Data access
```

## Dependencies

### Required

- Go 1.25+
- PostgreSQL 16+
- Fiber v3
- sqlx

### Optional

- golang-migrate (migrations)
- Docker & Docker Compose
- Nginx (reverse proxy)

## Files Reference

### SKILL.md

Quick reference index with links to all rules. Use this to find the right rule file.

### AGENTS.md

Complete guide with all rules expanded in one document. Use this for reading the entire guide at once.

### rules/*.md

Individual rule files with:

- Why it matters
- Code examples (correct and incorrect)
- Common pitfalls
- Best practices

### assets/templates/

Project templates copied during bootstrap:

- `Makefile` - Development commands
- `Dockerfile` - API container build
- `docker-compose.yml` - Production stack
- `docker-compose.dev.yml` - Development database
- `nginx.conf` - Reverse proxy
- `.env.example` - Environment template
- `go.work` - Go workspace

## Example Usage Flow

```
1. "Create a new API project"
   → Read: bootstrap-structure.md, bootstrap-go-work.md
   → Creates: Project with Makefile, Dockerfile, docker-compose, nginx.conf, .env.example

2. "Add a users module"
   → Read: module-structure.md, module-go-mod.md
   → Creates: modules/users/ with go.mod (and updates Dockerfile)

3. "Add list users endpoint"
   → Read: module-cqrs-query.md, module-repository.md
   → Creates: feature/list/query.go, repository.go

4. "Call inventory from order module"
   → Read: module-cross-module-sync.md
   → Creates: contracts/inventory.go, checkstock adapter

5. "Add create user endpoint"
   → Read: module-cqrs-command.md
   → Creates: feature/create/command.go

6. "Setup database"
   → Read: db-migration-tenant.md
   → Creates: migrations/001_create_users_table.up.sql

7. "Add authentication"
   → Read: middleware-auth.md
   → Creates: middleware/auth.go

8. "Deploy"
   → Files already created from bootstrap
   → Run: make docker-deploy
```

## Best Practices

### Do

- ✅ Keep business logic in modules, not /app
- ✅ Use `internal/` packages for encapsulation
- ✅ Always use transactions for commands
- ✅ Filter by tenant in every query
- ✅ Use soft delete with audit columns
- ✅ Register handlers in module.Init()

### Don't

- ❌ Import modules from other modules directly
- ❌ Mix business logic in application layer
- ❌ Skip tenant context validation
- ❌ Publish events before transaction commit
- ❌ Modify migration files after commit

## License

MIT
