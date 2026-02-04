# db-migration-create

Create migration files and run migrations.

## Naming Convention

```
{version}_{description}.up.sql    # Upgrade (apply)
{version}_{description}.down.sql  # Rollback (undo)
```

Examples:
```
001_create_users_table.up.sql
001_create_users_table.down.sql
002_add_user_status.up.sql
002_add_user_status.down.sql
```

## Create New Migration

### Using migrate CLI

```bash
# Install
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# Create
migrate create -ext sql -dir migrations -seq create_users_table

# Creates:
# migrations/001_create_users_table.up.sql
# migrations/001_create_users_table.down.sql
```

### Using Makefile (Recommended)

```bash
make mgc name=create_users_table
```

## Migration Commands

| Command | Description |
|---------|-------------|
| `make mgc name=xxx` | Create new migration |
| `make mgu` | Run migrations up |
| `make mgd` | Run migrations down (1 step) |
| `make mgv` | Check current version |
| `make mgf version=001` | Force version (fix dirty state) |

### Using migrate CLI directly

```bash
# Apply all pending
migrate -path migrations -database "$DB_DSN" up

# Rollback one
migrate -path migrations -database "$DB_DSN" down 1

# Check version
migrate -path migrations -database "$DB_DSN" version

# Force version
migrate -path migrations -database "$DB_DSN" force 001
```

## Migration File Structure

**001_create_users_table.up.sql:**
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
```

**001_create_users_table.down.sql:**
```sql
DROP TABLE IF EXISTS users;
```

## Best Practices

### ✅ Do
- One logical change per migration
- Make migrations idempotent
- Test migrations on copy of production data
- Keep migrations small

### ❌ Don't
- Modify existing migration files after commit
- Delete migration files
- Add business logic in migrations

## Idempotent Example

```sql
-- 003_add_user_status.up.sql
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='users' AND column_name='status'
    ) THEN
        ALTER TABLE users ADD COLUMN status VARCHAR(50) DEFAULT 'active';
    END IF;
END $$;
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
make mgc name=add_user_column
```
