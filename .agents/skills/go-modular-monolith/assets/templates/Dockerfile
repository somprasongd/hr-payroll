# {{PROJECT_NAME}} API Dockerfile
# Multi-stage build for production

# =============================================================================
# Build Stage
# =============================================================================

FROM golang:1.25-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Copy go.mod files first for layer caching
# Main module
COPY go.mod go.sum ./

# Shared modules
COPY shared/common/go.mod shared/common/go.sum ./shared/common/
COPY shared/events/go.mod shared/events/go.sum ./shared/events/
COPY shared/contracts/go.mod shared/contracts/go.sum ./shared/contracts/

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags='-w -s -extldflags "-static"' \
    -a -installsuffix cgo \
    -o main \
    ./app/cmd/api/main.go

# =============================================================================
# Final Stage
# =============================================================================

FROM scratch

# Copy CA certificates from builder
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo

# Copy binary
COPY --from=builder /app/main /main

# Expose port
EXPOSE 8080

# Run as non-root (scratch doesn't support USER, but the binary doesn't need privileges)
ENTRYPOINT ["/main"]
