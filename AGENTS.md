<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# HR Payroll - AI Agent Documentation

ระบบจัดการเงินเดือนและทรัพยากรบุคคล (HR Payroll Management System)

## Project Overview

A full-stack HR payroll management system supporting multi-company and multi-branch operations with multi-tenancy using PostgreSQL RLS.

### Core Features
- Employee Management (Full-time & Part-time)
- Worklog Tracking (FT/PT)
- Salary Advance
- Debt & Loan Management
- Bonus Management
- Salary Raise
- Part-time Payout
- Payroll Run
- User Management
- Multi-Tenancy (Company & Branch isolation)

## Technology Stack

### Backend (API)
- **Language**: Go 1.25+
- **Web Framework**: Fiber v3 (gofiber/fiber/v3)
- **Database**: PostgreSQL 18+
- **ORM/Database**: sqlx (jmoiron/sqlx)
- **Authentication**: JWT (golang-jwt/jwt/v5)
- **Password Hashing**: Argon2
- **Validation**: go-playground/validator/v10
- **Documentation**: Swagger (swaggo/swag/v2)
- **Logging**: Zap (uber-go/zap)

### Frontend (Web)
- **Framework**: Next.js 16 (App Router)
- **React**: 19.2.0
- **Language**: TypeScript 5
- **Styling**: TailwindCSS 4
- **UI Components**: Radix UI + Shadcn/UI
- **Localization**: next-intl (i18n for th, en, my)
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query) v5
- **Tables**: TanStack Table v8
- **Forms**: React Hook Form + Zod
- **HTTP Client**: Axios
- **Charts**: Recharts
- **PWA**: @ducanh2912/next-pwa
- **E2E Testing**: Playwright

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Database Migrations**: golang-migrate/migrate
- **Reverse Proxy**: Nginx
- **Production Database**: PostgreSQL 18 (Alpine)

## Project Structure

```
├── api/                    # Backend API (Go)
│   ├── app/               # Main application entry point
│   │   ├── cmd/api/       # Main.go
│   │   ├── application/   # HTTP server setup
│   │   ├── config/        # Configuration loading
│   │   ├── docs/          # Swagger documentation
│   │   └── build/         # Build info
│   ├── modules/           # Domain modules (each has go.mod)
│   │   ├── auth/
│   │   ├── employee/
│   │   ├── payrollrun/
│   │   ├── bonus/
│   │   ├── debt/
│   │   ├── salaryadvance/
│   │   ├── salaryraise/
│   │   ├── worklog/
│   │   ├── company/
│   │   ├── branch/
│   │   ├── user/
│   │   ├── tenant/
│   │   ├── superadmin/
│   │   └── ...
│   └── shared/            # Shared libraries
│       ├── common/        # Common utilities (mediator, middleware, etc.)
│       ├── contracts/     # Cross-module interfaces
│       └── events/        # Event definitions
├── web/                   # Frontend Web (Next.js)
│   ├── src/
│   │   ├── app/          # Next.js App Router pages
│   │   ├── components/   # React components
│   │   ├── lib/          # Utilities (api-client, axios)
│   │   ├── hooks/        # Custom React hooks
│   │   ├── stores/       # Zustand stores
│   │   └── messages/     # i18n translations
│   ├── e2e/              # Playwright E2E tests
│   └── public/           # Static assets
├── migrations/            # SQL Database Migrations
│   ├── *.up.sql          # Migration up scripts
│   ├── *.down.sql        # Migration down scripts
│   ├── dev-seed/         # Development seed data
│   └── test-seed/        # Test seed data
├── docs/                  # Documentation
├── nginx/                 # Nginx Configuration
├── openspec/              # Specification-driven development
│   ├── AGENTS.md         # OpenSpec detailed instructions
│   ├── project.md        # Project conventions
│   ├── specs/            # Current capabilities
│   └── changes/          # Active/archived changes
└── docker-compose*.yml    # Docker configurations
```

## Architecture

### Modular Monolith
The system uses a **Modular Monolith** architecture with clear domain boundaries:

