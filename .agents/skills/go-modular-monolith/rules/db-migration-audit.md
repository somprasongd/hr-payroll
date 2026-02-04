# db-migration-audit

Audit columns (created_at, updated_at, etc.).

## Standard Audit Columns

```sql
CREATE TABLE products (
    -- Business columns
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    
    -- Audit columns
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    
    -- Soft delete
    deleted_at TIMESTAMP,
    deleted_by UUID
);
```

## Migration Template

**001_create_products_table.up.sql:**
```sql
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Multi-tenancy
    company_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    
    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    deleted_at TIMESTAMP,
    deleted_by UUID
);

-- Indexes for common queries
CREATE INDEX idx_products_company_id ON products(company_id);
CREATE INDEX idx_products_branch_id ON products(branch_id);
CREATE INDEX idx_products_deleted_at ON products(deleted_at) WHERE deleted_at IS NULL;
```

## Auto-Update Trigger

```sql
-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

## Audit Checklist

For every table:
- [ ] `created_at` - Timestamp of creation
- [ ] `updated_at` - Timestamp of last update
- [ ] `created_by` - UUID of creator
- [ ] `updated_by` - UUID of last updater
- [ ] `deleted_at` - Soft delete timestamp (NULL = active)
- [ ] `deleted_by` - UUID of who deleted

## Repository Implementation

```go
// Set audit fields before insert
payload.CreatedAt = time.Now()
payload.UpdatedAt = payload.CreatedAt
payload.CreatedBy = actor
payload.UpdatedBy = actor

// Update only updated fields
params := map[string]interface{}{
    "name":       payload.Name,
    "updated_by": actor,
}
```

## Common Pitfalls

**Incorrect: Missing updated_by**
```sql
-- ❌ Who made the change?
UPDATE products SET name = 'New Name' WHERE id = $1;
```

**Correct: Track updater**
```sql
-- ✅ Always set updated_by
UPDATE products SET name = 'New Name', updated_by = $2 WHERE id = $1;
```
