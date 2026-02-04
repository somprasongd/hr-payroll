# devops-migrate

golang-migrate integration.

## Purpose

- Version-controlled schema changes
- Rollback capability
- Multiple environment support

## Installation

```bash
# macOS
brew install golang-migrate

# Linux
curl -L https://github.com/golang-migrate/migrate/releases/download/v4.17.0/migrate.linux-amd64.tar.gz | tar xvz
sudo mv migrate /usr/local/bin/

# Go install
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
```

## Commands

```bash
# Create new migration
migrate create -ext sql -dir migrations -seq create_users_table

# Apply all pending migrations
migrate -path migrations -database "$DB_DSN" up

# Rollback one migration
migrate -path migrations -database "$DB_DSN" down 1

# Check current version
migrate -path migrations -database "$DB_DSN" version

# Force version (fix dirty state)
migrate -path migrations -database "$DB_DSN" force 001

# Rollback all migrations
migrate -path migrations -database "$DB_DSN" down
```

## Environment Variables

```bash
# Development
export DB_DSN="postgres://user:password@localhost:5432/devdb?sslmode=disable"

# Production
export DB_DSN="postgres://user:password@prod-db:5432/proddb?sslmode=require"
```

## Docker Migration Service

```yaml
# docker-compose.yml
services:
  migrate:
    image: migrate/migrate:v4.17.0
    volumes:
      - ./migrations:/migrations
    environment:
      DB_DSN: postgres://user:password@db:5432/appdb?sslmode=disable
    command: ["-path", "/migrations", "-database", "$${DB_DSN}", "up"]
    depends_on:
      - db
```

## Go-based Migration Runner

**File: api/app/cmd/migrate/main.go**

```go
package main

import (
    "fmt"
    "os"
    "github.com/golang-migrate/migrate/v4"
    _ "github.com/golang-migrate/migrate/v4/database/postgres"
    _ "github.com/golang-migrate/migrate/v4/source/file"
    "{project}/api/app/config"
)

func main() {
    cfg, _ := config.Load()
    
    m, err := migrate.New("file://migrations", cfg.DSN)
    if err != nil {
        panic(err)
    }
    
    cmd := os.Args[1]
    switch cmd {
    case "up":
        err = m.Up()
    case "down":
        err = m.Down()
    case "version":
        v, dirty, _ := m.Version()
        fmt.Printf("Version: %d, Dirty: %v\n", v, dirty)
        return
    }
    
    if err != nil && err != migrate.ErrNoChange {
        panic(err)
    }
}
```

## Makefile Integration

```makefile
MIGRATE := migrate -path migrations -database "$(DB_DSN)"

mgc:  ## Create migration
	migrate create -ext sql -dir migrations -seq $(name)

mgu:  ## Migrate up
	$(MIGRATE) up

mgd:  ## Migrate down
	$(MIGRATE) down 1

mgv:  ## Show version
	$(MIGRATE) version

mgf:  ## Force version
	$(MIGRATE) force $(version)
```

## Common Pitfalls

**Incorrect: Modifying applied migration**
```bash
# ❌ Migration already applied, file changed
001_create_users.up.sql  # Modified after applying
```

**Correct: Create new migration**
```bash
# ✅ New migration for changes
migrate create -ext sql -dir migrations -seq add_user_column
```

**Incorrect: Manual database changes**
```bash
# ❌ Schema out of sync with migrations
psql -c "ALTER TABLE users ADD COLUMN ..."
```

**Correct: Always use migrations**
```bash
# ✅ Version controlled, reproducible
migrate create -ext sql -dir migrations -seq add_user_column
# Edit migration file
migrate up
```