1. **Mediator Pattern**: Central dispatcher for commands and queries
   - `api/shared/common/mediator/mediator.go`
   - Commands write data, Queries read data (CQRS)

2. **Module Structure**: Each module follows this pattern:
   ```
   module/
   ├── module.go              # Module definition, route registration
   ├── internal/
   │   ├── entity/           # Domain entities
   │   ├── dto/              # Data transfer objects
   │   ├── feature/          # Use cases
   │   │   ├── create/       # Command example
   │   │   │   ├── command.go
   │   │   │   └── endpoint.go
   │   │   └── list/         # Query example
   │   │       ├── query.go
   │   │       └── endpoint.go
   │   ├── repository/       # Data access
   │   └── subscriber/       # Event handlers
   ```

3. **CQRS Pattern**:
   - Commands (write): `command.go` files
   - Queries (read): `query.go` files
   - Handlers registered with mediator

4. **Multi-Tenancy**: PostgreSQL Row-Level Security (RLS)
   - `X-Company-ID` header required for platform APIs
   - `X-Branch-ID` header required for platform APIs
   - Superadmin routes (`/super-admin/*`) don't require tenant headers

5. **Integration Events**: Event bus for async communication between modules

### Request Flow
```
HTTP Request → Middleware (Auth, Tenant) → Endpoint → Command/Query Handler → Repository → Database
```

## Development Setup

### Prerequisites
- Go 1.25+
- Node.js 18+ (22+ recommended)
- Docker & Docker Compose
- PostgreSQL 18+ (or use Docker)

### Environment Configuration
```bash
cp .env.example .env
```

### Start Development

```bash
# 1. Start PostgreSQL in Docker
make devup

# 2. Run database migrations
make mgu

# 3. (Optional) Seed development data
make seed

# 4. Run both API and Web (concurrently)
make run

# Or run separately
make run-api   # API at http://localhost:8080
make run-web   # Web at http://localhost:3000
```

### Development URLs
- Web App: http://localhost:3000
- API: http://localhost:8080
- API Docs: http://localhost:8080/docs/

## Build and Run Commands

| Command | Description |
|---------|-------------|
| `make run` | Run API and Web concurrently |
| `make run-api` | Run API server only |
| `make run-web` | Run Web dev server only |
| `make build` | Build API binary to `bin/` |
| `make devup` | Start dev Docker services (PostgreSQL) |
| `make devdown` | Stop dev Docker services |
| `make devdownv` | Stop services and remove volumes |
| `make image` | Build Docker images (API + Web) |
| `make produp` | Run production stack (prebuilt images) |
| `make produp-build` | Build locally and run production stack |
| `make proddown` | Stop production services |

## Database Management

| Command | Description |
|---------|-------------|
| `make mgc filename=xxx` | Create new migration file |
| `make mgu` | Run migrations (up) |
| `make mgd` | Rollback migration (1 step) |
| `make mgv` | Check current migration version |
| `make mgf VERSION=xxx` | Force migration version |
| `make seed` | Import dev seed data |
| `make db-seed-clear` | Clear dev seed data |
| `make dbml` | Generate DBML schema from database |

### Migration Naming Convention
Format: `YYYYMMDDHHMMSS_description.up.sql` / `YYYYMMDDHHMMSS_description.down.sql`

Example: `20250915034629_create_user_table.up.sql`

## Testing

### E2E Testing (Playwright)

```bash
# Setup test environment
cp web/.env.test.example web/.env.test

# Run E2E tests
make test-e2e

# Run with UI mode
make test-e2e-ui

# Show report
npx playwright show-report
```

### E2E Test Structure
- Tests located in `web/e2e/tests/`
- Test data seeded from `migrations/test-seed/`
- Authentication state cached in `web/e2e/.auth/`

### Test Commands
| Command | Description |
|---------|-------------|
| `make test-e2e` | Run all E2E tests |
| `make test-e2e-ui` | Run E2E tests in UI mode |

## Code Style Guidelines

### Go (Backend)
- Follow standard Go conventions (gofmt)
- Use meaningful variable names
- Error handling: check errors immediately, use `errs` package for domain errors
- Struct tags for validation: `validate:"required,uuid"`
- Each module has its own `go.mod` (multi-module workspace)

