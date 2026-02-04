---
name: go-modular-monolith
description: Build Go modular monolith APIs with CQRS, multi-tenancy, and clean architecture. This skill should be used when creating new API projects, modules, middleware, or working with database migrations. Triggers on Go backend development, modular architecture, PostgreSQL with sqlx, or event-driven patterns.
---

# Go Modular Monolith Best Practices

Comprehensive guide for building scalable Go APIs using modular monolith architecture with CQRS patterns, maintained for production-grade applications.

## When to Apply

Reference these guidelines when:
- Bootstrapping new Go API projects
- Creating new domain modules
- Adding custom middleware
- Managing shared libraries across modules
- Writing database migrations
- Working with multi-tenant PostgreSQL databases

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Project Bootstrap | CRITICAL | `bootstrap-` |
| 2 | Module Development | CRITICAL | `module-` |
| 3 | Database & Migrations | HIGH | `db-` |
| 4 | Middleware & Auth | HIGH | `middleware-` |
| 5 | Shared Libraries | MEDIUM | `shared-` |
| 6 | DevOps & Deployment | MEDIUM | `devops-*` |

## Quick Reference

### 1. Project Bootstrap (CRITICAL)

Bootstrap creates complete project structure with:
- `Makefile` - run, build, migrate, deploy commands
- `Dockerfile` - Multi-stage Go build
- `docker-compose.yml` - Production stack (postgres, nginx, api, migrate)
- `docker-compose.dev.yml` - Development database only
- `nginx.conf` - Reverse proxy configuration
- `.env.example` - Environment template
- `go.work` - Go workspace configuration

Rules:
- `bootstrap-structure` - Standard folder structure and templates
- `bootstrap-go-work` - Configure go.work for multi-module workspace
- `bootstrap-main` - Application entry point with proper initialization
- `bootstrap-config` - Environment-based configuration with env tags
- `bootstrap-server` - HTTP server setup with Fiber v3
- `bootstrap-swagger` - API documentation with Swagger/OpenAPI

### 2. Module Development (CRITICAL)

- `module-structure` - Internal package layout for modules
- `module-go-mod` - Separate go.mod for each module (includes Dockerfile update)
- `module-repository` - Repository pattern with tenant-aware queries
- `module-cqrs-command` - Command handlers for write operations
- `module-cqrs-query` - Query handlers for read operations
- `module-cross-module-sync` - Synchronous cross-module calls via mediator
- `module-cross-module-async` - Asynchronous events via event bus
- `module-dto` - Data transfer objects with conversion helpers
- `module-endpoint` - HTTP endpoint registration with Swagger docs
- `module-registration` - Wire module in main.go

### 3. Database & Migrations (HIGH)

- `db-migration-create` - Create migration files with naming convention
- `db-migration-tenant` - RLS policies for multi-tenancy
- `db-migration-audit` - Audit columns (created_at, updated_at, etc.)
- `db-transactor` - Transaction management with post-commit hooks
- `db-sqlx-named` - Use named parameters for complex queries
- `db-soft-delete` - Soft delete pattern implementation

### 4. Middleware & Auth (HIGH)

- `middleware-global` - App-level middleware registration
- `middleware-module` - Route-level middleware chains
- `middleware-auth` - JWT authentication middleware
- `middleware-tenant` - Multi-tenant context extraction
- `middleware-error` - Centralized error handling

### 5. Shared Libraries (MEDIUM)

- `shared-errs` - Domain error types with HTTP status mapping
- `shared-mediator` - Command/query dispatcher pattern
- `shared-contextx` - Tenant and user context extraction
- `shared-eventbus` - In-memory event bus for cross-module communication
- `shared-logger` - Structured logging with Zap
- `shared-validator` - Request validation with go-playground/validator
- `shared-optionaluuid` - Optional UUID type for nullable FK fields
- `shared-password` - Argon2id password hashing
- `shared-contracts` - Cross-module contracts for mediator pattern

### 6. DevOps & Deployment (MEDIUM)

Base DevOps files (Makefile, Dockerfile, docker-compose, nginx.conf) are created automatically during project bootstrap. Use these rules for customization:

- `devops-dockerfile` - Customize multi-stage build (also see: module-go-mod.md for adding new modules)
- `devops-compose` - Customize Docker Compose services
- `devops-nginx` - SSL setup, rate limiting, reverse proxy
- `devops-makefile` - Add custom commands (migration commands are in: db-migration-create.md)
- `devops-migrate` - golang-migrate CLI usage

## How to Use

Read individual rule files for detailed explanations and code examples:

```
rules/bootstrap-structure.md
rules/module-repository.md
rules/db-migration-tenant.md
```

Each rule file contains:
- Brief explanation of why it matters
- File location and structure
- Code examples with explanations
- Common pitfalls to avoid

## Templates Location

Project templates (Makefile, Dockerfile, docker-compose, etc.) are in:
```
assets/templates/
├── Makefile
├── Dockerfile
├── docker-compose.yml
├── docker-compose.dev.yml
├── nginx.conf
├── .env.example
└── go.work
```

## Full Compiled Document

For the complete guide with all rules expanded: `AGENTS.md`
