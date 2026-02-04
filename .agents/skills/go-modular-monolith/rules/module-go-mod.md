# module-go-mod

Separate go.mod for each module.

## Why Separate go.mod

- Clear dependency boundaries
- Independent versioning
- Faster builds (smaller module)
- Enforces clean architecture

## Step-by-Step: Create New Module

### 1. Create Directory Structure

```bash
mkdir -p api/modules/{module}/internal/{dto,feature/create,feature/list,feature/get,feature/update,feature/delete,repository}
```

### 2. Create go.mod File

**File: `api/modules/{module}/go.mod`**

```go
module {project}/api/modules/{module}

go 1.25

// Replace shared dependencies
replace {project}/api/shared/common v0.0.0 => ../../shared/common
replace {project}/api/shared/events v0.0.0 => ../../shared/events
replace {project}/api/shared/contracts v0.0.0 => ../../shared/contracts

require (
    github.com/gofiber/fiber/v3 v3.0.0-rc.3
    github.com/google/uuid v1.6.0
    github.com/lib/pq v1.10.9
    go.uber.org/zap v1.27.0
    {project}/api/shared/common v0.0.0
    {project}/api/shared/contracts v0.0.0
    {project}/api/shared/events v0.0.0
)
```

### 3. Download Dependencies

```bash
cd api/modules/{module}
go mod tidy
```

### 4. Update Dockerfile (IMPORTANT!)

**File: `api/Dockerfile`** - Add lines for the new module:

```dockerfile
# Copy go.mod files first for layer caching
# [EXISTING] Main module
COPY go.mod go.sum ./

# [EXISTING] Shared modules  
COPY shared/common/go.mod shared/common/go.sum ./shared/common/
COPY shared/events/go.mod shared/events/go.sum ./shared/events/
COPY shared/contracts/go.mod shared/contracts/go.sum ./shared/contracts/

# [ADD THIS] New module go.mod
COPY modules/{module}/go.mod modules/{module}/go.sum ./modules/{module}/

# Download dependencies
RUN go mod download
RUN cd shared/common && go mod download
RUN cd shared/events && go mod download
RUN cd shared/contracts && go mod download

# [ADD THIS] Download new module dependencies
RUN cd modules/{module} && go mod download

# Copy source code
COPY . .

# Build
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main ./app/cmd/api/main.go
```

### 5. Verify Build

```bash
# Test local build
make build

# Test Docker build
make build-image
```

## Checklist: Create New Module

- [ ] Create directory structure
- [ ] Create `go.mod` with replace directives
- [ ] Run `go mod tidy`
- [ ] **Update `Dockerfile`** - Add module go.mod copy and download
- [ ] **Test Docker build** - Run `make build-image` to verify
- [ ] Register module in `main.go`

## Dependency Rules

### ✅ Allowed
```
/modules/* -> /shared/common
/modules/* -> /shared/events
/modules/* -> /shared/contracts
```

### ❌ Not Allowed
```
/modules/* -> /app
/modules/* -> /modules/* (direct import, use contracts)
/shared/* -> /modules/*
```

## Common Pitfalls

**Incorrect: Direct module imports**
```go
// ❌ Don't import from other modules directly
import "{project}/api/modules/inventory/internal/repository"
```

**Correct: Use contracts**
```go
// ✅ Import contract interface only
import "{project}/api/shared/contracts"
```

**Incorrect: Missing replace directives**
```go
// ❌ go mod tidy will fail
module myproject/api/modules/users

go 1.25

require myproject/api/shared/common v0.0.0  // Can't find this version
```

**Correct: Replace to local path**
```go
// ✅ Points to local directory
replace myproject/api/shared/common => ../../shared/common
```

**Incorrect: Forgot to update Dockerfile**
```dockerfile
# ❌ Build will fail - missing new module
docker build -t myapp ./api
```

**Correct: Added to Dockerfile**
```dockerfile
# ✅ Include in build
COPY modules/users/go.mod modules/users/go.sum ./modules/users/
RUN cd modules/users && go mod download
```
