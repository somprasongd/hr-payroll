# bootstrap-go-work

Configure go.work for multi-module workspace.

## Why go.work

Go workspaces allow:
- Multiple modules in single codebase
- Easy local development without publishing
- Clear dependency boundaries

## File: go.work

```go
go 1.25

use (
    ./api
    ./api/shared/common
    ./api/shared/events
    ./api/shared/contracts
)
```

## Module go.mod Files

### api/go.mod
```go
module {project}/api

go 1.25

require (
    github.com/gofiber/fiber/v3 v3.0.0-rc.3
    github.com/google/uuid v1.6.0
    github.com/jmoiron/sqlx v1.4.0
    github.com/lib/pq v1.10.9
    github.com/caarlos0/env/v11 v11.0.0
    github.com/golang-jwt/jwt/v5 v5.2.0
    github.com/go-playground/validator/v10 v10.22.0
    go.uber.org/zap v1.27.0
)

require (
    {project}/api/shared/common v0.0.0
    {project}/api/shared/events v0.0.0
    {project}/api/shared/contracts v0.0.0
)

replace (
    {project}/api/shared/common v0.0.0 => ./shared/common
    {project}/api/shared/events v0.0.0 => ./shared/events
    {project}/api/shared/contracts v0.0.0 => ./shared/contracts
)
```

### api/shared/common/go.mod
```go
module {project}/api/shared/common

go 1.25

require (
    github.com/gofiber/fiber/v3 v3.0.0-rc.3
    github.com/google/uuid v1.6.0
    github.com/jmoiron/sqlx v1.4.0
    github.com/lib/pq v1.10.9
    github.com/golang-jwt/jwt/v5 v5.2.0
    github.com/go-playground/validator/v10 v10.22.0
    go.uber.org/zap v1.27.0
)
```

## Commands

```bash
# Initialize workspace
go work init

# Add modules
go work use ./api
go work use ./api/shared/common

# Download dependencies
cd api && go mod tidy
cd api/shared/common && go mod tidy
```

## Common Pitfalls

**Incorrect: Using replace in every module**
```go
// In modules/users/go.mod
replace {project}/shared/common => ../../shared/common  // ❌ Don't repeat
```

**Correct: Replace only in root api/go.mod**
```go
// Only api/go.mod has replace directives
// Module go.mod files use require only
```
