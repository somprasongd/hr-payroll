# devops-dockerfile

Multi-stage Dockerfile for Go applications.

## Overview

See `module-go-mod.md` for complete module setup including Dockerfile updates.

## Basic Dockerfile Structure

```dockerfile
# Build stage
FROM golang:1.25-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git

# Copy go.mod files (see module-go-mod.md for module setup)
COPY go.mod go.sum ./
RUN go mod download

# Copy and build
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main ./app/cmd/api/main.go

# Final stage
FROM alpine:latest
RUN apk --no-cache add ca-certificates
COPY --from=builder /app/main /main
EXPOSE 8080
CMD ["/main"]
```

## Key Points

1. **Multi-stage build** - Smaller final image
2. **Layer caching** - Copy go.mod first
3. **Module support** - See `module-go-mod.md` for adding new modules

## Common Pitfalls

**Incorrect: Not separating mod download**
```dockerfile
# ❌ Downloads on every code change
COPY . .
RUN go mod download
```

**Correct: Cache dependencies**
```dockerfile
# ✅ Downloads only when go.mod changes
COPY go.mod go.sum ./
RUN go mod download
COPY . .
```

## Related

- **Adding new modules**: See `module-go-mod.md`
- **Docker Compose setup**: See `bootstrap-structure.md`