### TypeScript/React (Frontend)
- Use TypeScript strict mode
- Functional components with hooks
- Server components by default, mark `'use client'` when needed
- Use Zustand for global state, React Query for server state
- Form validation with Zod schemas
- Tailwind for styling, use `cn()` utility for conditional classes

### Module Development Pattern

#### Creating a New Feature

1. **Define DTO** (if needed): `internal/dto/feature.go`
2. **Create Command** (write operation): `internal/feature/action/command.go`
   ```go
   type Command struct {
       ID uuid.UUID `validate:"required,uuid"`
   }
   
   type Handler struct {
       repo repository.Repository
       trans transactor.Transactor
   }
   
   func (h *Handler) Handle(ctx context.Context, cmd Command) (Response, error)
   ```
3. **Create Endpoint**: `internal/feature/action/endpoint.go`
   ```go
   func NewEndpoint(router fiber.Router) {
       router.Post("/path", handler)
   }
   ```
4. **Register in module**: `module.go`
   ```go
   func (m *Module) Init() error {
       mediator.Register[*action.Command, *action.Response](action.NewHandler(...))
   }
   
   func (m *Module) RegisterRoutes(r fiber.Router) {
       action.NewEndpoint(r.Group("/feature"))
   }
   ```

## Security Considerations

### Authentication
- JWT-based authentication with access and refresh tokens
- Access tokens short-lived (15 minutes default)
- Refresh tokens long-lived (30 days)
- Tokens stored in HttpOnly cookies

### Authorization
- Role-based access control (RBAC)
- Company/Branch isolation via PostgreSQL RLS
- Superadmin routes protected by middleware

### Required Headers for Platform APIs
| Header | Description | Required |
|--------|-------------|----------|
| `X-Company-ID` | UUID of the company | Yes |
| `X-Branch-ID` | UUID of the selected branch | Yes |

### Security Middleware
- CORS configured for allowed origins
- Request logging for audit
- Error handling to prevent information leakage

## Deployment

### Production Deployment
```bash
# Build images and start
make produp-build

# Or use prebuilt images
make produp
```

### Production Services (docker-compose.prod.yml)
- `db`: PostgreSQL 18
- `migrate`: Database migration runner
- `api`: Go API server
- `web`: Next.js web server
- `pgadmin`: Database management UI
- `postgresus`: Postgres schema visualization
- `proxy`: Nginx reverse proxy

### Production URLs (via Nginx)
- Web: http://localhost/
- API: http://localhost/api/
- pgAdmin: http://localhost/pgadmin/
- Postgresus: http://localhost:4005

## Documentation

| Document | Location |
|----------|----------|
| API Specification | `docs/design/api_specification.md` |
| Database Schema (DBML) | `docs/design/schema.dbml` |
| API Docs (Swagger) | http://localhost:8080/docs/ |

### Generate API Docs
```bash
make doc
```

### Generate Changelog
```bash
# Full changelog
make changelog

# Update unreleased section
make changelog-unreleased

# Prepare release
make changelog-release CHANGELOG_TAG=v1.0.0
```

## Troubleshooting

### Common Issues

1. **Migration fails**: Check `DB_DSN` in `.env`
2. **Module import errors**: Run `make tidy` to fix Go module dependencies
3. **E2E tests fail**: Ensure test data is seeded (`migrations/test-seed/`)
4. **Build fails**: Clear `.cache/go-build` directory

### Logs
- API logs: `api/api.log`
- Web dev logs: `web/.next/dev/logs/next-development.log`

## Language and Conventions

- **Primary documentation language**: English
- **Code comments**: English
- **User-facing content**: Thai, English, Burmese (via i18n)
- **Commit messages**: Conventional Commits (for changelog generation)

## Related Documentation

- [OpenSpec Instructions](./openspec/AGENTS.md) - Specification-driven development
- [API README](./api/README.md)
- [Web README](./web/README.md)
- [API Specification](./docs/design/api_specification.md)
- [Database Schema (DBML)](./docs/design/schema.dbml)
