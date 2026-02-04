# bootstrap-structure

Standard folder structure for modular monolith API projects.

## Why This Structure

Clear separation of concerns enables:
- Independent module development
- Shared library reuse across modules
- Clean dependency boundaries
- Scalable team collaboration

## Project Structure

```
{project}/
├── api/                           # Backend API
│   ├── app/
│   │   ├── cmd/api/
│   │   │   └── main.go           # Application entry point
│   │   ├── application/
│   │   │   ├── application.go    # App container, module registration
│   │   │   └── http.go           # HTTP server setup (Fiber)
│   │   ├── config/
│   │   │   └── config.go         # Environment configuration
│   │   └── build/
│   │       └── build.go          # Build info (version, commit)
│   ├── modules/                   # Domain modules
│   │   └── {module}/
│   │       ├── module.go
│   │       ├── go.mod
│   │       └── internal/
│   │           ├── dto/
│   │           ├── feature/
│   │           └── repository/
│   └── shared/                    # Shared libraries
│       ├── common/
│       ├── contracts/
│       └── events/
├── migrations/                    # Database migrations
├── nginx/
│   └── nginx.conf                # Nginx configuration
├── docker-compose.yml            # Production compose
├── docker-compose.dev.yml        # Development compose
├── Dockerfile                    # API Dockerfile
├── Makefile                      # Development commands
├── go.work                       # Go workspace
└── .env.example                  # Environment template
```

## Create Project from Templates

Copy templates from `assets/templates/`:

```bash
# Copy all template files
cp assets/templates/go.work ./
cp assets/templates/Makefile ./
cp assets/templates/Dockerfile ./api/
cp assets/templates/docker-compose.yml ./
cp assets/templates/docker-compose.dev.yml ./
cp assets/templates/nginx.conf ./nginx/
cp assets/templates/.env.example ./

# Replace {{PROJECT_NAME}} with actual project name
sed -i '' 's/{{PROJECT_NAME}}/myapp/g' Makefile docker-compose.yml docker-compose.dev.yml nginx/nginx.conf .env.example api/Dockerfile
```

## Key Principles

### 1. `/app` - Application Layer
Contains HTTP server, configuration, and dependency injection. Should not contain business logic.

### 2. `/modules/*` - Domain Modules
Each module is a separate Go module with:
- Clear domain boundaries
- Internal packages (not importable from outside)
- CQRS pattern (commands and queries)

### 3. `/shared/*` - Shared Libraries
Reusable components:
- `common/` - Core utilities (errs, mediator, logger, etc.)
- `contracts/` - Cross-module interfaces
- `events/` - Event definitions

## Common Pitfalls

**Incorrect: Mixing business logic in /app**
```
api/
├── handlers/           # ❌ Don't put handlers here
├── services/           # ❌ Don't put services here
└── main.go
```

**Correct: Business logic in modules**
```
api/
├── app/                # ✅ HTTP, config, DI only
├── modules/
│   ├── users/          # ✅ Business logic here
│   └── products/       # ✅ Each module independent
└── shared/             # ✅ Shared utilities
```
