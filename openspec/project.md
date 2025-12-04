# Project Context

## Purpose

- HR/payroll platform for multiple companies/branches: manage employees, attendance/worklogs, payroll configs/runs, salary advances/raises, bonuses, debts, and payouts with admin/HR roles.
- Provide web UI (multi-lingual) plus REST API for integrations and automation; upcoming multi-tenancy isolation per company/branch.

## Tech Stack

- Backend: Go 1.25, Fiber v3, PostgreSQL; modules per domain (auth, user, employee, payrollconfig/run, salaryadvance/raise, bonus, debt, payoutpt, worklog, masterdata).
- Auth: JWT (HS256) access/refresh tokens; Fiber middleware for auth, logging, error handling.
- Persistence: SQL migrations (`migrate/migrate` Docker image via Makefile), `sqlx` + repository layer, transaction helper with savepoints.
- Frontend: Next.js 16 (App Router) on React 19 + TypeScript; Next-Intl (i18n en/th/my), Tailwind CSS v4, Radix UI, TanStack Query, Zustand, React Hook Form, axios client with interceptors, optional PWA (`@ducanh2912/next-pwa`).
- Tooling: Makefile for run/build/docker/migrations/swagger docs; Docker Compose for dev/prod; Swagger generation via `swag` for `/api/v1`.

## Project Conventions

### Code Style

- Go: `gofmt`/`goimports`; prefer small modules with command/query handlers via `mediator`; repositories take `context.Context` + transactor; errors via `errs.*`; logging through `logger` (zap); JWT bearer auth on protected routes.
- TypeScript: ESLint (Next config), strict TS, path alias `@/*`; functional components/hooks; API calls through shared axios instance + services; state via Zustand; data fetching via TanStack Query; forms via React Hook Form + Zod validation.
- API shape: versioned under `/api/v1`; JSON responses; middleware stack = request logger → CORS → recover → error handler.

### Architecture Patterns

- Backend: modular architecture per domain; HTTP server wires modules and route groups; mediator for CQRS-style command/query handlers; repository pattern over `sqlx`; transaction wrapper with nested savepoints; in-memory event bus available for decoupled events.
- Frontend: App Router with locale segment `[locale]`; `Providers` supply query client/store; `ProtectedRoute` handles auth guarding; axios interceptors manage access/refresh tokens and request retry; i18n routing utilities strip/add locale prefixes.
- Multi-tenancy (in progress): tenant context (company/branch) enforced in middleware/repositories; login + switch flow returns tenant-scoped tokens; UI topbar switcher for branch/company.

### Testing Strategy

- Currently minimal automated tests in repo; rely on manual flows for auth/login/refresh.
- Planned: unit tests per handler/repository (with test DB + migrations), middleware tests for auth/tenant context, and E2E smoke via web login + payroll flows.

### Git Workflow

- Not formally codified; default branch is main. Suggested: feature branches + PRs, semantic/meaningful commit messages, rebase or squash before merge.

## Domain Context

- Admin/HR roles manage users, employees, payroll configurations, cycles (salary raise/bonus), advances/debts, worklogs, and payroll runs/payouts.
- Multi-lingual web (en/th/my) with locale-aware routing; login redirects respect return URL and refresh-token flow.
- Multi-tenant requirement: multiple companies, each with multiple branches; HR can switch branch to run payroll per branch; token carries company/branch context.

## Important Constraints

- Requires `DB_DSN`, JWT secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`), and HTTP port via environment; Postgres-specific features (UUIDv7, check constraints) in migrations.
- All business queries must be scoped by tenant keys (company/branch) once enabled; avoid global unique constraints that ignore tenant.
- Swagger docs generation uses `swag` (needs Go tool installed) and relies on module path `hrms`.

## External Dependencies

- PostgreSQL database.
- `migrate/migrate` Docker image for schema migrations (Make targets `mgc/mgu/mgd`).
- Docker/Docker Compose for local/dev/prod orchestration.
- Fiber Swagger (`github.com/somprasongd/fiber-swagger`) for API docs; Next-Intl and Radix UI libraries on the web tier.
